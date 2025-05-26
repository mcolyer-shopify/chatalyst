import { signal, computed, effect, batch } from '@preact/signals';
import type { Conversation as ConversationType, Message, Settings } from '../types';

// Default settings
const DEFAULT_SETTINGS: Settings = {
  baseURL: '',
  apiKey: '',
  defaultModel: ''
};

// Core application state signals
export const conversations = signal<ConversationType[]>([]);
export const selectedConversationId = signal<string | null>(null);
export const settings = signal<Settings>(DEFAULT_SETTINGS);
export const isLoadingModels = signal(false);
export const isStreaming = signal(false);

// Model-related signals
export const modelsCache = signal<Map<string, { models: any[]; timestamp: number }>>(new Map());
export const availableModels = signal<any[]>([]);

// Computed values
export const selectedConversation = computed(() => 
  conversations.value.find(c => c.id === selectedConversationId.value)
);

export const defaultModel = computed(() => settings.value.defaultModel);

// Initialize from localStorage
function initializeFromStorage() {
  try {
    const savedConversations = localStorage.getItem('chatalyst-conversations');
    if (savedConversations) {
      conversations.value = JSON.parse(savedConversations);
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
  } catch (error) {
    // Silently fail if localStorage is not available
  }
}

// Auto-save to localStorage
effect(() => {
  localStorage.setItem('chatalyst-conversations', JSON.stringify(conversations.value));
});

effect(() => {
  localStorage.setItem('chatalyst-settings', JSON.stringify(settings.value));
});

effect(() => {
  const cacheObj = Object.fromEntries(modelsCache.value);
  localStorage.setItem('chatalyst-models-cache', JSON.stringify(cacheObj));
});

// Actions
export function createConversation(title: string, model?: string): ConversationType {
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
    conversations.value = conversations.value.filter(c => c.id !== id);
    if (selectedConversationId.value === id) {
      selectedConversationId.value = conversations.value.length > 0 ? conversations.value[0].id : null;
    }
  });
}

export function updateConversationTitle(id: string, title: string) {
  const conversation = conversations.value.find(c => c.id === id);
  if (conversation) {
    conversation.title = title;
    conversation.updatedAt = Date.now();
    conversations.value = [...conversations.value]; // Trigger update
  }
}

export function addMessage(conversationId: string, message: Message) {
  const conversation = conversations.value.find(c => c.id === conversationId);
  if (conversation) {
    conversation.messages.push(message);
    conversation.updatedAt = Date.now();
    conversations.value = [...conversations.value]; // Trigger update
  }
}

export function updateMessage(conversationId: string, messageId: string, updates: Partial<Message>) {
  const conversation = conversations.value.find(c => c.id === conversationId);
  if (conversation) {
    const message = conversation.messages.find(m => m.id === messageId);
    if (message) {
      Object.assign(message, updates);
      conversation.updatedAt = Date.now();
      conversations.value = [...conversations.value]; // Trigger update
    }
  }
}

export function updateSettings(updates: Partial<Settings>) {
  settings.value = { ...settings.value, ...updates };
}

export function getCachedModels(baseURL: string): any[] | null {
  const cached = modelsCache.value.get(baseURL);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutes
    return cached.models;
  }
  return null;
}

export function setCachedModels(baseURL: string, models: any[]) {
  const newCache = new Map(modelsCache.value);
  newCache.set(baseURL, { models, timestamp: Date.now() });
  modelsCache.value = newCache;
}

// Initialize on module load
initializeFromStorage();