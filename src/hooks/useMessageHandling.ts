import { useState } from 'preact/hooks';
import { streamText, generateText } from 'ai';
import type { CoreMessage } from 'ai';
import type { Message, Conversation, PendingImage } from '../types';
import { 
  conversations,
  selectedConversation,
  settings,
  isStreaming,
  addMessage,
  updateMessage,
  clearError,
  showError,
  updateConversationSDKMessages,
  updateConversationTitle,
  generatingTitleFor,
  removeMessagesAfter
} from '../store';
import { createAIProvider } from '../utils/ai';
import { getActiveToolsForConversation } from '../utils/mcp';
import { createToolsObject } from '../utils/tools';
import { handleAIError } from '../utils/errors';
import { DEFAULT_MODEL, MAX_TOOL_STEPS } from '../constants/ai';
import { storeImage, getImage, createDataURL } from '../utils/images';

export function useMessageHandling() {
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const sendMessage = async (content: string, images?: PendingImage[]) => {
    const conversation = selectedConversation.value;
    if (!conversation || (!content.trim() && (!images || images.length === 0))) return;

    // Upload images first if any
    let imageIds: number[] = [];
    if (images && images.length > 0) {
      try {
        const uploadPromises = images.map(image => storeImage(image.file, conversation.id));
        const uploadedImages = await Promise.all(uploadPromises);
        imageIds = uploadedImages.map(img => img.id);
      } catch (error) {
        console.error('Failed to upload images:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
        showError(`Failed to upload images: ${errorMsg}`);
        return;
      }
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
      imageIds: imageIds.length > 0 ? imageIds : undefined
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

    // Declare fullContent outside try block so it's accessible in catch
    let fullContent = '';

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
      
      // Create user message content with images if any
      let messageContent: string | Array<any> = content;
      
      if (imageIds.length > 0) {
        // Get the stored images and convert to data URLs
        const imageDataUrls: string[] = [];
        for (const imageId of imageIds) {
          try {
            const imageData = await getImage(imageId);
            const dataUrl = createDataURL(imageData.data, imageData.mime_type);
            imageDataUrls.push(dataUrl);
          } catch (error) {
            console.error('Failed to get image for AI:', error);
          }
        }
        
        // Create message content with images
        const contentParts = [];
        if (content.trim()) {
          contentParts.push({ type: 'text', text: content });
        }
        imageDataUrls.forEach(dataUrl => {
          contentParts.push({
            type: 'image',
            image: dataUrl
          });
        });
        
        messageContent = contentParts;
      }
      
      conversationMessages.push({
        role: 'user',
        content: messageContent
      });
      
      // Track tool messages by ID to update them when results come in
      const toolMessagesMap = new Map<string, Message>();
      
      const result = await streamText({
        model: aiProvider(modelToUse),
        messages: conversationMessages,
        tools: toolsObject,
        maxSteps: MAX_TOOL_STEPS,
        system: 'You are a helpful assistant. Always provide a summary of any tool call results',
        abortSignal: controller.signal,
        onChunk: async ({ chunk }) => {
          if (chunk.type === 'tool-call') {
            // Create initial tool message when tool is called
            const toolMessage: Message = {
              id: `${Date.now()}-tool-${chunk.toolCallId}`,
              role: 'tool',
              content: 'Calling tool...',
              timestamp: Date.now(),
              toolName: chunk.toolName || 'unknown',
              toolCall: chunk.args,
              toolResult: undefined
            };
            toolMessagesMap.set(chunk.toolCallId, toolMessage);
            addMessage(conversation.id, toolMessage);
          } else if (chunk.type === 'tool-result') {
            // Update the tool message with the result
            const existingMessage = toolMessagesMap.get(chunk.toolCallId);
            if (existingMessage) {
              updateMessage(conversation.id, existingMessage.id, {
                content: JSON.stringify(chunk.result),
                toolResult: chunk.result
              });
            }
          }
        },
        onStepFinish: () => {
          // Step finished callback
        },
        onFinish: async ({ response }) => {
          conversationMessages.push(...response.messages);
          updateConversationSDKMessages(conversation.id, conversationMessages);
        }
      });
      
      // Stream the response
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
        
        if (part.type === 'text-delta') {
          fullContent += (part as { textDelta: string }).textDelta;
          updateMessage(conversation.id, assistantMessage.id, { content: fullContent });
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
        // User stopped the generation
        const currentContent = fullContent.trim();
        updateMessage(conversation.id, assistantMessage.id, { 
          isGenerating: false,
          content: currentContent ? `${currentContent}\n\n(Generation stopped)` : '(Generation stopped)'
        });
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
    if (abortController && !abortController.signal.aborted) {
      try {
        abortController.abort();
        // The streaming state will be cleared in the finally block of sendMessage
      } catch (error) {
        console.error('[stopGeneration] Error aborting:', error);
        // Ensure we still clean up state even if abort fails
        isStreaming.value = false;
        setAbortController(null);
      }
    }
  };

  const generateConversationTitle = async (conversationId: string) => {
    const conversation = conversations.value.find(c => c.id === conversationId);
    if (!conversation || conversation.messages.length === 0) return;

    // Set loading state
    generatingTitleFor.value = conversationId;

    try {
      // Get first few messages for context (up to 5 exchanges)
      const messagesToAnalyze = conversation.messages.slice(0, 10);
      
      // Build context from messages
      const conversationContext = messagesToAnalyze
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      // Create AI provider and generate title using default model for consistency
      const aiProvider = createAIProvider(settings.value);
      const modelToUse = settings.value.defaultModel || DEFAULT_MODEL;
      
      const result = await generateText({
        model: aiProvider(modelToUse),
        prompt: `Based on the following conversation, generate a brief 3-5 word title that captures the main topic. Respond with only the title, no additional text, quotes, or punctuation.

Conversation:
${conversationContext}

Title:`,
        temperature: 0.3, // Lower temperature for more consistent results
        maxTokens: 50,    // Sufficient tokens to avoid truncation issues
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0
      });

      const title = result.text?.trim();
      
      // Clean up the title - remove quotes, extra punctuation, etc.
      const cleanTitle = title?.replace(/^["']|["']$/g, '').replace(/[.!?]+$/, '').trim();
      
      // Update the conversation title if we got a valid response
      if (cleanTitle && cleanTitle.length > 0 && cleanTitle.length < 100) {
        updateConversationTitle(conversationId, cleanTitle);
      }
    } catch (error) {
      console.error('Failed to generate title:', error);
      // Silently fail - don't show error to user for title generation
    } finally {
      // Clear loading state
      generatingTitleFor.value = null;
    }
  };

  const retryMessage = async (userMessageId: string) => {
    const conversation = selectedConversation.value;
    if (!conversation) return;
    
    const userMessage = conversation.messages.find(m => m.id === userMessageId);
    if (!userMessage || userMessage.role !== 'user') return;
    
    // Remove all messages after this user message
    removeMessagesAfter(conversation.id, userMessage.timestamp);
    
    // Now generate a new response without adding a duplicate user message
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

    // Declare fullContent outside try block so it's accessible in catch
    let fullContent = '';

    try {
      addMessage(conversation.id, assistantMessage);

      // Call the AI with current settings and conversation model
      const aiProvider = createAIProvider(settings.value);
      const modelToUse = conversation.model || settings.value.defaultModel || DEFAULT_MODEL;
      
      // Get active tools for this conversation
      const activeTools = await getActiveToolsForConversation(conversation);
      const toolsObject = createToolsObject(activeTools);
      
      // For retry, always reconstruct conversation messages from scratch to ensure clean state
      const conversationMessages: CoreMessage[] = [];
      
      // Build messages from conversation history up to and including the retry point
      for (const msg of conversation.messages) {
        if (msg.timestamp > userMessage.timestamp) break;
        
        if (msg.role === 'user' || msg.role === 'assistant') {
          conversationMessages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }
      
      // Track tool messages by ID to update them when results come in
      const toolMessagesMap = new Map<string, Message>();
      
      
      const result = await streamText({
        model: aiProvider(modelToUse),
        messages: conversationMessages,
        tools: toolsObject,
        maxSteps: MAX_TOOL_STEPS,
        system: 'You are a helpful assistant. Always provide a summary of any tool call results',
        abortSignal: controller.signal,
        onChunk: async ({ chunk }) => {
          if (chunk.type === 'tool-call') {
            // Create initial tool message when tool is called
            const toolMessage: Message = {
              id: `${Date.now()}-tool-${chunk.toolCallId}`,
              role: 'tool',
              content: 'Calling tool...',
              timestamp: Date.now(),
              toolName: chunk.toolName || 'unknown',
              toolCall: chunk.args,
              toolResult: undefined
            };
            toolMessagesMap.set(chunk.toolCallId, toolMessage);
            addMessage(conversation.id, toolMessage);
          } else if (chunk.type === 'tool-result') {
            // Update the tool message with the result
            const existingMessage = toolMessagesMap.get(chunk.toolCallId);
            if (existingMessage) {
              updateMessage(conversation.id, existingMessage.id, {
                content: JSON.stringify(chunk.result),
                toolResult: chunk.result
              });
            }
          }
        },
        onStepFinish: () => {
          // Step finished callback
        },
        onFinish: async ({ response }) => {
          conversationMessages.push(...response.messages);
          updateConversationSDKMessages(conversation.id, conversationMessages);
        }
      });
      
      // Stream the response
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
        
        if (part.type === 'text-delta') {
          fullContent += (part as { textDelta: string }).textDelta;
          updateMessage(conversation.id, assistantMessage.id, { content: fullContent });
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
        // User stopped the generation
        const currentContent = fullContent.trim();
        updateMessage(conversation.id, assistantMessage.id, { 
          isGenerating: false,
          content: currentContent ? `${currentContent}\n\n(Generation stopped)` : '(Generation stopped)'
        });
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

  return { sendMessage, retryMessage, stopGeneration, generateConversationTitle };
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

