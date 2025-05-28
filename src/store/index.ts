import { signal, computed, effect, batch } from '@preact/signals';
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
  saveSelectedConversationId
} from '../utils/storage';

// Default settings
const DEFAULT_SETTINGS: Settings = {
  baseURL: '',
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

// Error state signals
export const errorMessage = signal<string | null>(null);
export const errorTimestamp = signal<number | null>(null);

// Model-related signals
export const modelsCache = signal<
  Map<string, { models: Model[]; timestamp: number }>
>(new Map());
export const availableModels = signal<Model[]>([]);

// MCP-related signals
export const mcpServers = signal<MCPServerStatus[]>([]);
export const mcpToolSettings = signal<{ [serverId: string]: { [toolName: string]: boolean } }>({});

// Computed values
export const selectedConversation = computed(() =>
  conversations.value.find((c) => c.id === selectedConversationId.value)
);

export const defaultModel = computed(() => settings.value.defaultModel);

// Initialize from localStorage
function initializeFromStorage() {
  try {
    // Load conversations using utility function
    conversations.value = loadConversations();
    
    // Load selected conversation ID and validate it exists
    const savedSelectedId = loadSelectedConversationId();
    if (savedSelectedId && conversations.value.some(c => c.id === savedSelectedId)) {
      selectedConversationId.value = savedSelectedId;
    }

    const savedSettings = localStorage.getItem('chatalyst-settings');
    if (savedSettings) {
      settings.value = JSON.parse(savedSettings);
    }

    const savedModelsCache = localStorage.getItem('chatalyst-models-cache');
    if (savedModelsCache) {
      const parsed = JSON.parse(savedModelsCache);
      modelsCache.value = new Map(Object.entries(parsed));
    }
  } catch {
    // Silently fail if localStorage is not available
  }

  // Mark as initialized after loading data
  isInitialized = true;
}

// Auto-save to localStorage (only after initialization)
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
    localStorage.setItem('chatalyst-settings', JSON.stringify(settingsData));
  }
});

effect(() => {
  // Always access .value to ensure subscription
  const cacheData = modelsCache.value;
  if (isInitialized) {
    const cacheObj = Object.fromEntries(cacheData);
    localStorage.setItem('chatalyst-models-cache', JSON.stringify(cacheObj));
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

export function deleteConversation(id: string) {
  batch(() => {
    conversations.value = conversations.value.filter((c) => c.id !== id);
    if (selectedConversationId.value === id) {
      selectedConversationId.value =
        conversations.value.length > 0 ? conversations.value[0].id : null;
    }
  });
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

export function toggleMCPTool(serverId: string, toolName: string, enabled: boolean) {
  const currentSettings = mcpToolSettings.value;
  mcpToolSettings.value = {
    ...currentSettings,
    [serverId]: {
      ...currentSettings[serverId],
      [toolName]: enabled
    }
  };
}

// Initialize on module load
initializeFromStorage();
