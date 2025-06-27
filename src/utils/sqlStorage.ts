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

// Debug logging helper (disabled in production)
const DEBUG_LOGGING = false; // Set to true to enable debug logging

function debugLog(operation: string, details?: any) {
  if (!DEBUG_LOGGING) return;
  
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  if (details !== undefined) {
    console.log(`[${timestamp}] SQL_DEBUG: ${operation}`, details);
  } else {
    console.log(`[${timestamp}] SQL_DEBUG: ${operation}`);
  }
}

// Database instance (cached)
let db: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;

// Mutex to prevent concurrent save operations
let saveInProgress = false;
const saveQueue: Array<() => void> = [];

async function getDatabase(): Promise<Database> {
  if (db) {
    debugLog('DATABASE: Using cached database instance');
    return db;
  }
  
  if (dbInitPromise) {
    debugLog('DATABASE: Waiting for existing database initialization');
    return await dbInitPromise;
  }
  
  debugLog('DATABASE: Starting new database initialization');
  dbInitPromise = (async () => {
    debugLog('DATABASE: Loading sqlite:chatalyst.db');
    const database = await Database.load('sqlite:chatalyst.db');
    
    // Enable WAL mode for better concurrency
    try {
      debugLog('DATABASE: Setting SQLite pragmas for concurrency');
      await database.execute('PRAGMA journal_mode=WAL;');
      await database.execute('PRAGMA synchronous=NORMAL;');
      await database.execute('PRAGMA cache_size=1000;');
      await database.execute('PRAGMA temp_store=memory;');
      await database.execute('PRAGMA busy_timeout=5000;'); // 5 second timeout for locks
      debugLog('DATABASE: SQLite pragmas configured successfully');
    } catch (pragmaError) {
      debugLog('DATABASE: Failed to set pragmas', pragmaError);
      // Pragmas are optional optimizations, no need to warn
    }
    
    debugLog('DATABASE: Database initialization complete');
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

  get isMigrationInProgress(): boolean {
    return this.migrationInProgress;
  }

  // Initialize the storage
  async init(): Promise<void> {
    if (this.isInitialized) {
      debugLog('SQL_STORAGE: Already initialized, skipping');
      return;
    }
    if (this.initPromise) {
      debugLog('SQL_STORAGE: Waiting for existing initialization');
      return this.initPromise;
    }

    debugLog('SQL_STORAGE: Starting initialization');
    this.initPromise = (async () => {
      try {
        // Ensure database is ready
        debugLog('SQL_STORAGE: Ensuring database is ready');
        await getDatabase();
        this.isInitialized = true;
        debugLog('SQL_STORAGE: Database ready, running migration check');
        
        // Run migration if needed
        await this.runMigration();
        debugLog('SQL_STORAGE: Initialization complete');
      } catch (error) {
        debugLog('SQL_STORAGE: Initialization failed', error);
        showError(`Failed to initialize SQL storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    })();

    return this.initPromise;
  }

  // Migration logic to move data from tauri-store to SQL
  private async runMigration(): Promise<void> {
    debugLog('MIGRATION: Starting migration check');
    this.migrationInProgress = true;
    try {
      debugLog('MIGRATION: Getting database instance');
      const database = await getDatabase();
      
      // Check current migration version
      debugLog('MIGRATION: Checking current migration version');
      let versionResult: { value: string }[] = [];
      try {
        versionResult = await database.select<{ value: string }[]>(
          'SELECT value FROM migration_metadata WHERE key = ?',
          ['migration_version']
        );
        debugLog('MIGRATION: Found migration_metadata table');
      } catch {
        debugLog('MIGRATION: migration_metadata table does not exist yet (first run)');
        // This is expected for first run, no need to log
        versionResult = [];
      }
      
      const currentVersion = versionResult.length > 0 ? parseInt(versionResult[0].value) : 0;
      debugLog('MIGRATION: Current version', { currentVersion, targetVersion: CURRENT_MIGRATION_VERSION });
      
      if (currentVersion >= CURRENT_MIGRATION_VERSION) {
        debugLog('MIGRATION: Already up to date, skipping');
        return; // Already migrated
      }

      debugLog('MIGRATION: Migration needed, starting process');

      // Check if there's data in localStorage that needs direct migration to SQL
      debugLog('MIGRATION: Checking for localStorage data');
      const hasLocalStorage = Object.values(STORAGE_KEYS).some(key => 
        localStorage.getItem(key) !== null
      );
      debugLog('MIGRATION: localStorage check result', { hasLocalStorage, currentVersion });
      
      if (hasLocalStorage && currentVersion === 0) {
        debugLog('MIGRATION: Found localStorage data, starting direct migration to SQL');
        console.log('Migrating data to SQL storage...');
        await this.migrateFromLocalStorageToSQL();
        debugLog('MIGRATION: localStorage to SQL migration completed');
      } else if (hasLocalStorage) {
        debugLog('MIGRATION: localStorage data found but migration already completed');
      } else {
        debugLog('MIGRATION: No localStorage data found');
      }

      // Set migration version
      debugLog('MIGRATION: Setting migration version', CURRENT_MIGRATION_VERSION);
      await database.execute(
        'INSERT OR REPLACE INTO migration_metadata (key, value, updated_at) VALUES (?, ?, datetime("now"))',
        ['migration_version', CURRENT_MIGRATION_VERSION.toString()]
      );

      debugLog('MIGRATION: Migration completed successfully');
    } catch (error) {
      debugLog('MIGRATION: Migration failed', error);
      console.error('Migration failed:', error);
      showError(`Storage migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      debugLog('MIGRATION: Clearing migration in progress flag');
      this.migrationInProgress = false;
    }
  }

  // Direct migration: localStorage to SQL (skipping tauri-store)
  async migrateFromLocalStorageToSQL(): Promise<void> {
    const database = await getDatabase();

    try {
      // Migrate conversations
      const conversationsData = localStorage.getItem(STORAGE_KEYS.conversations);
      if (conversationsData) {
        const conversations = JSON.parse(conversationsData) as Conversation[];
        
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
    
    // Re-run migration
    await sqlStorage.init();
  } catch (error) {
    console.error('Debug migration failed:', error);
  }
}

// Force localStorage migration right now
export async function forceLocalStorageMigration(): Promise<void> {
  try {
    await sqlStorage.migrateFromLocalStorageToSQL();
    localStorage.setItem('chatalyst_localStorage_migrated', 'true');
  } catch (error) {
    console.error('Force migration failed:', error);
  }
}

// Targeted operation: Delete a specific conversation
export async function deleteConversationFromDB(conversationId: string): Promise<void> {
  debugLog('DELETE_CONVERSATION: Starting targeted delete', { conversationId });
  
  try {
    await sqlStorage.init();
    const database = await getDatabase();
    
    // Single delete operation - messages cascade delete automatically
    await database.execute(
      'DELETE FROM conversations WHERE id = ?',
      [conversationId]
    );
    
    debugLog('DELETE_CONVERSATION: Successfully deleted conversation', { conversationId });
  } catch (error) {
    debugLog('DELETE_CONVERSATION: Failed to delete', { conversationId, error });
    throw error;
  }
}

// Targeted operation: Save a single conversation (update or insert)
export async function saveSingleConversation(conversation: Conversation): Promise<void> {
  debugLog('SAVE_SINGLE_CONVERSATION: Starting targeted save', { conversationId: conversation.id });
  
  // Wait for migration to complete
  while (sqlStorage.isMigrationInProgress) {
    debugLog('SAVE_SINGLE_CONVERSATION: Migration in progress, waiting...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Retry logic for database lock errors
  const maxRetries = 3;
  const retryDelay = 200; // 200ms base delay
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    debugLog('SAVE_SINGLE_CONVERSATION: Starting attempt', { attempt, maxRetries, conversationId: conversation.id });
    try {
      await sqlStorage.init();
      const database = await getDatabase();
    
      // Check if we're already in a transaction to avoid nested transactions
      debugLog('SAVE_SINGLE_CONVERSATION: Attempting to start transaction');
      let inTransaction = false;
      try {
        await database.execute('BEGIN IMMEDIATE TRANSACTION');
        inTransaction = true;
        debugLog('SAVE_SINGLE_CONVERSATION: Transaction started successfully');
      } catch (transactionError) {
      // If BEGIN fails, check if it's because we're already in a transaction
        const errorMsg = transactionError instanceof Error ? transactionError.message : String(transactionError);
        debugLog('SAVE_SINGLE_CONVERSATION: Transaction start failed', { errorMsg });
        if (errorMsg.includes('cannot start a transaction within a transaction')) {
          debugLog('SAVE_SINGLE_CONVERSATION: Already in transaction, proceeding without new transaction');
        } else {
        // If it's a different error (like database locked), let it propagate
          debugLog('SAVE_SINGLE_CONVERSATION: Transaction error, propagating', transactionError);
          throw transactionError;
        }
      }
    
      try {
      // Update or insert the conversation
        await database.execute(
          `INSERT OR REPLACE INTO conversations 
         (id, title, model, enabled_tools, archived, archived_at, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, datetime(?, 'unixepoch', 'localtime'), datetime(?, 'unixepoch', 'localtime'))`,
          [
            conversation.id,
            conversation.title,
            conversation.model,
            conversation.enabledTools ? JSON.stringify(conversation.enabledTools) : null,
            conversation.archived ? 1 : 0,
            conversation.archivedAt ? new Date(conversation.archivedAt).toISOString() : null,
            (conversation.createdAt / 1000).toString(),
            (conversation.updatedAt / 1000).toString()
          ]
        );
      
        // Only update messages if they're provided
        if (conversation.messages) {
        // Delete existing messages
          await database.execute(
            'DELETE FROM conversation_messages WHERE conversation_id = ?',
            [conversation.id]
          );
        
          // Insert new messages
          for (const message of conversation.messages) {
            await database.execute(
              `INSERT INTO conversation_messages 
             (id, conversation_id, role, content, timestamp, model, image_ids, tool_name, tool_call, tool_result) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                message.id,
                conversation.id,
                message.role,
                message.content,
                message.timestamp,
                (message as unknown as { model?: string }).model || null,
                message.imageIds ? JSON.stringify(message.imageIds) : null,
                (message as unknown as { toolName?: string }).toolName || null,
                (message as unknown as { toolCall?: any }).toolCall ? JSON.stringify((message as unknown as { toolCall: any }).toolCall) : null,
                (message as unknown as { toolResult?: any }).toolResult ? JSON.stringify((message as unknown as { toolResult: any }).toolResult) : null
              ]
            );
          }
        }
      
        if (inTransaction) {
          await database.execute('COMMIT');
          debugLog('SAVE_SINGLE_CONVERSATION: Transaction committed');
        }
        debugLog('SAVE_SINGLE_CONVERSATION: Successfully saved', { conversationId: conversation.id });
      } catch (error) {
        if (inTransaction) {
          await database.execute('ROLLBACK');
          debugLog('SAVE_SINGLE_CONVERSATION: Transaction rolled back');
        }
        throw error;
      }
      
      // If we get here, the save was successful
      debugLog('SAVE_SINGLE_CONVERSATION: Save successful on attempt', { attempt, conversationId: conversation.id });
      return;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      debugLog('SAVE_SINGLE_CONVERSATION: Attempt failed', { 
        attempt, 
        maxRetries, 
        conversationId: conversation.id, 
        error: errorMsg 
      });
      
      // Check if it's a database lock error that we should retry
      if (attempt < maxRetries && (
        errorMsg.includes('database is locked') || 
        errorMsg.includes('SQLITE_BUSY') ||
        errorMsg.includes('database is locked')
      )) {
        const delay = retryDelay * attempt; // Exponential backoff
        debugLog('SAVE_SINGLE_CONVERSATION: Database lock detected, retrying', { 
          attempt, 
          delay, 
          conversationId: conversation.id 
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // Retry
      }
      
      // If it's the last attempt or not a retryable error, throw
      debugLog('SAVE_SINGLE_CONVERSATION: Failed to save after all attempts', { 
        conversationId: conversation.id, 
        finalAttempt: attempt, 
        error: errorMsg 
      });
      throw error;
    }
  }
}

// Convenience methods for specific data types
export async function loadConversations(): Promise<Conversation[]> {
  debugLog('LOAD_CONVERSATIONS: Starting load operation');
  try {
    debugLog('LOAD_CONVERSATIONS: Initializing SQL storage');
    await sqlStorage.init();
    debugLog('LOAD_CONVERSATIONS: Getting database instance');
    const database = await getDatabase();
    
    // Load conversations first
    debugLog('LOAD_CONVERSATIONS: Querying conversations table');
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
    
    debugLog('LOAD_CONVERSATIONS: Query complete', { conversationCount: conversations.length });
    
    // Load messages for each conversation separately to avoid complex GROUP_CONCAT
    const result: Conversation[] = [];
    debugLog('LOAD_CONVERSATIONS: Loading messages for each conversation');
    for (const conv of conversations) {
      debugLog('LOAD_CONVERSATIONS: Loading messages for conversation', { convId: conv.id });
      const messages = await database.select<{
        id: string;
        conversation_id: string;
        role: string;
        content: string;
        timestamp: number;
        model: string | null;
        image_ids: string | null;
        tool_name: string | null;
        tool_call: string | null;
        tool_result: string | null;
      }[]>(
        'SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC',
        [conv.id]
      );
      debugLog('LOAD_CONVERSATIONS: Messages loaded', { convId: conv.id, messageCount: messages.length });
      
      const processedMessages: Message[] = messages.map(msg => {
        const message: any = {
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'tool' | 'system',
          content: msg.content,
          timestamp: msg.timestamp,
          model: msg.model || undefined,
          imageIds: msg.image_ids ? JSON.parse(msg.image_ids) : undefined
        };
        
        // Add tool-specific fields for tool messages
        if (msg.role === 'tool') {
          if (msg.tool_name) message.toolName = msg.tool_name;
          if (msg.tool_call) {
            try {
              message.toolCall = JSON.parse(msg.tool_call);
            } catch (e) {
              debugLog('LOAD_CONVERSATIONS: Failed to parse tool_call JSON', { error: e, toolCall: msg.tool_call });
            }
          }
          if (msg.tool_result) {
            try {
              message.toolResult = JSON.parse(msg.tool_result);
            } catch (e) {
              debugLog('LOAD_CONVERSATIONS: Failed to parse tool_result JSON', { error: e, toolResult: msg.tool_result });
            }
          }
        }
        
        return message;
      });
      
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
    
    debugLog('LOAD_CONVERSATIONS: All conversations loaded successfully', { totalCount: result.length });
    return result;
  } catch (error) {
    debugLog('LOAD_CONVERSATIONS: Failed to load conversations', error);
    console.error('Failed to load conversations:', error);
    showError(`Failed to load conversations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

// Add a debounce mechanism for bulk saves
let saveTimer: number | null = null;
let pendingConversations: Conversation[] | null = null;

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  debugLog('SAVE_CONVERSATIONS: Request received', { 
    conversationCount: conversations.length
  });
  
  // Store the latest state
  pendingConversations = conversations;
  
  // Clear existing timer
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  
  // Debounce saves to avoid rapid successive writes
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (pendingConversations) {
      await saveConversationsDebounced(pendingConversations);
      pendingConversations = null;
    }
  }, 500) as unknown as number; // 500ms debounce
}

async function saveConversationsDebounced(conversations: Conversation[]): Promise<void> {
  debugLog('SAVE_CONVERSATIONS_DEBOUNCED: Starting debounced save', { 
    conversationCount: conversations.length, 
    saveInProgress, 
    queueLength: saveQueue.length 
  });
  
  // Wait for any ongoing save operations to complete
  if (saveInProgress) {
    debugLog('SAVE_CONVERSATIONS_DEBOUNCED: Another save in progress, queuing request');
    await new Promise<void>((resolve) => {
      saveQueue.push(resolve);
    });
    debugLog('SAVE_CONVERSATIONS_DEBOUNCED: Queue resolved, proceeding');
  }
  
  saveInProgress = true;
  debugLog('SAVE_CONVERSATIONS_DEBOUNCED: Starting save operation');
  
  try {
    await saveConversationsInternal(conversations);
    debugLog('SAVE_CONVERSATIONS_DEBOUNCED: Save operation completed successfully');
  } finally {
    saveInProgress = false;
    // Process queue
    const next = saveQueue.shift();
    if (next) {
      debugLog('SAVE_CONVERSATIONS_DEBOUNCED: Processing next queued request');
      next();
    } else {
      debugLog('SAVE_CONVERSATIONS_DEBOUNCED: No queued requests, save mutex released');
    }
  }
}

async function saveConversationsInternal(conversations: Conversation[]): Promise<void> {
  debugLog('SAVE_INTERNAL: Starting internal save operation');
  
  // Wait for migration to complete
  while (sqlStorage.isMigrationInProgress) {
    debugLog('SAVE_INTERNAL: Migration in progress, waiting...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  debugLog('SAVE_INTERNAL: Migration check passed, proceeding');
  
  // Retry logic for database lock errors
  const maxRetries = 5;
  const retryDelay = 500; // 500ms base delay, will increase with each attempt
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    debugLog('SAVE_INTERNAL: Starting attempt', { attempt, maxRetries });
    try {
      debugLog('SAVE_INTERNAL: Initializing SQL storage');
      await sqlStorage.init();
      debugLog('SAVE_INTERNAL: Getting database instance');
      const database = await getDatabase();
      
      // Check if we're already in a transaction to avoid nested transactions
      debugLog('SAVE_INTERNAL: Attempting to start transaction');
      let inTransaction = false;
      try {
        // Add timeout for transaction start
        await Promise.race([
          database.execute('BEGIN IMMEDIATE TRANSACTION'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction start timeout')), 5000))
        ]);
        inTransaction = true;
        debugLog('SAVE_INTERNAL: Transaction started successfully');
      } catch (transactionError) {
        // If BEGIN fails, check if it's because we're already in a transaction
        const errorMsg = transactionError instanceof Error ? transactionError.message : String(transactionError);
        debugLog('SAVE_INTERNAL: Transaction start failed', { errorMsg });
        if (errorMsg.includes('cannot start a transaction within a transaction')) {
          debugLog('SAVE_INTERNAL: Already in transaction, proceeding without new transaction');
        } else {
          // If it's a different error (like database locked), let it propagate
          debugLog('SAVE_INTERNAL: Transaction error, propagating', transactionError);
          throw transactionError;
        }
      }
      
      try {
        debugLog('SAVE_INTERNAL: Starting database operations', { conversationCount: conversations.length });
        
        // First, get all existing conversation IDs from the database
        debugLog('SAVE_INTERNAL: Getting existing conversation IDs');
        const existingConvs = await database.select<{ id: string }[]>(
          'SELECT id FROM conversations'
        );
        const existingIds = new Set(existingConvs.map(c => c.id));
        const currentIds = new Set(conversations.map(c => c.id));
        
        // Find conversations to delete (exist in DB but not in current array)
        const toDelete = [...existingIds].filter(id => !currentIds.has(id));
        debugLog('SAVE_INTERNAL: Conversations to delete', { count: toDelete.length, ids: toDelete });
        
        // Delete conversations that are no longer in the array
        if (toDelete.length > 0) {
          // Use a single DELETE statement with IN clause for better performance
          const placeholders = toDelete.map(() => '?').join(',');
          debugLog('SAVE_INTERNAL: Deleting conversations in batch');
          // Messages will be deleted automatically due to CASCADE
          await database.execute(
            `DELETE FROM conversations WHERE id IN (${placeholders})`,
            toDelete
          );
        }
        
        // Now save/update the existing conversations
        for (const conv of conversations) {
          debugLog('SAVE_INTERNAL: Saving conversation', { convId: conv.id, messageCount: conv.messages?.length || 0 });
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
          debugLog('SAVE_INTERNAL: Clearing existing messages for conversation', conv.id);
          await database.execute(
            'DELETE FROM conversation_messages WHERE conversation_id = ?',
            [conv.id]
          );

          // Save messages
          if (conv.messages) {
            debugLog('SAVE_INTERNAL: Saving messages', { convId: conv.id, messageCount: conv.messages.length });
            for (const message of conv.messages) {
              await database.execute(
                `INSERT INTO conversation_messages 
                 (id, conversation_id, role, content, timestamp, model, image_ids, tool_name, tool_call, tool_result) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  message.id,
                  conv.id,
                  message.role,
                  message.content,
                  message.timestamp,
                  (message as unknown as { model?: string }).model || null,
                  message.imageIds ? JSON.stringify(message.imageIds) : null,
                  (message as unknown as { toolName?: string }).toolName || null,
                  (message as unknown as { toolCall?: any }).toolCall ? JSON.stringify((message as unknown as { toolCall: any }).toolCall) : null,
                  (message as unknown as { toolResult?: any }).toolResult ? JSON.stringify((message as unknown as { toolResult: any }).toolResult) : null
                ]
              );
            }
          }
        }
        
        if (inTransaction) {
          debugLog('SAVE_INTERNAL: Committing transaction');
          await database.execute('COMMIT');
        } else {
          debugLog('SAVE_INTERNAL: No transaction to commit');
        }
        debugLog('SAVE_INTERNAL: All database operations completed successfully');
        return; // Success, exit retry loop
        
      } catch (operationError) {
        debugLog('SAVE_INTERNAL: Database operation failed', operationError);
        if (inTransaction) {
          try {
            debugLog('SAVE_INTERNAL: Rolling back transaction');
            await database.execute('ROLLBACK');
            debugLog('SAVE_INTERNAL: Transaction rolled back successfully');
          } catch (rollbackError) {
            debugLog('SAVE_INTERNAL: Rollback failed', rollbackError);
            console.error('Failed to rollback transaction:', rollbackError);
          }
        }
        throw operationError;
      }
      
    } catch (error) {
      debugLog('SAVE_INTERNAL: Attempt failed', { attempt, error });
      
      // Check if it's a database lock error and we have retries left
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('database is locked') && attempt < maxRetries) {
        const waitTime = retryDelay * attempt;
        debugLog('SAVE_INTERNAL: Database locked, scheduling retry', { attempt, maxRetries, waitTime });
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue; // Retry
      }
      
      // If not a lock error or out of retries, show error and throw
      debugLog('SAVE_INTERNAL: No more retries or non-retryable error', { attempt, maxRetries, error: errorMessage });
      showError(`Failed to save conversations: ${errorMessage}`);
      throw error;
    }
  }
  
  debugLog('SAVE_INTERNAL: All retry attempts exhausted');
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