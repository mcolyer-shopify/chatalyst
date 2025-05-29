import { useState } from 'preact/hooks';
import { streamText } from 'ai';
import type { Message, Conversation } from '../types';
import { 
  conversations,
  selectedConversation,
  settings,
  isStreaming,
  addMessage,
  updateMessage,
  clearError
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
      const messages = conversation.messages.concat([userMessage]);
      
      // Get active tools for this conversation
      const activeTools = await getActiveToolsForConversation(conversation);
      const toolsObject = createToolsObject(activeTools);
      
      // Filter out tool messages as they're handled internally by the SDK
      const conversationMessages = messages
        .filter(m => m.role !== 'tool')
        .map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content || ''
        }));
      
      const result = await streamText({
        model: aiProvider(modelToUse),
        messages: conversationMessages,
        // @ts-expect-error - AI SDK has incompatible tool types but works at runtime
        tools: toolsObject,
        maxSteps: MAX_TOOL_STEPS,
        system: 'You are a helpful assistant. Always provide a complete, natural language response to the user. Never end a conversation with a tool call',
        abortSignal: controller.signal,
        onStepFinish: () => {
          // Step finished callback
        }
      });
      
      // Stream the response
      let fullContent = '';
      
      for await (const part of result.fullStream) {
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
        
        if (part.type === 'text') {
          fullContent += (part as { text: string }).text;
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
            assistantMessage,
            modelToUse,
            aiProvider,
            controller
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
  assistantMessage: Message,
  modelToUse: string,
  aiProvider: ReturnType<typeof createAIProvider>,
  controller: AbortController
) {
  // Check if we finished with only tool calls and no text response
  if (part.finishReason === 'tool-calls' && fullContent.trim() === '') {
    removeAssistantMessage(conversation.id, assistantMessage.id);
    
    // Get the updated conversation with tool messages
    const updatedConversation = conversations.value.find(c => c.id === conversation.id);
    if (updatedConversation) {
      await generateFollowUpResponse(
        updatedConversation,
        modelToUse,
        aiProvider,
        controller
      );
    }
  } else if (fullContent.trim() !== '') {
    // Normal finish with text content
    updateMessage(conversation.id, assistantMessage.id, { isGenerating: false });
  } else {
    // Empty message without tool calls - remove it
    removeAssistantMessage(conversation.id, assistantMessage.id);
  }
}

async function generateFollowUpResponse(
  conversation: Conversation,
  modelToUse: string,
  aiProvider: ReturnType<typeof createAIProvider>,
  controller: AbortController
) {
  const followUpMessage: Message = {
    id: `${Date.now()}-assistant-followup`,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isGenerating: true
  };
  addMessage(conversation.id, followUpMessage);
  
  // Convert tool messages to assistant messages that describe the tool results
  const followUpMessages = conversation.messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'assistant' as const,
        content: `Tool ${m.toolName} returned: ${JSON.stringify(m.toolResult)}`
      };
    }
    return {
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content || ''
    };
  });
  
  const followUpResult = await streamText({
    model: aiProvider(modelToUse),
    messages: followUpMessages,
    system: 'You are a helpful assistant. Based on the tool results provided, give a natural language response to the user\'s question.',
    abortSignal: controller.signal
  });
  
  let followUpContent = '';
  for await (const chunk of followUpResult.textStream) {
    followUpContent += chunk;
    updateMessage(conversation.id, followUpMessage.id, { content: followUpContent });
  }
  updateMessage(conversation.id, followUpMessage.id, { isGenerating: false });
}
