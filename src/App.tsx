import { useState, useEffect } from 'preact/hooks';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import { ConversationList } from './components/ConversationList';
import { Conversation } from './components/Conversation';
import type { Message } from './types';
import { 
  conversations, 
  selectedConversationId, 
  selectedConversation,
  settings,
  isStreaming,
  createConversation,
  deleteConversation,
  updateConversationTitle,
  updateConversationModel,
  addMessage,
  updateMessage,
  updateSettings
} from './store';
import './App.css';

function App() {
  const [error, setError] = useState<Error | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState(settings.value);

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
    setError(null);

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    try {
      addMessage(conversation.id, assistantMessage);

      // Call the AI with current settings and conversation model
      const aiProvider = getAIProvider();
      const modelToUse = conversation.model || settings.value.defaultModel || 'gpt-4-turbo';
      const messages = conversation.messages.concat([userMessage]);
      const result = await streamText({
        model: aiProvider(modelToUse),
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
        }))
      });

      // Stream the response
      let fullContent = '';
      for await (const chunk of result.textStream) {
        fullContent += chunk;
        updateMessage(conversation.id, assistantMessage.id, { content: fullContent });
      }
    } catch (err) {
      setError(err as Error);
      // Remove the assistant message on error
      conversations.value = conversations.value.map(c => 
        c.id === conversation.id
          ? { ...c, messages: c.messages.filter(m => m.id !== assistantMessage.id) }
          : c
      );
    } finally {
      isStreaming.value = false;
    }
  };

  const handleSaveSettings = () => {
    updateSettings(tempSettings);
    setShowSettings(false);
  };

  const handleCancelSettings = () => {
    setTempSettings(settings.value);
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
            conversation={selectedConversation.value}
            onSendMessage={sendMessage}
            onModelChange={handleConversationModelChange}
          />
          {error && (
            <div class="error-message">
              Error: {error.message || error.toString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
