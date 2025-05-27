import type { Conversation } from '../types';
import { showError } from '../store';

const STORAGE_KEY = 'chatalyst_conversations';

export function loadConversations(): Conversation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
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