import Database from '@tauri-apps/plugin-sql';
import type { Conversation, Settings, Model, Message } from '../types';
import { showError } from '../store';

// Storage keys for migration
const STORAGE_KEYS = {
  conversations: 'chatalyst_conversations',
  selectedConversation: 'chatalyst_selected_conversation',
  settings: 'chatalyst-settings',
  modelsCache: 'chatalyst-models-cache',
  favoriteModels: 'chatalyst-favorite-models',
  windowGeometry: 'chatalyst_window_geometry',
  migrationVersion: 'chatalyst_migration_version'
} as const;

// Current migration version
const CURRENT_MIGRATION_VERSION = 2;

// Database instance (cached)
let db: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;

// Mutex to prevent concurrent save operations
let saveInProgress = false;
const saveQueue: Array<() => void> = [];

async function getDatabase(): Promise<Database> {
  if (db) {
    return db;
  }
  
  if (dbInitPromise) {
    return await dbInitPromise;
  }
  
  dbInitPromise = (async () => {
    const database = await Database.load('sqlite:chatalyst.db');
    
    // Enable WAL mode for better concurrency
    try {
      await database.execute('PRAGMA journal_mode=WAL;');
      await database.execute('PRAGMA synchronous=NORMAL;');
      await database.execute('PRAGMA cache_size=1000;');
      await database.execute('PRAGMA temp_store=memory;');
    } catch (pragmaError) {
      console.warn('Could not set database pragmas:', pragmaError);
    }
    
    return database;
  })();
  
  try {
    db = await dbInitPromise;
    return db;
  } finally {
    dbInitPromise = null;
  }
}

// SQL Storage implementation
class SqlStorage {
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private migrationInProgress = false;

  // Initialize the storage
  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // Ensure database is ready
        await getDatabase();
        this.isInitialized = true;
        
        // Run migration if needed
        await this.runMigration();
      } catch (error) {
        showError(`Failed to initialize SQL storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    })();

    return this.initPromise;
  }

  // Migration logic to move data from tauri-store to SQL
  private async runMigration(): Promise<void> {
    this.migrationInProgress = true;
    try {
      const database = await getDatabase();
      
      // Check current migration version
      let versionResult: { value: string }[] = [];
      try {
        versionResult = await database.select<{ value: string }[]>(
          'SELECT value FROM migration_metadata WHERE key = ?',
          ['migration_version']
        );
      } catch {
        console.log('migration_metadata table does not exist yet, this is expected for first run');
        versionResult = [];
      }
      
      const currentVersion = versionResult.length > 0 ? parseInt(versionResult[0].value) : 0;
      console.log('Current migration version:', currentVersion);
      
      if (currentVersion >= CURRENT_MIGRATION_VERSION) {
        console.log('Already migrated to latest version, skipping migration');
        return; // Already migrated
      }

      console.log('Running storage migration from tauri-store to SQL...');

      // Check if there's data in localStorage that needs direct migration to SQL
      const hasLocalStorage = Object.values(STORAGE_KEYS).some(key => 
        localStorage.getItem(key) !== null
      );
      
      if (hasLocalStorage && currentVersion === 0) {
        console.log('Found localStorage data, migrating directly to SQL');
        await this.migrateFromLocalStorageToSQL();
      } else if (hasLocalStorage) {
        console.log('localStorage data found but migration already completed');
      } else {
        console.log('No localStorage data found, skipping migration');
      }

      // Set migration version
      await database.execute(
        'INSERT OR REPLACE INTO migration_metadata (key, value, updated_at) VALUES (?, ?, datetime("now"))',
        ['migration_version', CURRENT_MIGRATION_VERSION.toString()]
      );

      console.log(`Successfully migrated to version ${CURRENT_MIGRATION_VERSION}`);
    } catch (error) {
      console.error('Migration failed:', error);
      showError(`Storage migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.migrationInProgress = false;
    }
  }

  // Direct migration: localStorage to SQL (skipping tauri-store)
  async migrateFromLocalStorageToSQL(): Promise<void> {
    console.log('Running direct migration: localStorage to SQL...');
    const database = await getDatabase();

    try {
      // Migrate conversations
      const conversationsData = localStorage.getItem(STORAGE_KEYS.conversations);
      if (conversationsData) {
        const conversations = JSON.parse(conversationsData) as Conversation[];
        console.log('Found conversations in localStorage:', conversations.length);
        
        for (const conv of conversations) {
          await database.execute(
            `INSERT OR REPLACE INTO conversations 
             (id, title, model, enabled_tools, archived, archived_at, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, datetime(?, 'unixepoch', 'localtime'), datetime(?, 'unixepoch', 'localtime'))`,
            [
              conv.id,
              conv.title,
              conv.model || '',
              conv.enabledTools ? JSON.stringify(conv.enabledTools) : null,
              conv.archived ? 1 : 0,
              conv.archivedAt ? new Date(conv.archivedAt).toISOString() : null,
              (conv.createdAt / 1000).toString(),
              (conv.updatedAt / 1000).toString()
            ]
          );

          // Migrate messages for this conversation
          if (conv.messages) {
            for (const message of conv.messages) {
              await database.execute(
                `INSERT OR REPLACE INTO conversation_messages 
                 (id, conversation_id, role, content, timestamp, model, image_ids) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  message.id,
                  conv.id,
                  message.role,
                  message.content,
                  message.timestamp,
                  (message as unknown as { model?: string }).model || null,
                  message.imageIds ? JSON.stringify(message.imageIds) : null
                ]
              );
            }
          }
        }
        console.log(`Migrated ${conversations.length} conversations from localStorage`);
      }

      // Migrate selected conversation
      const selectedConversation = localStorage.getItem(STORAGE_KEYS.selectedConversation);
      if (selectedConversation) {
        await database.execute(
          'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime("now"))',
          ['selected_conversation', selectedConversation]
        );
      }

      // Migrate settings
      const settingsData = localStorage.getItem(STORAGE_KEYS.settings);
      if (settingsData) {
        await database.execute(
          'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime("now"))',
          ['app_settings', settingsData]
        );
      }

      // Migrate models cache
      const modelsCacheData = localStorage.getItem(STORAGE_KEYS.modelsCache);
      if (modelsCacheData) {
        const modelsCache = JSON.parse(modelsCacheData) as Record<string, { models: Model[]; timestamp: number }>;
        for (const [providerKey, cacheData] of Object.entries(modelsCache)) {
          await database.execute(
            'INSERT OR REPLACE INTO models_cache (provider_key, models_data, timestamp, updated_at) VALUES (?, ?, ?, datetime("now"))',
            [providerKey, JSON.stringify(cacheData.models), cacheData.timestamp]
          );
        }
      }

      // Migrate favorite models
      const favoriteModelsData = localStorage.getItem(STORAGE_KEYS.favoriteModels);
      if (favoriteModelsData) {
        const favoriteModels = JSON.parse(favoriteModelsData) as Record<string, string[]>;
        for (const [providerKey, models] of Object.entries(favoriteModels)) {
          // Clear existing favorites for this provider
          await database.execute(
            'DELETE FROM favorite_models WHERE provider_key = ?',
            [providerKey]
          );
          
          // Insert new favorites
          for (const modelId of models) {
            await database.execute(
              'INSERT OR IGNORE INTO favorite_models (provider_key, model_id) VALUES (?, ?)',
              [providerKey, modelId]
            );
          }
        }
      }

      // Migrate window geometry
      const windowGeometryData = localStorage.getItem(STORAGE_KEYS.windowGeometry);
      if (windowGeometryData) {
        await database.execute(
          'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime("now"))',
          ['window_geometry', windowGeometryData]
        );
      }

      console.log('Successfully migrated data from localStorage to SQL');
    } catch (error) {
      console.error('Failed to migrate from localStorage to SQL:', error);
      throw error;
    }
  }


  // Get setting by key
  async getSetting(key: string): Promise<string | null> {
    await this.init();
    const database = await getDatabase();
    
    try {
      const result = await database.select<{ value: string }[]>(
        'SELECT value FROM app_settings WHERE key = ?',
        [key]
      );
      return result.length > 0 ? result[0].value : null;
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return null;
    }
  }

  // Set setting by key
  async setSetting(key: string, value: string): Promise<void> {
    await this.init();
    const database = await getDatabase();
    
    try {
      await database.execute(
        'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime("now"))',
        [key, value]
      );
    } catch (error) {
      console.error(`Failed to set setting ${key}:`, error);
      throw error;
    }
  }

  // Delete setting by key
  async deleteSetting(key: string): Promise<void> {
    await this.init();
    const database = await getDatabase();
    
    try {
      await database.execute('DELETE FROM app_settings WHERE key = ?', [key]);
    } catch (error) {
      console.error(`Failed to delete setting ${key}:`, error);
    }
  }
}

// Create singleton instance
export const sqlStorage = new SqlStorage();

// Debug function to force re-run migration
export async function debugMigration(): Promise<void> {
  try {
    const database = await getDatabase();
    
    // Reset migration version to force re-run
    await database.execute('DELETE FROM migration_metadata WHERE key = ?', ['migration_version']);
    console.log('Reset migration version, will re-run on next init');
    
    // Re-run migration
    await sqlStorage.init();
  } catch (error) {
    console.error('Debug migration failed:', error);
  }
}

// Force localStorage migration right now
export async function forceLocalStorageMigration(): Promise<void> {
  try {
    console.log('Forcing localStorage migration...');
    await sqlStorage.migrateFromLocalStorageToSQL();
    localStorage.setItem('chatalyst_localStorage_migrated', 'true');
    console.log('localStorage migration completed');
  } catch (error) {
    console.error('Force migration failed:', error);
  }
}

// Convenience methods for specific data types
export async function loadConversations(): Promise<Conversation[]> {
  try {
    await sqlStorage.init();
    const database = await getDatabase();
    
    // Load conversations first
    const conversations = await database.select<{
      id: string;
      title: string;
      model: string;
      enabled_tools: string | null;
      archived: number;
      archived_at: string | null;
      created_at: string;
      updated_at: string;
    }[]>(
      'SELECT * FROM conversations ORDER BY updated_at DESC'
    );
    
    console.log(`Found ${conversations.length} conversations in database`);
    
    // Load messages for each conversation separately to avoid complex GROUP_CONCAT
    const result: Conversation[] = [];
    for (const conv of conversations) {
      const messages = await database.select<{
        id: string;
        conversation_id: string;
        role: string;
        content: string;
        timestamp: number;
        model: string | null;
        image_ids: string | null;
      }[]>(
        'SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC',
        [conv.id]
      );
      
      const processedMessages: Message[] = messages.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'tool' | 'system',
        content: msg.content,
        timestamp: msg.timestamp,
        model: msg.model || undefined,
        imageIds: msg.image_ids ? JSON.parse(msg.image_ids) : undefined
      }));
      
      result.push({
        id: conv.id,
        title: conv.title,
        model: conv.model,
        enabledTools: conv.enabled_tools ? JSON.parse(conv.enabled_tools) : undefined,
        messages: processedMessages,
        archived: Boolean(conv.archived),
        archivedAt: conv.archived_at ? new Date(conv.archived_at).getTime() : undefined,
        createdAt: new Date(conv.created_at).getTime(),
        updatedAt: new Date(conv.updated_at).getTime()
      });
    }
    
    console.log(`Loaded ${result.length} conversations with messages`);
    return result;
  } catch (error) {
    console.error('Failed to load conversations:', error);
    showError(`Failed to load conversations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  // Wait for any ongoing save operations to complete
  if (saveInProgress) {
    await new Promise<void>((resolve) => {
      saveQueue.push(resolve);
    });
  }
  
  saveInProgress = true;
  
  try {
    await saveConversationsInternal(conversations);
  } finally {
    saveInProgress = false;
    // Process queue
    const next = saveQueue.shift();
    if (next) next();
  }
}

async function saveConversationsInternal(conversations: Conversation[]): Promise<void> {
  // Wait for migration to complete
  while ((sqlStorage as any).migrationInProgress) {
    console.log('Waiting for migration to complete before saving...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Retry logic for database lock errors
  const maxRetries = 5; // Increased retries
  const retryDelay = 200; // Increased delay
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sqlStorage.init();
      const database = await getDatabase();
      
      // Check if we're already in a transaction to avoid nested transactions
      let inTransaction = false;
      try {
        // Add timeout for transaction start
        await Promise.race([
          database.execute('BEGIN IMMEDIATE TRANSACTION'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction start timeout')), 5000))
        ]);
        inTransaction = true;
      } catch (transactionError) {
        // If BEGIN fails, check if it's because we're already in a transaction
        const errorMsg = transactionError instanceof Error ? transactionError.message : String(transactionError);
        if (errorMsg.includes('cannot start a transaction within a transaction')) {
          console.log('Transaction already active, proceeding without new transaction');
        } else {
          // If it's a different error (like database locked), let it propagate
          throw transactionError;
        }
      }
      
      try {
        for (const conv of conversations) {
          // Save conversation
          await database.execute(
            `INSERT OR REPLACE INTO conversations 
             (id, title, model, enabled_tools, archived, archived_at, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, datetime(?, 'unixepoch', 'localtime'), datetime(?, 'unixepoch', 'localtime'))`,
            [
              conv.id,
              conv.title,
              conv.model,
              conv.enabledTools ? JSON.stringify(conv.enabledTools) : null,
              conv.archived ? 1 : 0,
              conv.archivedAt ? new Date(conv.archivedAt).toISOString() : null,
              (conv.createdAt / 1000).toString(),
              (conv.updatedAt / 1000).toString()
            ]
          );

          // Clear existing messages
          await database.execute(
            'DELETE FROM conversation_messages WHERE conversation_id = ?',
            [conv.id]
          );

          // Save messages
          if (conv.messages) {
            for (const message of conv.messages) {
              await database.execute(
                `INSERT INTO conversation_messages 
                 (id, conversation_id, role, content, timestamp, model, image_ids) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  message.id,
                  conv.id,
                  message.role,
                  message.content,
                  message.timestamp,
                  (message as unknown as { model?: string }).model || null,
                  message.imageIds ? JSON.stringify(message.imageIds) : null
                ]
              );
            }
          }
        }
        
        if (inTransaction) {
          await database.execute('COMMIT');
        }
        return; // Success, exit retry loop
        
      } catch (operationError) {
        if (inTransaction) {
          try {
            await database.execute('ROLLBACK');
          } catch (rollbackError) {
            console.error('Failed to rollback transaction:', rollbackError);
          }
        }
        throw operationError;
      }
      
    } catch (error) {
      console.error(`saveConversations attempt ${attempt} failed:`, error);
      
      // Check if it's a database lock error and we have retries left
      if (error instanceof Error && 
          error.message.includes('database is locked') && 
          attempt < maxRetries) {
        console.log(`Database locked, retrying in ${retryDelay * attempt}ms... (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        continue; // Retry
      }
      
      // If not a lock error or out of retries, show error and throw
      showError(`Failed to save conversations: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export async function loadSelectedConversationId(): Promise<string | null> {
  try {
    return await sqlStorage.getSetting('selected_conversation');
  } catch (error) {
    showError(`Failed to load selected conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

export async function saveSelectedConversationId(conversationId: string | null): Promise<void> {
  try {
    if (conversationId) {
      await sqlStorage.setSetting('selected_conversation', conversationId);
    } else {
      await sqlStorage.deleteSetting('selected_conversation');
    }
  } catch (error) {
    showError(`Failed to save selected conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function loadSettings(): Promise<Settings | null> {
  try {
    const settingsJson = await sqlStorage.getSetting('app_settings');
    return settingsJson ? JSON.parse(settingsJson) : null;
  } catch (error) {
    showError(`Failed to load settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await sqlStorage.setSetting('app_settings', JSON.stringify(settings));
  } catch (error) {
    showError(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function loadModelsCache(): Promise<Record<string, { models: Model[]; timestamp: number }> | null> {
  try {
    await sqlStorage.init();
    const database = await getDatabase();
    
    const cacheEntries = await database.select<{
      provider_key: string;
      models_data: string;
      timestamp: number;
    }[]>(
      'SELECT provider_key, models_data, timestamp FROM models_cache'
    );
    
    const cache: Record<string, { models: Model[]; timestamp: number }> = {};
    for (const entry of cacheEntries) {
      cache[entry.provider_key] = {
        models: JSON.parse(entry.models_data),
        timestamp: entry.timestamp
      };
    }
    
    return Object.keys(cache).length > 0 ? cache : null;
  } catch (error) {
    console.warn('Failed to load models cache:', error);
    return null;
  }
}

export async function saveModelsCache(cache: Map<string, { models: Model[]; timestamp: number }>): Promise<void> {
  try {
    await sqlStorage.init();
    const database = await getDatabase();
    
    for (const [providerKey, cacheData] of cache) {
      await database.execute(
        'INSERT OR REPLACE INTO models_cache (provider_key, models_data, timestamp, updated_at) VALUES (?, ?, ?, datetime("now"))',
        [providerKey, JSON.stringify(cacheData.models), cacheData.timestamp]
      );
    }
  } catch (error) {
    console.warn('Failed to save models cache:', error);
  }
}

export async function loadWindowGeometry(): Promise<{ width: number; height: number; x: number; y: number } | null> {
  try {
    const geometryJson = await sqlStorage.getSetting('window_geometry');
    return geometryJson ? JSON.parse(geometryJson) : null;
  } catch (error) {
    console.warn('Failed to load window geometry:', error);
    return null;
  }
}

export async function saveWindowGeometry(geometry: { width: number; height: number; x: number; y: number }): Promise<void> {
  try {
    await sqlStorage.setSetting('window_geometry', JSON.stringify(geometry));
  } catch (error) {
    console.warn('Failed to save window geometry:', error);
  }
}

export async function loadFavoriteModels(provider: string, baseURL: string): Promise<string[]> {
  try {
    await sqlStorage.init();
    const database = await getDatabase();
    
    const providerKey = `${provider}:${baseURL}`;
    const favorites = await database.select<{ model_id: string }[]>(
      'SELECT model_id FROM favorite_models WHERE provider_key = ? ORDER BY created_at',
      [providerKey]
    );
    
    return favorites.map(f => f.model_id);
  } catch (error) {
    console.warn('Failed to load favorite models:', error);
    return [];
  }
}

export async function saveFavoriteModels(provider: string, baseURL: string, favoriteModels: string[]): Promise<void> {
  try {
    await sqlStorage.init();
    const database = await getDatabase();
    
    const providerKey = `${provider}:${baseURL}`;
    
    // Clear existing favorites for this provider
    await database.execute(
      'DELETE FROM favorite_models WHERE provider_key = ?',
      [providerKey]
    );
    
    // Insert new favorites
    for (const modelId of favoriteModels) {
      await database.execute(
        'INSERT INTO favorite_models (provider_key, model_id) VALUES (?, ?)',
        [providerKey, modelId]
      );
    }
  } catch (error) {
    console.warn('Failed to save favorite models:', error);
  }
}