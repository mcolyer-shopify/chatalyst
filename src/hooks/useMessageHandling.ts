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
import { createAIProvider, createModelFunction, filterStreamTextOptionsForModel, addThinkingParameters } from '../utils/ai';
import { getActiveToolsForConversation } from '../utils/mcp';
import { createToolsObject, getBuiltinToolsForModel, createBuiltinToolsObject } from '../utils/tools';
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

    // Declare fullContent and thinking content outside try block so they're accessible in catch
    let fullContent = '';
    let thinkingContent = '';
    let thinkingMessageId: string | null = null;

    try {
      addMessage(conversation.id, assistantMessage);

      // Call the AI with current settings and conversation model
      const aiProvider = createAIProvider(settings.value);
      const modelToUse = conversation.model || settings.value.defaultModel || DEFAULT_MODEL;

      // Get active tools for this conversation
      const activeTools = await getActiveToolsForConversation(conversation);
      const toolsObject = createToolsObject(activeTools);

      // Get built-in tools if using OpenAI provider
      const providerType = aiProvider._providerType;
      const supportsBuiltinTools = providerType === 'openai';
      const builtinTools = supportsBuiltinTools
        ? getBuiltinToolsForModel(providerType, modelToUse, conversation.enabledBuiltinTools)
        : [];
      const builtinToolsObject = supportsBuiltinTools && builtinTools.length > 0
        ? createBuiltinToolsObject(builtinTools, aiProvider)
        : {};

      // Use SDK messages if available, otherwise create from scratch
      const conversationMessages: CoreMessage[] = conversation.sdkMessages || [];

      // Create user message content with images if any
      let messageContent: string | Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = content;

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
        const contentParts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [];
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

      // Combine MCP tools with built-in tools for responses API
      const combinedTools = supportsBuiltinTools && Object.keys(builtinToolsObject).length > 0
        ? { ...toolsObject, ...builtinToolsObject }
        : toolsObject;

      let streamTextOptions: Record<string, unknown> = {
        model: createModelFunction(aiProvider, modelToUse, settings.value.baseURL),
        messages: conversationMessages,
        tools: combinedTools,
        maxSteps: MAX_TOOL_STEPS,
        system: 'You are a helpful assistant. Always provide a summary of any tool call results',
        abortSignal: controller.signal
      };

      // Add thinking parameters if model supports them
      streamTextOptions = addThinkingParameters(modelToUse, conversation.thinkingAmount, streamTextOptions);

      const filteredOptions = filterStreamTextOptionsForModel(modelToUse, streamTextOptions);

      console.log('[DEBUG] Before streamText - model object:', streamTextOptions.model);
      console.log('[DEBUG] Before streamText - filtered options:', filteredOptions);

      const result = await streamText({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: streamTextOptions.model as any,
        messages: streamTextOptions.messages as CoreMessage[],
        ...(Object.fromEntries(Object.entries(filteredOptions).filter(([key]) => !['model', 'messages'].includes(key))) as Record<string, unknown>),
        onChunk: async ({ chunk }) => {
          if (chunk.type === 'tool-call') {
            // Create initial tool message when tool is called
            const toolMessage: Message = {
              id: `${Date.now()}-tool-${chunk.toolCallId}`,
              role: 'tool',
              content: 'Calling tool...',
              timestamp: Date.now(),
              toolName: chunk.toolName || 'unknown',
              toolCall: chunk.input,
              toolResult: undefined
            };
            toolMessagesMap.set(chunk.toolCallId, toolMessage);
            addMessage(conversation.id, toolMessage);
          } else if (chunk.type === 'tool-result') {
            // Update the tool message with the result
            const existingMessage = toolMessagesMap.get(chunk.toolCallId);
            if (existingMessage) {
              updateMessage(conversation.id, existingMessage.id, {
                content: JSON.stringify(chunk.output),
                toolResult: chunk.output
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
        console.log('[DEBUG] Stream chunk type:', part.type, part);

        if (part.type === 'error') {
          const errorResult = handleAIError((part as { error: unknown }).error, conversation.id, assistantMessage.id);

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

        // Handle reasoning/thinking block start
        if (part.type === 'reasoning-start') {
          thinkingMessageId = `${Date.now()}-thinking`;
          const thinkingMessage: Message = {
            id: thinkingMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isGenerating: true,
            isThinking: true,
            thinkingCollapsed: false
          };
          addMessage(conversation.id, thinkingMessage);
          continue;
        }

        // Handle reasoning content streaming
        if (part.type === 'reasoning-delta') {
          thinkingContent += (part as { text: string }).text;
          if (thinkingMessageId) {
            updateMessage(conversation.id, thinkingMessageId, { content: thinkingContent });
          }
          continue;
        }

        // Handle reasoning block end
        if (part.type === 'reasoning-end') {
          if (thinkingMessageId) {
            updateMessage(conversation.id, thinkingMessageId, {
              isGenerating: false,
              thinkingCollapsed: true
            });
          }
          continue;
        }

        // Skip other stream lifecycle events that don't need processing
        if (part.type === 'start' || part.type === 'start-step' || part.type === 'text-start' || part.type === 'text-end') {
          continue;
        }

        if (part.type === 'text-delta') {
          const textContent = (part as { text: string }).text;
          fullContent += textContent;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: createModelFunction(aiProvider, modelToUse, settings.value.baseURL) as any,
        prompt: `Based on the following conversation, generate a brief 3-5 word title that captures the main topic. Respond with only the title, no additional text, quotes, or punctuation.

Conversation:
${conversationContext}

Title:`
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

    // Declare fullContent and thinking content outside try block so they're accessible in catch
    let fullContent = '';
    let thinkingContent = '';
    let thinkingMessageId: string | null = null;

    try {
      addMessage(conversation.id, assistantMessage);

      // Call the AI with current settings and conversation model
      const aiProvider = createAIProvider(settings.value);
      const modelToUse = conversation.model || settings.value.defaultModel || DEFAULT_MODEL;

      // Get active tools for this conversation
      const activeTools = await getActiveToolsForConversation(conversation);
      const toolsObject = createToolsObject(activeTools);

      // Get built-in tools if using OpenAI provider
      const providerType = aiProvider._providerType;
      const supportsBuiltinTools = providerType === 'openai';
      const builtinTools = supportsBuiltinTools 
        ? getBuiltinToolsForModel(providerType, modelToUse, conversation.enabledBuiltinTools)
        : [];
      const builtinToolsObject = supportsBuiltinTools && builtinTools.length > 0
        ? createBuiltinToolsObject(builtinTools, aiProvider)
        : {};
      
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
      
      // Combine MCP tools with built-in tools for responses API
      const combinedTools = supportsBuiltinTools && Object.keys(builtinToolsObject).length > 0
        ? { ...toolsObject, ...builtinToolsObject }
        : toolsObject;

      let streamTextOptions: Record<string, unknown> = {
        model: createModelFunction(aiProvider, modelToUse, settings.value.baseURL),
        messages: conversationMessages,
        tools: combinedTools,
        maxSteps: MAX_TOOL_STEPS,
        system: 'You are a helpful assistant. Always provide a summary of any tool call results',
        abortSignal: controller.signal
      };

      // Add thinking parameters if model supports them
      streamTextOptions = addThinkingParameters(modelToUse, conversation.thinkingAmount, streamTextOptions);

      const filteredOptions = filterStreamTextOptionsForModel(modelToUse, streamTextOptions);

      console.log('[DEBUG] Before streamText - model object:', streamTextOptions.model);
      console.log('[DEBUG] Before streamText - filtered options:', filteredOptions);

      const result = await streamText({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: streamTextOptions.model as any,
        messages: streamTextOptions.messages as CoreMessage[],
        ...(Object.fromEntries(Object.entries(filteredOptions).filter(([key]) => !['model', 'messages'].includes(key))) as Record<string, unknown>),
        onChunk: async ({ chunk }) => {
          if (chunk.type === 'tool-call') {
            // Create initial tool message when tool is called
            const toolMessage: Message = {
              id: `${Date.now()}-tool-${chunk.toolCallId}`,
              role: 'tool',
              content: 'Calling tool...',
              timestamp: Date.now(),
              toolName: chunk.toolName || 'unknown',
              toolCall: chunk.input,
              toolResult: undefined
            };
            toolMessagesMap.set(chunk.toolCallId, toolMessage);
            addMessage(conversation.id, toolMessage);
          } else if (chunk.type === 'tool-result') {
            // Update the tool message with the result
            const existingMessage = toolMessagesMap.get(chunk.toolCallId);
            if (existingMessage) {
              updateMessage(conversation.id, existingMessage.id, {
                content: JSON.stringify(chunk.output),
                toolResult: chunk.output
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
        console.log('[DEBUG] Stream chunk type:', part.type, part);

        if (part.type === 'error') {
          const errorResult = handleAIError((part as { error: unknown }).error, conversation.id, assistantMessage.id);

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

        // Handle reasoning/thinking block start
        if (part.type === 'reasoning-start') {
          thinkingMessageId = `${Date.now()}-thinking`;
          const thinkingMessage: Message = {
            id: thinkingMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isGenerating: true,
            isThinking: true,
            thinkingCollapsed: false
          };
          addMessage(conversation.id, thinkingMessage);
          continue;
        }

        // Handle reasoning content streaming
        if (part.type === 'reasoning-delta') {
          thinkingContent += (part as { text: string }).text;
          if (thinkingMessageId) {
            updateMessage(conversation.id, thinkingMessageId, { content: thinkingContent });
          }
          continue;
        }

        // Handle reasoning block end
        if (part.type === 'reasoning-end') {
          if (thinkingMessageId) {
            updateMessage(conversation.id, thinkingMessageId, {
              isGenerating: false,
              thinkingCollapsed: true
            });
          }
          continue;
        }

        // Skip other stream lifecycle events that don't need processing
        if (part.type === 'start' || part.type === 'start-step' || part.type === 'text-start' || part.type === 'text-end') {
          continue;
        }

        if (part.type === 'text-delta') {
          const textContent = (part as { text: string }).text;
          fullContent += textContent;
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

