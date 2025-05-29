import { showError } from '../store';

export function handleAIError(error: unknown, _conversationId: string, _assistantMessageId: string): {
  shouldRemoveMessage: boolean;
  errorContent?: string;
  isToolError?: boolean;
} {
  const errorMsg = (error as Error)?.message || 'An error occurred';
  
  // Check if the error is about tools not being supported
  if (errorMsg.includes('does not support tools')) {
    return {
      shouldRemoveMessage: false,
      errorContent: `⚠️ ${errorMsg}\n\nYou can disable tools for this conversation in the MCP sidebar, or switch to a model that supports tools.`,
      isToolError: true
    };
  }
  
  // For other errors, show in error banner
  showError(errorMsg);
  return {
    shouldRemoveMessage: true
  };
}