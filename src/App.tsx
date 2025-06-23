import { useState } from 'preact/hooks';
import { ConversationList } from './components/ConversationList';
import { Conversation } from './components/Conversation';
import { MCPSidebar } from './components/MCPSidebar';
import { SettingsModal } from './components/SettingsModal';
import { MCPSettingsModal } from './components/MCPSettingsModal';
import { 
  conversations, 
  selectedConversationId, 
  selectedConversation,
  settings,
  errorMessage,
  createConversation,
  startFreshConversation,
  deleteConversation,
  archiveConversation,
  unarchiveConversation,
  updateConversationTitle,
  updateConversationModel,
  updateSettings,
  clearError,
  deleteMessage
} from './store';
import { restartMCPConnections } from './utils/mcp';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWindowGeometry } from './hooks/useWindowGeometry';
import { useMCPInitialization } from './hooks/useMCPInitialization';
import { useMessageHandling } from './hooks/useMessageHandling';
import './App.css';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showMcpSettings, setShowMcpSettings] = useState(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  
  // Custom hooks
  const { sendMessage, retryMessage, stopGeneration, generateConversationTitle } = useMessageHandling();
  
  // Conversation management
  const createNewConversation = () => {
    const title = `New Conversation ${conversations.value.length + 1}`;
    createConversation(title, settings.value.defaultModel);
  };
  
  // Setup hooks
  useWindowGeometry();
  useMCPInitialization(settings.value.mcpConfiguration || '');
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrl: true,
      meta: true,
      handler: createNewConversation
    }
  ]);

  const renameConversation = (id: string, newTitle: string) => {
    updateConversationTitle(id, newTitle);
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
  };

  const handleDeleteMessage = (messageId: string) => {
    const conversation = selectedConversation.value;
    if (!conversation) return;
    deleteMessage(conversation.id, messageId);
  };

  const handleGenerateTitle = async (id: string) => {
    await generateConversationTitle(id);
  };

  const handleStartFresh = (id: string) => {
    startFreshConversation(id);
  };

  // Settings management
  const handleSaveSettings = (newSettings: typeof settings.value) => {
    updateSettings(newSettings);
    setShowSettings(false);
  };

  const handleSaveMcpSettings = async (mcpConfiguration: string) => {
    const mcpConfigChanged = settings.value.mcpConfiguration !== mcpConfiguration;
    updateSettings({ ...settings.value, mcpConfiguration });
    setShowMcpSettings(false);
    clearError();
    
    // Restart MCP connections if configuration changed
    if (mcpConfigChanged) {
      await restartMCPConnections(mcpConfiguration);
    }
  };

  // Model management
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
        onCancel={() => {
          setShowMcpSettings(false);
          clearError();
        }}
      />

      <div class="app-content">
        {showLeftSidebar && (
          <ConversationList
            conversations={conversations.value}
            selectedId={selectedConversationId.value}
            onSelect={(id) => { 
              selectedConversationId.value = id; 
              clearError();
            }}
            onCreate={createNewConversation}
            onRename={renameConversation}
            onDelete={handleDeleteConversation}
            onArchive={archiveConversation}
            onUnarchive={unarchiveConversation}
            onGenerateTitle={handleGenerateTitle}
            onStartFresh={handleStartFresh}
            onSettingsClick={() => setShowSettings(true)}
            defaultModel={settings.value.defaultModel}
            onDefaultModelChange={handleDefaultModelChange}
          />
        )}
        
        {!showLeftSidebar && (
          <button 
            class="sidebar-toggle sidebar-toggle-left"
            onClick={() => setShowLeftSidebar(true)}
            title="Show conversations"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}

        <div class="conversation-container">
          {showLeftSidebar && (
            <button 
              class="sidebar-toggle sidebar-toggle-left-hide"
              onClick={() => setShowLeftSidebar(false)}
              title="Hide conversations"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          
          <Conversation
            conversation={selectedConversation.value || null}
            onSendMessage={sendMessage}
            onRetryMessage={retryMessage}
            onDeleteMessage={handleDeleteMessage}
            onModelChange={handleConversationModelChange}
            onStopGeneration={stopGeneration}
          />
          
          {showRightSidebar && (
            <button 
              class="sidebar-toggle sidebar-toggle-right-hide"
              onClick={() => setShowRightSidebar(false)}
              title="Hide MCP servers"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
          
          {errorMessage.value && (
            <div class="error-message">
              <span>{errorMessage.value}</span>
              <button onClick={clearError} class="error-close">×</button>
            </div>
          )}
        </div>
        
        {showRightSidebar && (
          <MCPSidebar onSettingsClick={() => setShowMcpSettings(true)} />
        )}
        
        {!showRightSidebar && (
          <button 
            class="sidebar-toggle sidebar-toggle-right"
            onClick={() => setShowRightSidebar(true)}
            title="Show MCP servers"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default App;