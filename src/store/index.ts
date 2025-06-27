import { signal, computed, effect, batch } from '@preact/signals';
import type { CoreMessage } from 'ai';
import type {
  Conversation as ConversationType,
  Message,
  Settings,
  Model,
  MCPServerStatus
} from '../types';
import {
  loadConversations,
  loadSelectedConversationId,
  saveSelectedConversationId,
  loadSettings,
  saveSettings,
  loadModelsCache,
  saveModelsCache,
  loadFavoriteModels,
  saveFavoriteModels,
  deleteConversationFromDB,
  saveSingleConversation
} from '../utils/sqlStorage';
import { deleteConversationImages, cleanupOrphanedImages } from '../utils/images';

// Default settings
const DEFAULT_SETTINGS: Settings = {
  provider: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '',
  defaultModel: '',
  mcpConfiguration: ''
};

// Flag to track initialization
let isInitialized = false;

// Core application state signals
export const conversations = signal<ConversationType[]>([]);
export const selectedConversationId = signal<string | null>(null);
export const settings = signal<Settings>(DEFAULT_SETTINGS);
export const isLoadingModels = signal(false);
export const isStreaming = signal(false);
export const generatingTitleFor = signal<string | null>(null);

// Error state signals
export const errorMessage = signal<string | null>(null);
export const errorTimestamp = signal<number | null>(null);

// Model-related signals
export const modelsCache = signal<
  Map<string, { models: Model[]; timestamp: number }>
>(new Map());
export const availableModels = signal<Model[]>([]);
export const favoriteModels = signal<string[]>([]);
export const failedModelFetchCache = signal<
  Map<string, { error: string; timestamp: number }>
>(new Map());

// MCP-related signals
export const mcpServers = signal<MCPServerStatus[]>([]);

// Computed values
export const selectedConversation = computed(() =>
  conversations.value.find((c) => c.id === selectedConversationId.value)
);

export const defaultModel = computed(() => settings.value.defaultModel);

// Initialize from enhanced storage
async function initializeFromStorage() {
  try {
    // Load conversations using enhanced storage
    conversations.value = await loadConversations();
    
    // Load selected conversation ID and validate it exists
    const savedSelectedId = await loadSelectedConversationId();
    if (savedSelectedId && conversations.value.some(c => c.id === savedSelectedId)) {
      selectedConversationId.value = savedSelectedId;
    }

    // Load settings using enhanced storage
    const savedSettings = await loadSettings();
    if (savedSettings) {
      // Migrate old settings without provider
      if (!savedSettings.provider) {
        // If there's a base URL set, assume it's custom, otherwise default to openrouter
        savedSettings.provider = savedSettings.baseURL ? 'custom' : 'openrouter';
        // Set default base URL for openrouter if not set
        if (savedSettings.provider === 'openrouter' && !savedSettings.baseURL) {
          savedSettings.baseURL = 'https://openrouter.ai/api/v1';
        }
      }
      settings.value = savedSettings;
    }

    // Load models cache using enhanced storage
    const savedModelsCache = await loadModelsCache();
    if (savedModelsCache) {
      // Convert back to Map if it's a plain object
      if (savedModelsCache instanceof Map) {
        modelsCache.value = savedModelsCache;
      } else {
        // It's a plain object, convert to Map
        modelsCache.value = new Map(Object.entries(savedModelsCache));
      }
    }

    // Load favorite models for current provider using enhanced storage
    const currentProvider = settings.value.provider;
    const currentBaseURL = settings.value.baseURL;
    if (currentProvider && currentBaseURL) {
      const savedFavoriteModels = await loadFavoriteModels(currentProvider, currentBaseURL);
      favoriteModels.value = savedFavoriteModels;
    }
  } catch (error) {
    console.error('Failed to initialize from storage:', error);
  }

  // Mark as initialized after loading data
  isInitialized = true;
}


effect(() => {
  // Always access .value to ensure subscription
  const selectedId = selectedConversationId.value;
  if (isInitialized) {
    saveSelectedConversationId(selectedId);
  }
});

effect(() => {
  // Always access .value to ensure subscription
  const settingsData = settings.value;
  if (isInitialized) {
    saveSettings(settingsData);
  }
});

effect(() => {
  // Always access .value to ensure subscription
  const cacheData = modelsCache.value;
  if (isInitialized) {
    saveModelsCache(cacheData);
  }
});

effect(() => {
  // Always access .value to ensure subscription
  const favoritesData = favoriteModels.value;
  const currentSettings = settings.value;
  if (isInitialized && currentSettings.provider && currentSettings.baseURL) {
    saveFavoriteModels(currentSettings.provider, currentSettings.baseURL, favoritesData);
  }
});

// Actions
export async function createConversation(
  title: string,
  model?: string
): Promise<ConversationType> {
  const newConversation: ConversationType = {
    id: Date.now().toString(),
    title,
    model: model || settings.value.defaultModel,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  try {
    // Save to database first
    await saveSingleConversation(newConversation);
    
    // Update memory state
    batch(() => {
      conversations.value = [...conversations.value, newConversation];
      selectedConversationId.value = newConversation.id;
    });
  } catch (error) {
    console.error('Failed to create conversation:', error);
    showError(`Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }

  return newConversation;
}

export function startFreshConversation(
  templateId: string,
  title?: string
): ConversationType | null {
  const templateConversation = conversations.value.find(c => c.id === templateId);
  if (!templateConversation) {
    return null;
  }

  const newConversation: ConversationType = {
    id: Date.now().toString(),
    title: title || 'Fresh start',
    model: templateConversation.model,
    enabledTools: templateConversation.enabledTools,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  batch(() => {
    conversations.value = [...conversations.value, newConversation];
    selectedConversationId.value = newConversation.id;
  });

  return newConversation;
}

export async function deleteConversation(id: string) {
  try {
    // Delete from database first
    await deleteConversationFromDB(id);
    
    // Delete associated images
    await deleteConversationImages(id);
    
    // Update memory state
    batch(() => {
      conversations.value = conversations.value.filter((c) => c.id !== id);
      if (selectedConversationId.value === id) {
        // Find first non-archived conversation, or any conversation if all are archived
        const activeConversations = conversations.value.filter(c => !c.archived);
        selectedConversationId.value =
          activeConversations.length > 0 ? activeConversations[0].id :
            conversations.value.length > 0 ? conversations.value[0].id : null;
      }
    });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    showError(`Failed to delete conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function archiveConversation(id: string) {
  const conversation = conversations.value.find(c => c.id === id);
  if (!conversation) return;
  
  const updatedConversation = {
    ...conversation,
    archived: true,
    archivedAt: Date.now(),
    updatedAt: Date.now()
  };
  
  try {
    // Save to database first
    await saveSingleConversation(updatedConversation);
    
    // Update memory state
    batch(() => {
      conversations.value = conversations.value.map((c) =>
        c.id === id ? updatedConversation : c
      );
      
      // If archiving the selected conversation, select another active one
      if (selectedConversationId.value === id) {
        const activeConversations = conversations.value.filter(c => !c.archived && c.id !== id);
        selectedConversationId.value = activeConversations.length > 0 ? activeConversations[0].id : null;
      }
    });
  } catch (error) {
    console.error('Failed to archive conversation:', error);
    showError(`Failed to archive conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function unarchiveConversation(id: string) {
  conversations.value = conversations.value.map((c) =>
    c.id === id ? { ...c, archived: false, archivedAt: undefined, updatedAt: Date.now() } : c
  );
}

export async function updateConversationTitle(id: string, title: string) {
  const conversation = conversations.value.find(c => c.id === id);
  if (!conversation) return;
  
  const updatedConversation = { ...conversation, title, updatedAt: Date.now() };
  
  try {
    // Save to database first
    await saveSingleConversation(updatedConversation);
    
    // Update memory state
    conversations.value = conversations.value.map((c) =>
      c.id === id ? updatedConversation : c
    );
  } catch (error) {
    console.error('Failed to update conversation title:', error);
    showError(`Failed to update title: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function updateConversationModel(id: string, model: string) {
  const conversation = conversations.value.find(c => c.id === id);
  if (!conversation) return;
  
  const updatedConversation = { ...conversation, model, updatedAt: Date.now() };
  
  try {
    // Save to database first
    await saveSingleConversation(updatedConversation);
    
    // Update memory state
    conversations.value = conversations.value.map((c) =>
      c.id === id ? updatedConversation : c
    );
  } catch (error) {
    console.error('Failed to update conversation model:', error);
    showError(`Failed to update model: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function updateConversationSDKMessages(id: string, sdkMessages: CoreMessage[]) {
  conversations.value = conversations.value.map((c) =>
    c.id === id ? { ...c, sdkMessages, updatedAt: Date.now() } : c
  );
}

export async function addMessage(conversationId: string, message: Message) {
  const conversation = conversations.value.find(c => c.id === conversationId);
  if (!conversation) return;
  
  const updatedConversation = {
    ...conversation,
    messages: [...conversation.messages, message],
    updatedAt: Date.now()
  };
  
  // Update memory state immediately for UI responsiveness
  conversations.value = conversations.value.map((c) =>
    c.id === conversationId ? updatedConversation : c
  );
  
  // Save to database asynchronously (don't block UI)
  saveSingleConversation(updatedConversation).catch(error => {
    console.error('Failed to save message:', error);
    // Don't show error for every message, just log it
  });
}

export function updateMessage(
  conversationId: string,
  messageId: string,
  updates: Partial<Message>
) {
  conversations.value = conversations.value.map((c) =>
    c.id === conversationId
      ? {
        ...c,
        messages: c.messages.map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
        updatedAt: Date.now()
      }
      : c
  );
}

export function removeMessagesAfter(conversationId: string, timestamp: number) {
  conversations.value = conversations.value.map((c) =>
    c.id === conversationId
      ? {
        ...c,
        messages: c.messages.filter((m) => m.timestamp <= timestamp),
        sdkMessages: c.sdkMessages?.filter((_, index) => {
          // Keep SDK messages up to and including the user message at the given timestamp
          const messageAtTimestamp = c.messages.find(m => m.timestamp === timestamp);
          const messageIndex = c.messages.findIndex(m => m.timestamp === timestamp);
          return messageAtTimestamp && index <= messageIndex;
        }),
        updatedAt: Date.now()
      }
      : c
  );
}

export function deleteMessage(conversationId: string, messageId: string) {
  conversations.value = conversations.value.map((c) => {
    if (c.id !== conversationId) return c;
    
    const targetMessage = c.messages.find(m => m.id === messageId);
    if (!targetMessage) return c;
    
    return {
      ...c,
      messages: c.messages.filter((m) => m.timestamp < targetMessage.timestamp),
      sdkMessages: c.sdkMessages?.filter((_, index) => {
        // Keep SDK messages up to but excluding the target message
        const messageIndex = c.messages.findIndex(m => m.id === messageId);
        return messageIndex !== -1 && index < messageIndex;
      }),
      updatedAt: Date.now()
    };
  });
}

export function updateSettings(updates: Partial<Settings>) {
  const oldSettings = settings.value;
  const newSettings = { ...oldSettings, ...updates };
  
  // Check if provider or baseURL changed
  const providerChanged = updates.provider && updates.provider !== oldSettings.provider;
  const baseURLChanged = updates.baseURL && updates.baseURL !== oldSettings.baseURL;
  
  settings.value = newSettings;
  
  // Load favorites for new provider/baseURL combination
  if ((providerChanged || baseURLChanged) && newSettings.provider && newSettings.baseURL) {
    loadFavoriteModelsForProvider(newSettings.provider, newSettings.baseURL);
  }
}

async function loadFavoriteModelsForProvider(provider: string, baseURL: string) {
  try {
    const savedFavoriteModels = await loadFavoriteModels(provider, baseURL);
    favoriteModels.value = savedFavoriteModels;
  } catch (error) {
    console.error('Failed to load favorites for provider:', error);
    favoriteModels.value = [];
  }
}

export function getCachedModels(baseURL: string): Model[] | null {
  const cached = modelsCache.value.get(baseURL);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    // 5 minutes
    return cached.models;
  }
  return null;
}

export function setCachedModels(baseURL: string, models: Model[]) {
  const newCache = new Map(modelsCache.value);
  newCache.set(baseURL, { models, timestamp: Date.now() });
  modelsCache.value = newCache;
  
  // Clear any failed fetch cache for this URL
  const newFailedCache = new Map(failedModelFetchCache.value);
  newFailedCache.delete(baseURL);
  failedModelFetchCache.value = newFailedCache;
}

export function getFailedFetchError(baseURL: string): string | null {
  const failed = failedModelFetchCache.value.get(baseURL);
  // Consider failed fetch cache valid for 1 minute
  if (failed && Date.now() - failed.timestamp < 60 * 1000) {
    return failed.error;
  }
  return null;
}

export function setFailedFetch(baseURL: string, error: string) {
  const newCache = new Map(failedModelFetchCache.value);
  newCache.set(baseURL, { error, timestamp: Date.now() });
  failedModelFetchCache.value = newCache;
}

export function toggleFavoriteModel(modelId: string) {
  const currentFavorites = favoriteModels.value;
  if (currentFavorites.includes(modelId)) {
    favoriteModels.value = currentFavorites.filter(id => id !== modelId);
  } else {
    favoriteModels.value = [...currentFavorites, modelId];
  }
}

export function isFavoriteModel(modelId: string): boolean {
  return favoriteModels.value.includes(modelId);
}

// Error handling functions
export function showError(message: string) {
  batch(() => {
    errorMessage.value = message;
    errorTimestamp.value = Date.now();
  });
}

export function clearError() {
  batch(() => {
    errorMessage.value = null;
    errorTimestamp.value = null;
  });
}

// MCP server management functions
export function updateMCPServerStatus(serverId: string, updates: Partial<MCPServerStatus>) {
  mcpServers.value = mcpServers.value.map(server =>
    server.id === serverId ? { ...server, ...updates } : server
  );
}

export function addMCPServer(server: MCPServerStatus) {
  mcpServers.value = [...mcpServers.value, server];
}

export function removeMCPServer(serverId: string) {
  mcpServers.value = mcpServers.value.filter(server => server.id !== serverId);
}

export function clearMCPServers() {
  mcpServers.value = [];
}

export function toggleConversationTool(conversationId: string, serverId: string, toolName: string, enabled: boolean) {
  conversations.value = conversations.value.map(conv => {
    if (conv.id !== conversationId) return conv;
    
    const enabledTools = conv.enabledTools || {};
    const serverTools = enabledTools[serverId] || [];
    
    let updatedServerTools: string[];
    if (enabled) {
      // Add tool if not already enabled
      updatedServerTools = serverTools.includes(toolName) 
        ? serverTools 
        : [...serverTools, toolName];
    } else {
      // Remove tool
      updatedServerTools = serverTools.filter(t => t !== toolName);
    }
    
    return {
      ...conv,
      enabledTools: {
        ...enabledTools,
        [serverId]: updatedServerTools
      },
      updatedAt: Date.now()
    };
  });
}

export function enableAllServerTools(conversationId: string, serverId: string, tools: string[]) {
  conversations.value = conversations.value.map(conv => {
    if (conv.id !== conversationId) return conv;
    
    return {
      ...conv,
      enabledTools: {
        ...conv.enabledTools || {},
        [serverId]: tools
      },
      updatedAt: Date.now()
    };
  });
}

export function disableAllServerTools(conversationId: string, serverId: string) {
  conversations.value = conversations.value.map(conv => {
    if (conv.id !== conversationId) return conv;
    
    return {
      ...conv,
      enabledTools: {
        ...conv.enabledTools || {},
        [serverId]: []
      },
      updatedAt: Date.now()
    };
  });
}

export function enableAllToolsOnAllServers(conversationId: string) {
  conversations.value = conversations.value.map(conv => {
    if (conv.id !== conversationId) return conv;
    
    const enabledTools: Record<string, string[]> = {};
    
    // Enable all tools for each running server
    mcpServers.value.forEach(server => {
      if (server.status === 'running') {
        enabledTools[server.id] = server.tools.map(tool => tool.name);
      }
    });
    
    return {
      ...conv,
      enabledTools,
      updatedAt: Date.now()
    };
  });
}

// Periodic cleanup of orphaned images (every 10 minutes)
let cleanupInterval: number;

export function startImageCleanup() {
  // Clear any existing interval
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  
  // Run cleanup every 10 minutes
  cleanupInterval = setInterval(async () => {
    try {
      await cleanupOrphanedImages();
      // Silently clean up orphaned images
    } catch (error) {
      console.error('Failed to cleanup orphaned images:', error);
    }
  }, 10 * 60 * 1000); // 10 minutes
}

export function stopImageCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
}

// Initialize when DOM is ready to avoid import timing issues
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeFromStorage().catch(error => {
        console.error('Failed to initialize storage on module load:', error);
      }).finally(() => {
        // Start periodic cleanup after initialization
        startImageCleanup();
      });
    });
  } else {
    // DOM already loaded
    setTimeout(() => {
      initializeFromStorage().catch(error => {
        console.error('Failed to initialize storage on module load:', error);
      }).finally(() => {
        // Start periodic cleanup after initialization
        startImageCleanup();
      });
    }, 0);
  }
}
