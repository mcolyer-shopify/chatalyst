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
  saveConversations,
  loadSelectedConversationId,
  saveSelectedConversationId,
  loadSettings,
  saveSettings,
  loadModelsCache,
  saveModelsCache
} from '../utils/enhancedStorage';

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
  } catch (error) {
    console.error('Failed to initialize from storage:', error);
  }

  // Mark as initialized after loading data
  isInitialized = true;
}

// Auto-save to enhanced storage (only after initialization)
effect(() => {
  // Always access .value to ensure subscription
  const conversationsData = conversations.value;
  if (isInitialized) {
    saveConversations(conversationsData);
  }
});

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

// Actions
export function createConversation(
  title: string,
  model?: string
): ConversationType {
  const newConversation: ConversationType = {
    id: Date.now().toString(),
    title,
    model: model || settings.value.defaultModel,
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

export function deleteConversation(id: string) {
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
}

export function archiveConversation(id: string) {
  batch(() => {
    conversations.value = conversations.value.map((c) =>
      c.id === id ? { ...c, archived: true, archivedAt: Date.now(), updatedAt: Date.now() } : c
    );
    
    // If archiving the selected conversation, select another active one
    if (selectedConversationId.value === id) {
      const activeConversations = conversations.value.filter(c => !c.archived && c.id !== id);
      selectedConversationId.value = activeConversations.length > 0 ? activeConversations[0].id : null;
    }
  });
}

export function unarchiveConversation(id: string) {
  conversations.value = conversations.value.map((c) =>
    c.id === id ? { ...c, archived: false, archivedAt: undefined, updatedAt: Date.now() } : c
  );
}

export function updateConversationTitle(id: string, title: string) {
  conversations.value = conversations.value.map((c) =>
    c.id === id ? { ...c, title, updatedAt: Date.now() } : c
  );
}

export function updateConversationModel(id: string, model: string) {
  conversations.value = conversations.value.map((c) =>
    c.id === id ? { ...c, model, updatedAt: Date.now() } : c
  );
}

export function updateConversationSDKMessages(id: string, sdkMessages: CoreMessage[]) {
  conversations.value = conversations.value.map((c) =>
    c.id === id ? { ...c, sdkMessages, updatedAt: Date.now() } : c
  );
}

export function addMessage(conversationId: string, message: Message) {
  conversations.value = conversations.value.map((c) =>
    c.id === conversationId
      ? { ...c, messages: [...c.messages, message], updatedAt: Date.now() }
      : c
  );
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
  settings.value = { ...settings.value, ...updates };
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

// Initialize on module load
initializeFromStorage().catch(error => {
  console.error('Failed to initialize storage on module load:', error);
});
