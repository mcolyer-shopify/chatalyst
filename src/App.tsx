import { useState, useEffect } from 'preact/hooks';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, tool } from 'ai';
import { ConversationList } from './components/ConversationList';
import { Conversation } from './components/Conversation';
import { MCPSidebar } from './components/MCPSidebar';
import { SettingsModal } from './components/SettingsModal';
import { MCPSettingsModal } from './components/MCPSettingsModal';
import { listen } from '@tauri-apps/api/event';
import type { Message } from './types';
import { 
  conversations, 
  selectedConversationId, 
  selectedConversation,
  settings,
  isStreaming,
  errorMessage,
  createConversation,
  deleteConversation,
  updateConversationTitle,
  updateConversationModel,
  addMessage,
  updateMessage,
  updateSettings,
  showError,
  clearError
} from './store';
import { restoreWindowGeometry, setupWindowGeometryPersistence } from './utils/windowSize';
import { initializeMCPConnections, restartMCPConnections, shutdownMCPConnections, getActiveToolsForConversation, executeMCPTool } from './utils/mcp';
import './App.css';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showMcpSettings, setShowMcpSettings] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+N (macOS) or Ctrl+N (Windows/Linux) to create new conversation
      if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault();
        createNewConversation();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle window geometry persistence (size and position)
  useEffect(() => {
    // Restore window geometry on startup
    restoreWindowGeometry();

    // Setup window geometry persistence (resize and move listeners)
    let unlistenGeometry: (() => void) | null = null;

    setupWindowGeometryPersistence().then(unlisten => {
      unlistenGeometry = unlisten;
    });

    return () => {
      // Cleanup geometry listeners
      if (unlistenGeometry) {
        unlistenGeometry();
      }
    };
  }, []);

  // Initialize MCP connections on startup and cleanup on unmount
  useEffect(() => {
    // Initialize MCP connections with saved configuration
    initializeMCPConnections(settings.value.mcpConfiguration);

    // Listen for window close event to cleanup MCP connections
    const setupCloseListener = async () => {
      const unlisten = await listen('tauri://close-requested', async () => {
        await shutdownMCPConnections();
      });
      return unlisten;
    };

    let unlistenClose: (() => void) | null = null;
    setupCloseListener().then(unlisten => {
      unlistenClose = unlisten;
    });

    // Cleanup function to shutdown connections
    return () => {
      shutdownMCPConnections();
      if (unlistenClose) {
        unlistenClose();
      }
    };
  }, []);

  // Create AI provider with current settings
  const getAIProvider = () => {
    // Get the appropriate base URL based on provider
    let baseURL = settings.value.baseURL;
    let apiKey = settings.value.apiKey;
    
    // Use provider-specific defaults
    switch (settings.value.provider) {
    case 'openrouter':
      baseURL = baseURL || 'https://openrouter.ai/api/v1';
      apiKey = apiKey || 'openrouter'; // Default API key for OpenRouter
      break;
    case 'ollama':
      baseURL = baseURL || 'http://localhost:11434/v1';
      apiKey = ''; // Ollama doesn't need an API key
      break;
    case 'custom':
      // Use whatever is configured
      break;
    }
    
    return createOpenAICompatible({
      name: `${settings.value.provider}-ai-provider`,
      baseURL,
      apiKey
    });
  };

  const createNewConversation = () => {
    const title = `New Conversation ${conversations.value.length + 1}`;
    createConversation(title, settings.value.defaultModel);
  };

  const renameConversation = (id: string, newTitle: string) => {
    updateConversationTitle(id, newTitle);
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
  };

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
      const aiProvider = getAIProvider();
      const modelToUse = conversation.model || settings.value.defaultModel || 'gpt-4-turbo';
      const messages = conversation.messages.concat([userMessage]);
      
      // Get active tools for this conversation
      const activeTools = await getActiveToolsForConversation(conversation);
      
      if (activeTools.length > 0) {
        console.log('[AI] Active tools for conversation:', activeTools.map(t => t.name));
        console.log('[AI] Tool details:', activeTools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        })));
      } else {
        console.log('[AI] No active tools for this conversation');
      }
      
      const toolsObject = activeTools.length > 0 ? activeTools.reduce((acc, activeTool) => {
        acc[activeTool.name] = tool({
          description: activeTool.description || '',
          parameters: activeTool.parameters,
          execute: async (args: unknown) => {
            console.log(`[AI] Executing tool ${activeTool.name} with args:`, args);
            
            try {
              // Use the real MCP tool execution
              const result = await executeMCPTool(activeTool.name, args);
              console.log(`[AI] Tool ${activeTool.name} returned:`, result);
              return result;
            } catch (error) {
              console.error(`[AI] Tool ${activeTool.name} execution failed:`, error);
              throw error;
            }
          }
        });
        return acc;
      }, {} as Record<string, ReturnType<typeof tool>>) : undefined;
      
      console.log('[AI] Calling streamText with tools:', toolsObject ? Object.keys(toolsObject) : 'none');
      console.log('[AI] Messages being sent:', messages.map(m => ({ role: m.role, content: m.content.substring(0, 50) + '...', toolCalls: m.toolCalls, toolResult: m.toolResult })));

      // Use the AI SDK's built-in tool handling with maxSteps
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
        tools: toolsObject,
        maxSteps: 10, // Limit to 10 tool calls per turn
        system: 'You are a helpful assistant. Always provide a complete, natural language response to the user. If you use tools, incorporate the results into your response.',
        abortSignal: controller.signal,
        onStepFinish: (event) => {
          console.log('[AI] Step finished:', event);
        }
      });
      
      // Stream the response
      let fullContent = '';
      
      for await (const part of result.fullStream) {
        console.log('[AI] Stream part type:', part.type);
        
        if (part.type === 'error') {
          console.error('[AI] Stream error:', part.error);
          const errorMsg = part.error?.message || 'An error occurred';
          
          // Check if the error is about tools not being supported
          if (errorMsg.includes('does not support tools')) {
            // Update the assistant message with error content
            updateMessage(conversation.id, assistantMessage.id, {
              content: `⚠️ ${errorMsg}\n\nYou can disable tools for this conversation in the MCP sidebar, or switch to a model that supports tools.`,
              isGenerating: false,
              isError: true
            });
            break; // Exit the stream
          } else {
            // For other errors, show in error banner
            showError(errorMsg);
            // Remove the assistant message
            conversations.value = conversations.value.map(c => 
              c.id === conversation.id
                ? { ...c, messages: c.messages.filter(m => m.id !== assistantMessage.id) }
                : c
            );
            break; // Exit the stream
          }
        }
        
        if (part.type === 'text-delta') {
          console.log('[AI] Text delta:', part.textDelta);
          fullContent += part.textDelta;
          console.log('[AI] Full content so far:', fullContent);
          updateMessage(conversation.id, assistantMessage.id, { content: fullContent });
        } else if (part.type === 'text') {
          console.log('[AI] Text:', part.text);
          fullContent += part.text;
          console.log('[AI] Full content so far:', fullContent);
          updateMessage(conversation.id, assistantMessage.id, { content: fullContent });
        } else if (part.type === 'tool-call') {
          console.log('[AI] Tool call detected:', part);
          // The SDK handles tool execution automatically, we just need to track for UI
        } else if (part.type === 'tool-result') {
          console.log('[AI] Tool result:', part);
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
        } else if (part.type === 'step-finish') {
          console.log('[AI] Step finished:', part);
          // Each step represents a complete tool call/response cycle
        } else if (part.type === 'finish') {
          console.log('[AI] Finish event:', part);
          console.log('[AI] Finish reason:', part.finishReason);
          console.log('[AI] Final content length:', fullContent.length);
          console.log('[AI] Final content:', fullContent);
          console.log('[AI] Final content trimmed empty?', fullContent.trim() === '');
          
          // Check if we finished with only tool calls and no text response
          if (part.finishReason === 'tool-calls' && fullContent.trim() === '') {
            // Remove the empty assistant message
            conversations.value = conversations.value.map(c => 
              c.id === conversation.id
                ? { ...c, messages: c.messages.filter(m => m.id !== assistantMessage.id) }
                : c
            );
            
            // Get the updated conversation with tool messages
            const updatedConversation = conversations.value.find(c => c.id === conversation.id);
            if (updatedConversation) {
              // Make a follow-up call to get the assistant's response incorporating the tool results
              const followUpMessage: Message = {
                id: `${Date.now()}-assistant-followup`,
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
                isGenerating: true
              };
              addMessage(conversation.id, followUpMessage);
              
              // Continue with a new streamText call without tools to get the final response
              // Include tool messages by mapping them to assistant messages with tool results
              const followUpMessages = updatedConversation.messages.map((m) => {
                if (m.role === 'tool') {
                  // Convert tool messages to assistant messages that describe the tool results
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
          } else if (fullContent.trim() !== '') {
            // Normal finish with text content
            updateMessage(conversation.id, assistantMessage.id, { isGenerating: false });
          } else {
            // Empty message without tool calls - remove it
            conversations.value = conversations.value.map(c => 
              c.id === conversation.id
                ? { ...c, messages: c.messages.filter(m => m.id !== assistantMessage.id) }
                : c
            );
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Generation was stopped by user
        updateMessage(conversation.id, assistantMessage.id, { isGenerating: false });
      } else {
        const errorMsg = (err as Error).message || 'Failed to send message';
        
        // Check if the error is about tools not being supported
        if (errorMsg.includes('does not support tools')) {
          // Add an error message to the conversation
          const errorMessage: Message = {
            id: `${Date.now()}-error`,
            role: 'assistant',
            content: `⚠️ ${errorMsg}\n\nYou can disable tools for this conversation in the MCP sidebar, or switch to a model that supports tools.`,
            timestamp: Date.now(),
            isError: true
          };
          
          // Replace the empty assistant message with the error message
          updateMessage(conversation.id, assistantMessage.id, {
            content: errorMessage.content,
            isGenerating: false,
            isError: true
          });
        } else {
          showError(errorMsg);
          // Remove the assistant message on error
          conversations.value = conversations.value.map(c => 
            c.id === conversation.id
              ? { ...c, messages: c.messages.filter(m => m.id !== assistantMessage.id) }
              : c
          );
        }
      }
    } finally {
      isStreaming.value = false;
      setAbortController(null);
    }
  };

  const handleSaveSettings = (newSettings: typeof settings.value) => {
    updateSettings(newSettings);
    setShowSettings(false);
  };

  const handleSaveMcpSettings = async (mcpConfiguration: string) => {
    const mcpConfigChanged = settings.value.mcpConfiguration !== mcpConfiguration;
    updateSettings({ ...settings.value, mcpConfiguration });
    setShowMcpSettings(false);
    
    // Restart MCP connections if configuration changed
    if (mcpConfigChanged) {
      await restartMCPConnections(mcpConfiguration);
    }
  };

  const handleDefaultModelChange = (modelId: string) => {
    updateSettings({ defaultModel: modelId });
  };

  const handleConversationModelChange = (modelId: string) => {
    const conversation = selectedConversation.value;
    if (!conversation) return;
    
    updateConversationModel(conversation.id, modelId);
  };

  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
      isStreaming.value = false;
      setAbortController(null);
    }
  };

  return (
    <div class="app">

      <SettingsModal
        show={showSettings}
        settings={settings.value}
        onSave={handleSaveSettings}
        onCancel={() => setShowSettings(false)}
      />

      <MCPSettingsModal
        show={showMcpSettings}
        mcpConfiguration={settings.value.mcpConfiguration}
        onSave={handleSaveMcpSettings}
        onCancel={() => setShowMcpSettings(false)}
      />

      <div class="app-content">
        <ConversationList
          conversations={conversations.value}
          selectedId={selectedConversationId.value}
          onSelect={(id) => { selectedConversationId.value = id; }}
          onCreate={createNewConversation}
          onRename={renameConversation}
          onDelete={handleDeleteConversation}
          onSettingsClick={() => setShowSettings(true)}
          defaultModel={settings.value.defaultModel}
          onDefaultModelChange={handleDefaultModelChange}
        />
        <div class="conversation-container">
          <Conversation
            conversation={selectedConversation.value || null}
            onSendMessage={sendMessage}
            onModelChange={handleConversationModelChange}
            onStopGeneration={stopGeneration}
          />
          {errorMessage.value && (
            <div class="error-message">
              <span>{errorMessage.value}</span>
              <button onClick={clearError} class="error-close">×</button>
            </div>
          )}
        </div>
        <MCPSidebar onSettingsClick={() => setShowMcpSettings(true)} />
      </div>
    </div>
  );
}

export default App;
