import { useState, useEffect } from 'preact/hooks';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import { ConversationList } from './components/ConversationList';
import { Conversation } from './components/Conversation';
import type { Conversation as ConversationType, Message } from './types';
import { loadConversations, saveConversations } from './utils/storage';
import './App.css';

interface Settings {
  baseURL: string;
  apiKey: string;
}

const DEFAULT_SETTINGS: Settings = {
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: ''
};

function App() {
  const [conversations, setConversations] = useState<ConversationType[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [_isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tempSettings, setTempSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [defaultModel, setDefaultModel] = useState<string>('');

  // Load conversations and settings from localStorage on mount
  useEffect(() => {
    const savedConversations = loadConversations();
    setConversations(savedConversations);
    if (savedConversations.length > 0) {
      setSelectedConversationId(savedConversations[0].id);
    }

    const savedSettings = localStorage.getItem('chatalyst-settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      setTempSettings(parsed);
    }

    const savedDefaultModel = localStorage.getItem('chatalyst-default-model');
    if (savedDefaultModel) {
      setDefaultModel(savedDefaultModel);
    }
  }, []);

  // Save conversations whenever they change
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

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
  }, [conversations, defaultModel]);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;

  // Create AI provider with current settings
  const getAIProvider = () => {
    return createOpenAICompatible({
      name: 'custom-ai-provider',
      baseURL: settings.baseURL,
      apiKey: settings.apiKey || 'openrouter'
    });
  };

  const createNewConversation = () => {
    const newConversation: ConversationType = {
      id: Date.now().toString(),
      title: `New Conversation ${conversations.length + 1}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: defaultModel || undefined
    };
    setConversations([...conversations, newConversation]);
    setSelectedConversationId(newConversation.id);
  };

  const renameConversation = (id: string, newTitle: string) => {
    setConversations(conversations.map(c => 
      c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c
    ));
  };

  const deleteConversation = (id: string) => {
    const newConversations = conversations.filter(c => c.id !== id);
    setConversations(newConversations);
    if (selectedConversationId === id) {
      setSelectedConversationId(newConversations.length > 0 ? newConversations[0].id : null);
    }
  };

  const sendMessage = async (content: string) => {
    if (!selectedConversation || !content.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now()
    };

    const updatedConversation = {
      ...selectedConversation,
      messages: [...selectedConversation.messages, userMessage],
      updatedAt: Date.now()
    };

    setConversations(conversations.map(c => 
      c.id === selectedConversation.id ? updatedConversation : c
    ));

    setIsLoading(true);
    setError(null);

    try {
      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      const conversationWithAssistant = {
        ...updatedConversation,
        messages: [...updatedConversation.messages, assistantMessage]
      };

      setConversations(conversations.map(c => 
        c.id === selectedConversation.id ? conversationWithAssistant : c
      ));

      // Call the AI with current settings and conversation model
      const aiProvider = getAIProvider();
      const modelToUse = selectedConversation.model || defaultModel || 'gpt-4-turbo';
      const result = await streamText({
        model: aiProvider(modelToUse),
        messages: updatedConversation.messages.map((m) => ({
          role: m.role,
          content: m.content
        }))
      });

      // Stream the response
      let fullContent = '';
      for await (const chunk of result.textStream) {
        fullContent += chunk;
        setConversations(prevConversations => 
          prevConversations.map(c => 
            c.id === selectedConversation.id 
              ? {
                ...c,
                messages: c.messages.map(m => 
                  m.id === assistantMessage.id 
                    ? { ...m, content: fullContent }
                    : m
                )
              }
              : c
          )
        );
      }
    } catch (err) {
      setError(err as Error);
      // Remove the empty assistant message on error
      setConversations(conversations.map(c => 
        c.id === selectedConversation.id ? updatedConversation : c
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = () => {
    setSettings(tempSettings);
    localStorage.setItem('chatalyst-settings', JSON.stringify(tempSettings));
    setShowSettings(false);
  };

  const handleCancelSettings = () => {
    setTempSettings(settings);
    setShowSettings(false);
  };

  const handleDefaultModelChange = (modelId: string) => {
    setDefaultModel(modelId);
    localStorage.setItem('chatalyst-default-model', modelId);
  };

  const handleConversationModelChange = (modelId: string) => {
    if (!selectedConversation) return;
    
    setConversations(conversations.map(c => 
      c.id === selectedConversation.id 
        ? { ...c, model: modelId, updatedAt: Date.now() }
        : c
    ));
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
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          onCreate={createNewConversation}
          onRename={renameConversation}
          onDelete={deleteConversation}
          onSettingsClick={() => setShowSettings(true)}
          defaultModel={defaultModel}
          onDefaultModelChange={handleDefaultModelChange}
          baseURL={settings.baseURL}
          apiKey={settings.apiKey}
        />
        <div class="conversation-container">
          <Conversation
            conversation={selectedConversation}
            onSendMessage={sendMessage}
            onModelChange={handleConversationModelChange}
            baseURL={settings.baseURL}
            apiKey={settings.apiKey}
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