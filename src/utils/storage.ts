import type { Conversation } from '../types';
import { showError } from '../store';

const STORAGE_KEY = 'chatalyst_conversations';
const SELECTED_CONVERSATION_KEY = 'chatalyst_selected_conversation';

export function loadConversations(): Conversation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const conversations: Conversation[] = JSON.parse(data);
    
    // Migrate conversations without archived field - set them as active
    return conversations.map(conv => {
      if (conv.archived === undefined) {
        return { ...conv, archived: false };
      }
      return conv;
    });
  } catch (error) {
    showError(`Failed to load conversations from storage: ${error instanceof Error ? error.message : 'Unknown error'}. Your conversations may not be available.`);
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    showError(`Failed to save conversations to storage: ${error instanceof Error ? error.message : 'Unknown error'}. Your changes may not be persisted.`);
  }
}

export function loadSelectedConversationId(): string | null {
  try {
    return localStorage.getItem(SELECTED_CONVERSATION_KEY);
  } catch (error) {
    showError(`Failed to load selected conversation from storage: ${error instanceof Error ? error.message : 'Unknown error'}.`);
    return null;
  }
}

export function saveSelectedConversationId(conversationId: string | null): void {
  try {
    if (conversationId) {
      localStorage.setItem(SELECTED_CONVERSATION_KEY, conversationId);
    } else {
      localStorage.removeItem(SELECTED_CONVERSATION_KEY);
    }
  } catch (error) {
    showError(`Failed to save selected conversation to storage: ${error instanceof Error ? error.message : 'Unknown error'}.`);
  }
}