import { load, type Store } from '@tauri-apps/plugin-store';
import type { Conversation, Settings, Model } from '../types';
import { showError } from '../store';

// Storage keys
const STORAGE_KEYS = {
  conversations: 'chatalyst_conversations',
  selectedConversation: 'chatalyst_selected_conversation',
  settings: 'chatalyst-settings',
  modelsCache: 'chatalyst-models-cache',
  windowGeometry: 'chatalyst_window_geometry',
  migrationVersion: 'chatalyst_migration_version'
} as const;

// Current migration version
const CURRENT_MIGRATION_VERSION = 1;

// Storage interface for type safety
interface StorageData {
  [STORAGE_KEYS.conversations]: Conversation[];
  [STORAGE_KEYS.selectedConversation]: string | null;
  [STORAGE_KEYS.settings]: Settings;
  [STORAGE_KEYS.modelsCache]: Record<string, { models: Model[]; timestamp: number }>;
  [STORAGE_KEYS.windowGeometry]: { width: number; height: number; x: number; y: number };
  [STORAGE_KEYS.migrationVersion]: number;
}

// Enhanced storage implementation
class EnhancedStorage {
  private store: Store | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Initialize the store
  private async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // Load the store with auto-save enabled
        this.store = await load('chatalyst-store.json', { autoSave: true });
        this.isInitialized = true;
        
        // Run migration if needed
        await this.runMigration();
      } catch (error) {
        showError(`Failed to initialize enhanced storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    })();

    return this.initPromise;
  }

  // Migration logic to move data from localStorage to Tauri Store
  private async runMigration(): Promise<void> {
    try {
      const currentVersion = await this.getRaw(STORAGE_KEYS.migrationVersion) || 0;
      
      if (currentVersion >= CURRENT_MIGRATION_VERSION) {
        return; // Already migrated
      }

      console.log('Running storage migration from localStorage to Tauri Store...');

      // Migrate each storage key
      const migratedKeys: string[] = [];

      for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
        if (key === 'migrationVersion') continue;

        try {
          // Check if data exists in localStorage
          const localData = localStorage.getItem(storageKey);
          if (localData !== null) {
            // Check if data already exists in Tauri Store
            const storeData = await this.getRaw(storageKey);
            if (storeData === null) {
              // Parse and migrate the data
              let parsedData;
              try {
                parsedData = JSON.parse(localData);
              } catch {
                // If parsing fails, store as string
                parsedData = localData;
              }

              await this.setRaw(storageKey, parsedData);
              migratedKeys.push(storageKey);
            }
          }
        } catch (error) {
          console.warn(`Failed to migrate ${storageKey}:`, error);
        }
      }

      // Set migration version
      await this.setRaw(STORAGE_KEYS.migrationVersion, CURRENT_MIGRATION_VERSION);

      if (migratedKeys.length > 0) {
        console.log(`Successfully migrated ${migratedKeys.length} storage keys:`, migratedKeys);
      }
    } catch (error) {
      console.error('Migration failed:', error);
      showError(`Storage migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generic get method with type safety
  private async getRaw<K extends keyof StorageData>(key: K): Promise<StorageData[K] | null> {
    await this.init();
    if (!this.store) {
      throw new Error('Store not initialized');
    }
    try {
      return await this.store.get(key) || null;
    } catch (error) {
      console.error(`Failed to get ${key} from storage:`, error);
      return null;
    }
  }

  // Generic set method with type safety
  private async setRaw<K extends keyof StorageData>(key: K, value: StorageData[K]): Promise<void> {
    await this.init();
    if (!this.store) {
      throw new Error('Store not initialized');
    }
    try {
      await this.store.set(key, value);
    } catch (error) {
      console.error(`Failed to set ${key} in storage:`, error);
      throw error;
    }
  }

  // Generic delete method
  private async deleteRaw<K extends keyof StorageData>(key: K): Promise<void> {
    await this.init();
    if (!this.store) {
      throw new Error('Store not initialized');
    }
    try {
      await this.store.delete(key);
    } catch (error) {
      console.error(`Failed to delete ${key} from storage:`, error);
      throw error;
    }
  }

  // Public API methods with fallback to localStorage
  async get<K extends keyof StorageData>(key: K): Promise<StorageData[K] | null> {
    try {
      return await this.getRaw(key);
    } catch (error) {
      // Fallback to localStorage
      console.warn(`Enhanced storage failed, falling back to localStorage for ${key}:`, error);
      try {
        const data = localStorage.getItem(key);
        if (data === null) return null;
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
  }

  async set<K extends keyof StorageData>(key: K, value: StorageData[K]): Promise<void> {
    try {
      await this.setRaw(key, value);
    } catch (error) {
      // Fallback to localStorage
      console.warn(`Enhanced storage failed, falling back to localStorage for ${key}:`, error);
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (fallbackError) {
        showError(`Failed to save data: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
        throw fallbackError;
      }
    }
  }

  async delete<K extends keyof StorageData>(key: K): Promise<void> {
    try {
      await this.deleteRaw(key);
    } catch (error) {
      // Fallback to localStorage
      console.warn(`Enhanced storage failed, falling back to localStorage for ${key}:`, error);
      try {
        localStorage.removeItem(key);
      } catch (fallbackError) {
        console.error('Failed to delete from localStorage:', fallbackError);
      }
    }
  }
}

// Create singleton instance
export const enhancedStorage = new EnhancedStorage();

// Convenience methods for specific data types
export async function loadConversations(): Promise<Conversation[]> {
  try {
    const conversations = await enhancedStorage.get(STORAGE_KEYS.conversations) || [];
    
    // Apply migration for conversations without archived field
    return conversations.map(conv => {
      if (conv.archived === undefined) {
        return { ...conv, archived: false };
      }
      return conv;
    });
  } catch (error) {
    showError(`Failed to load conversations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  try {
    await enhancedStorage.set(STORAGE_KEYS.conversations, conversations);
  } catch (error) {
    showError(`Failed to save conversations: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function loadSelectedConversationId(): Promise<string | null> {
  try {
    return await enhancedStorage.get(STORAGE_KEYS.selectedConversation);
  } catch (error) {
    showError(`Failed to load selected conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

export async function saveSelectedConversationId(conversationId: string | null): Promise<void> {
  try {
    if (conversationId) {
      await enhancedStorage.set(STORAGE_KEYS.selectedConversation, conversationId);
    } else {
      await enhancedStorage.delete(STORAGE_KEYS.selectedConversation);
    }
  } catch (error) {
    showError(`Failed to save selected conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function loadSettings(): Promise<Settings | null> {
  try {
    return await enhancedStorage.get(STORAGE_KEYS.settings);
  } catch (error) {
    showError(`Failed to load settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await enhancedStorage.set(STORAGE_KEYS.settings, settings);
  } catch (error) {
    showError(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function loadModelsCache(): Promise<Record<string, { models: Model[]; timestamp: number }> | null> {
  try {
    return await enhancedStorage.get(STORAGE_KEYS.modelsCache);
  } catch (error) {
    console.warn('Failed to load models cache:', error);
    return null;
  }
}

export async function saveModelsCache(cache: Map<string, { models: Model[]; timestamp: number }>): Promise<void> {
  try {
    // Convert Map to object for serialization
    const cacheObject = Object.fromEntries(cache);
    await enhancedStorage.set(STORAGE_KEYS.modelsCache, cacheObject as any);
  } catch (error) {
    console.warn('Failed to save models cache:', error);
  }
}

export async function loadWindowGeometry(): Promise<{ width: number; height: number; x: number; y: number } | null> {
  try {
    return await enhancedStorage.get(STORAGE_KEYS.windowGeometry);
  } catch (error) {
    console.warn('Failed to load window geometry:', error);
    return null;
  }
}

export async function saveWindowGeometry(geometry: { width: number; height: number; x: number; y: number }): Promise<void> {
  try {
    await enhancedStorage.set(STORAGE_KEYS.windowGeometry, geometry);
  } catch (error) {
    console.warn('Failed to save window geometry:', error);
  }
}