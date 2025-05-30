import { useState } from 'preact/hooks';
import { streamText } from 'ai';
import type { CoreMessage } from 'ai';
import type { Message, Conversation } from '../types';
import { 
  conversations,
  selectedConversation,
  settings,
  isStreaming,
  addMessage,
  updateMessage,
  clearError,
  updateConversationSDKMessages
} from '../store';
import { createAIProvider } from '../utils/ai';
import { getActiveToolsForConversation } from '../utils/mcp';
import { createToolsObject } from '../utils/tools';
import { handleAIError } from '../utils/errors';
import { DEFAULT_MODEL, MAX_TOOL_STEPS } from '../constants/ai';

export function useMessageHandling() {
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const sendMessage = async (content: string) => {
    const conversation = selectedConversation.value;
    if (!conversation || !content.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now()
    };

    addMessage(conversation.id, userMessage);

    isStreaming.value = true;
    clearError();

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isGenerating: true
    };

    try {
      addMessage(conversation.id, assistantMessage);

      // Call the AI with current settings and conversation model
      const aiProvider = createAIProvider(settings.value);
      const modelToUse = conversation.model || settings.value.defaultModel || DEFAULT_MODEL;
      
      // Get active tools for this conversation
      const activeTools = await getActiveToolsForConversation(conversation);
      const toolsObject = createToolsObject(activeTools);
      
      // Use SDK messages if available, otherwise create from scratch
      const conversationMessages: CoreMessage[] = conversation.sdkMessages || [];      
      conversationMessages.push({
        role: 'user',
        content
      });
      
      const result = await streamText({
        model: aiProvider(modelToUse),
        messages: conversationMessages,
        tools: toolsObject,
        maxSteps: MAX_TOOL_STEPS,
        system: 'You are a helpful assistant. Always provide a summary of any tool call results',
        abortSignal: controller.signal,
        onStepFinish: () => {
          // Step finished callback
        },
        onFinish: async ({ response }) => {
          conversationMessages.push(...response.messages);
          console.log('[useMessageHandling] Full response messages:', conversationMessages);
          updateConversationSDKMessages(conversation.id, conversationMessages);
        }
      });
      
      // Stream the response
      let fullContent = '';
      
      for await (const part of result.fullStream) {
        console.log('[useMessageHandling] Stream part:', part);
        if (part.type === 'error') {
          const errorResult = handleAIError(part.error, conversation.id, assistantMessage.id);
          
          if (errorResult.errorContent) {
            updateMessage(conversation.id, assistantMessage.id, {
              content: errorResult.errorContent,
              isGenerating: false,
              isError: true
            });
          } else if (errorResult.shouldRemoveMessage) {
            removeAssistantMessage(conversation.id, assistantMessage.id);
          }
          break;
        }
        
        if (part.type === 'text-delta') {
          fullContent += (part as { textDelta: string }).textDelta;
          updateMessage(conversation.id, assistantMessage.id, { content: fullContent });
        } else if (part.type === 'tool-result') {
          // Create a tool message for UI display
          const toolMessage: Message = {
            id: `${Date.now()}-tool-${part.toolCallId}`,
            role: 'tool',
            content: JSON.stringify(part.result),
            timestamp: Date.now(),
            toolName: part.toolName || 'unknown',
            toolCall: part.args,
            toolResult: part.result
          };
          addMessage(conversation.id, toolMessage);
        } else if (part.type === 'finish') {
          await handleStreamFinish(
            part,
            fullContent,
            conversation,
            assistantMessage
          );
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        updateMessage(conversation.id, assistantMessage.id, { isGenerating: false });
      } else {
        const errorResult = handleAIError(err, conversation.id, assistantMessage.id);
        
        if (errorResult.errorContent) {
          updateMessage(conversation.id, assistantMessage.id, {
            content: errorResult.errorContent,
            isGenerating: false,
            isError: true
          });
        } else if (errorResult.shouldRemoveMessage) {
          removeAssistantMessage(conversation.id, assistantMessage.id);
        }
      }
    } finally {
      isStreaming.value = false;
      setAbortController(null);
    }
  };

  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
      isStreaming.value = false;
      setAbortController(null);
    }
  };

  return { sendMessage, stopGeneration };
}

// Helper functions
function removeAssistantMessage(conversationId: string, messageId: string) {
  conversations.value = conversations.value.map(c => 
    c.id === conversationId
      ? { ...c, messages: c.messages.filter(m => m.id !== messageId) }
      : c
  );
}

interface StreamFinishPart {
  finishReason?: string;
  type: string;
}

async function handleStreamFinish(
  part: StreamFinishPart,
  fullContent: string,
  conversation: Conversation,
  assistantMessage: Message
) {
  // Check if we finished with only tool calls and no text response
  if (part.finishReason === 'tool-calls' && fullContent.trim() === '') {
    removeAssistantMessage(conversation.id, assistantMessage.id);
  } else if (fullContent.trim() !== '') {
    // Normal finish with text content
    updateMessage(conversation.id, assistantMessage.id, { isGenerating: false });
  } else {
    // Empty message without tool calls - remove it
    removeAssistantMessage(conversation.id, assistantMessage.id);
  }
}

