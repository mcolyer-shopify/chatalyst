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
  deleteConversation,
  updateConversationTitle,
  updateConversationModel,
  updateSettings,
  clearError
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
  
  // Custom hooks
  const { sendMessage, stopGeneration } = useMessageHandling();
  
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

  // Settings management
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