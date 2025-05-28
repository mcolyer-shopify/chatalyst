import { useState, useEffect } from 'preact/hooks';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import { ConversationList } from './components/ConversationList';
import { Conversation } from './components/Conversation';
import { MCPSidebar } from './components/MCPSidebar';
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
import { initializeMCPConnections, restartMCPConnections, shutdownMCPConnections, getActiveToolsForConversation } from './utils/mcp';
import './App.css';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState(settings.value);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [mcpConfigError, setMcpConfigError] = useState<string | null>(null);

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
    return createOpenAICompatible({
      name: 'custom-ai-provider',
      baseURL: settings.value.baseURL,
      apiKey: settings.value.apiKey || 'openrouter'
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
      const activeTools = getActiveToolsForConversation(conversation);
      
      if (activeTools.length > 0) {
        console.log(`Active tools for conversation:`, activeTools.map(t => t.name));
      }
      
      const result = await streamText({
        model: aiProvider(modelToUse),
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
        })),
        tools: activeTools.length > 0 ? activeTools.reduce((acc, tool) => {
          acc[tool.name] = {
            description: tool.description,
            parameters: tool.parameters,
            execute: tool.execute
          };
          return acc;
        }, {} as any) : undefined,
        abortSignal: controller.signal
      });

      // Stream the response
      let fullContent = '';
      
      // Check if there are tool calls
      if (activeTools.length > 0) {
        // Handle both text and tool calls
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            fullContent += part.textDelta;
            updateMessage(conversation.id, assistantMessage.id, { content: fullContent });
          } else if (part.type === 'tool-call') {
            // Handle tool calls
            const toolCall = part.toolCall;
            if (toolCall) {
              fullContent += `\n[Calling tool: ${toolCall.toolName}]\n`;
              updateMessage(conversation.id, assistantMessage.id, { content: fullContent });
            }
          } else if (part.type === 'tool-result') {
            // Handle tool results
            const toolResult = part.toolResult;
            if (toolResult) {
              fullContent += `[Tool result: ${JSON.stringify(toolResult.result)}]\n`;
              updateMessage(conversation.id, assistantMessage.id, { content: fullContent });
            }
          }
        }
      } else {
        // No tools, just stream text
        for await (const chunk of result.textStream) {
          fullContent += chunk;
          updateMessage(conversation.id, assistantMessage.id, { content: fullContent });
        }
      }
      
      // Mark as finished generating
      updateMessage(conversation.id, assistantMessage.id, { isGenerating: false });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Generation was stopped by user
        updateMessage(conversation.id, assistantMessage.id, { isGenerating: false });
      } else {
        showError((err as Error).message || 'Failed to send message');
        // Remove the assistant message on error
        conversations.value = conversations.value.map(c => 
          c.id === conversation.id
            ? { ...c, messages: c.messages.filter(m => m.id !== assistantMessage.id) }
            : c
        );
      }
    } finally {
      isStreaming.value = false;
      setAbortController(null);
    }
  };

  const validateMcpConfiguration = (configString: string): boolean => {
    if (!configString.trim()) {
      setMcpConfigError(null);
      return true; // Empty config is valid
    }

    try {
      const parsed = JSON.parse(configString);
      
      // Validate structure
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setMcpConfigError('MCP configuration must be a JSON object');
        return false;
      }

      // Validate each server config
      for (const [key, config] of Object.entries(parsed)) {
        if (typeof config !== 'object' || config === null) {
          setMcpConfigError(`Server "${key}" must be an object`);
          return false;
        }

        const serverConfig = config as any;
        if (!serverConfig.name || typeof serverConfig.name !== 'string') {
          setMcpConfigError(`Server "${key}" must have a name`);
          return false;
        }
        if (!serverConfig.description || typeof serverConfig.description !== 'string') {
          setMcpConfigError(`Server "${key}" must have a description`);
          return false;
        }
        if (!serverConfig.command || typeof serverConfig.command !== 'string') {
          setMcpConfigError(`Server "${key}" must have a command`);
          return false;
        }
        if (serverConfig.transport !== 'stdio') {
          setMcpConfigError(`Server "${key}" transport must be "stdio"`);
          return false;
        }
      }

      setMcpConfigError(null);
      return true;
    } catch (e) {
      setMcpConfigError(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
      return false;
    }
  };

  const handleSaveSettings = async () => {
    if (!validateMcpConfiguration(tempSettings.mcpConfiguration || '')) {
      return;
    }
    
    // Check if MCP configuration has changed
    const mcpConfigChanged = settings.value.mcpConfiguration !== tempSettings.mcpConfiguration;
    
    updateSettings(tempSettings);
    setShowSettings(false);
    
    // Restart MCP connections if configuration changed
    if (mcpConfigChanged) {
      await restartMCPConnections(tempSettings.mcpConfiguration);
    }
  };

  const handleCancelSettings = () => {
    setTempSettings(settings.value);
    setMcpConfigError(null);
    setShowSettings(false);
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

      {showSettings && (
        <>
          <div
            class="modal-backdrop"
            onClick={handleCancelSettings}
          />
          <div class="modal">
            <h2>Settings</h2>

            <div class="form-group">
              <label>Base URL:</label>
              <input
                type="text"
                value={tempSettings.baseURL}
                onInput={(e) =>
                  setTempSettings({
                    ...tempSettings,
                    baseURL: (e.target as HTMLInputElement).value
                  })
                }
              />
            </div>

            <div class="form-group">
              <label>API Key:</label>
              <input
                type="password"
                value={tempSettings.apiKey}
                onInput={(e) =>
                  setTempSettings({
                    ...tempSettings,
                    apiKey: (e.target as HTMLInputElement).value
                  })
                }
                placeholder="Leave blank to use 'openrouter'"
              />
            </div>

            <div class="form-group">
              <label>MCP Configuration (JSON):</label>
              <textarea
                value={tempSettings.mcpConfiguration || ''}
                onInput={(e) => {
                  const value = (e.target as HTMLTextAreaElement).value;
                  setTempSettings({
                    ...tempSettings,
                    mcpConfiguration: value
                  });
                }}
                onBlur={() => validateMcpConfiguration(tempSettings.mcpConfiguration || '')}
                rows={10}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
                placeholder='{"server-name": {"name": "...", "description": "...", "transport": "stdio", "command": "..."}}'
              />
              {mcpConfigError && (
                <div style={{ color: 'red', marginTop: '5px', fontSize: '14px' }}>
                  {mcpConfigError}
                </div>
              )}
            </div>

            <div class="modal-actions">
              <button onClick={handleCancelSettings} class="button-secondary">
                Cancel
              </button>
              <button onClick={handleSaveSettings} class="button-primary">
                Save
              </button>
            </div>
          </div>
        </>
      )}

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
        <MCPSidebar />
      </div>
    </div>
  );
}

export default App;
