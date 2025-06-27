import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import App from './App';
import * as store from './store';
import type { Conversation, Message } from './types';

// Type definitions for mock components
interface ConversationListProps {
  conversations: Conversation[];
  _selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onSettingsClick: () => void;
}

interface ConversationProps {
  conversation: Conversation | null;
  onSendMessage: (message: string) => void;
}

// Mock dependencies
vi.mock('@ai-sdk/openai-compatible');
vi.mock('ai');

// Mock the store module
vi.mock('./store', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  const { signal } = require('@preact/signals');
  
  return {
    conversations: signal([]),
    selectedConversationId: signal(null),
    selectedConversation: { value: null },
    settings: signal({ 
      provider: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1', 
      apiKey: '', 
      defaultModel: '',
      mcpConfiguration: ''
    }),
    isStreaming: signal(false),
    errorMessage: signal(null),
    errorTimestamp: signal(null),
    mcpServers: signal([]),
    prompts: signal([]),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    archiveConversation: vi.fn(),
    unarchiveConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    addMessage: vi.fn(),
    updateMessage: vi.fn(),
    updateSettings: vi.fn(),
    showError: vi.fn(),
    clearError: vi.fn(),
    createPrompt: vi.fn(),
    updatePrompt: vi.fn(),
    deletePromptById: vi.fn(),
    searchPrompts: vi.fn(),
    getAllCategories: vi.fn()
  };
});

// Mock child components with basic functionality
vi.mock('./components/ConversationList', () => ({
  ConversationList: ({ conversations, _selectedId, onSelect, onCreate, onRename, onDelete, onSettingsClick }: ConversationListProps) => (
    <div data-testid="conversation-list">
      <button onClick={onCreate}>Create New</button>
      <button onClick={onSettingsClick} title="Settings">Settings</button>
      {conversations.map((conv: Conversation) => (
        <div key={conv.id} data-testid={`conv-${conv.id}`}>
          <span onClick={() => onSelect(conv.id)}>{conv.title}</span>
          <button onClick={() => onRename(conv.id, 'Renamed')}>Rename</button>
          <button onClick={() => onDelete(conv.id)}>Delete</button>
        </div>
      ))}
    </div>
  )
}));

vi.mock('./components/Conversation', () => ({
  Conversation: ({ conversation, onSendMessage }: ConversationProps) => (
    <div data-testid="conversation">
      {conversation ? (
        <>
          <h2>{conversation.title}</h2>
          <div data-testid="messages">
            {conversation.messages.map((msg: Message) => (
              <div key={msg.id} data-testid={`msg-${msg.id}`}>
                {msg.role}: {msg.content}
              </div>
            ))}
          </div>
          <button onClick={() => onSendMessage('Test message')}>Send Test</button>
        </>
      ) : (
        <div>No conversation selected</div>
      )}
    </div>
  )
}));

describe('App Integration', () => {
  const mockConversations: Conversation[] = [
    {
      id: '1',
      title: 'First Conversation',
      messages: [
        {
          id: 'msg1',
          content: 'Hello',
          role: 'user',
          timestamp: Date.now()
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Reset store values
    store.conversations.value = [];
    store.selectedConversationId.value = null;
    (store as { selectedConversation: { value: Conversation | null } }).selectedConversation = { value: null };
    store.settings.value = { 
      provider: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1', 
      apiKey: '', 
      defaultModel: '',
      mcpConfiguration: ''
    };
    store.errorMessage.value = null;
    store.errorTimestamp.value = null;
  });

  it('renders main app structure', () => {
    render(<App />);
    
    expect(screen.getByTestId('conversation-list')).toBeInTheDocument();
    expect(screen.getByTestId('conversation')).toBeInTheDocument();
  });

  it('loads conversations on mount', () => {
    store.conversations.value = mockConversations;
    store.selectedConversationId.value = mockConversations[0].id;
    (store as { selectedConversation: { value: Conversation | null } }).selectedConversation = { value: mockConversations[0] };
    
    render(<App />);
    
    expect(screen.getByTestId('conv-1')).toHaveTextContent('First Conversation');
  });

  it('creates conversation when create button is clicked', async () => {
    const mockCreateConversation = store.createConversation as ReturnType<typeof vi.fn>;
    mockCreateConversation.mockImplementation((title: string) => {
      const newConv = {
        id: Date.now().toString(),
        title,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      store.conversations.value = [...store.conversations.value, newConv];
      store.selectedConversationId.value = newConv.id;
      return newConv;
    });
    
    render(<App />);
    
    fireEvent.click(screen.getByText('Create New'));
    
    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalled();
    });
  });

  it('creates new conversation with correct title', async () => {
    const mockCreateConversation = store.createConversation as ReturnType<typeof vi.fn>;
    
    render(<App />);
    
    fireEvent.click(screen.getByText('Create New'));
    
    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        expect.stringContaining('New Conversation'),
        expect.any(String)
      );
    });
  });

  it('selects conversation when clicked', () => {
    store.conversations.value = mockConversations;
    
    const { container } = render(<App />);
    
    // Click on the conversation title in the list
    const convTitle = container.querySelector('[data-testid="conv-1"] span');
    fireEvent.click(convTitle!);
    
    // The selectedConversationId signal should be updated
    expect(store.selectedConversationId.value).toBe('1');
  });

  it('renames conversation', async () => {
    store.conversations.value = mockConversations;
    const mockUpdateTitle = store.updateConversationTitle as ReturnType<typeof vi.fn>;
    
    render(<App />);
    
    fireEvent.click(screen.getByText('Rename'));
    
    await waitFor(() => {
      expect(mockUpdateTitle).toHaveBeenCalledWith('1', 'Renamed');
    });
  });

  it('deletes conversation', async () => {
    store.conversations.value = mockConversations;
    const mockDeleteConversation = store.deleteConversation as ReturnType<typeof vi.fn>;
    
    render(<App />);
    
    fireEvent.click(screen.getByText('Delete'));
    
    await waitFor(() => {
      expect(mockDeleteConversation).toHaveBeenCalledWith('1');
    });
  });

  it('shows settings modal when settings button is clicked', () => {
    render(<App />);
    
    fireEvent.click(screen.getByTitle('Settings'));
    
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('AI Provider:')).toBeInTheDocument();
    expect(screen.getByText('API Key:')).toBeInTheDocument();
  });

  it('saves settings', () => {
    const mockUpdateSettings = store.updateSettings as ReturnType<typeof vi.fn>;
    
    render(<App />);
    
    fireEvent.click(screen.getByTitle('Settings'));
    
    // The API key input should be available for modification
    const apiKeyInput = screen.getByDisplayValue('');
    fireEvent.input(apiKeyInput, { target: { value: 'new-api-key' } });
    
    fireEvent.click(screen.getByText('Save'));
    
    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'new-api-key'
      })
    );
  });

  it('cancels settings changes', () => {
    const mockUpdateSettings = store.updateSettings as ReturnType<typeof vi.fn>;
    
    render(<App />);
    
    fireEvent.click(screen.getByTitle('Settings'));
    
    // Make some changes to the API key input
    const apiKeyInput = screen.getByDisplayValue('');
    fireEvent.input(apiKeyInput, { target: { value: 'new-api-key' } });
    
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it('shows current settings in modal', () => {
    store.settings.value = {
      provider: 'custom',
      baseURL: 'https://custom-api.com',
      apiKey: 'test-key',
      defaultModel: '',
      mcpConfiguration: ''
    };
    
    render(<App />);
    
    fireEvent.click(screen.getByTitle('Settings'));
    
    expect(screen.getByDisplayValue('test-key')).toBeInTheDocument();
  });

  it('handles empty conversation list', () => {
    render(<App />);
    
    expect(screen.getByText('No conversation selected')).toBeInTheDocument();
  });

  it('shows selected conversation', () => {
    store.conversations.value = mockConversations;
    store.selectedConversationId.value = mockConversations[0].id;
    (store as { selectedConversation: { value: Conversation | null } }).selectedConversation = { value: mockConversations[0] };
    
    render(<App />);
    
    expect(screen.getByText('user: Hello')).toBeInTheDocument();
  });

  it('handles multiple conversations', () => {
    const multipleConversations: Conversation[] = [
      ...mockConversations,
      {
        id: '2',
        title: 'Second Conversation',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
    
    store.conversations.value = multipleConversations;
    
    render(<App />);
    
    expect(screen.getByTestId('conv-1')).toHaveTextContent('First Conversation');
    expect(screen.getByTestId('conv-2')).toHaveTextContent('Second Conversation');
  });

  it('deletes conversation when delete is clicked', async () => {
    const multipleConversations: Conversation[] = [
      ...mockConversations,
      {
        id: '2',
        title: 'Second Conversation',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
    
    store.conversations.value = multipleConversations;
    const mockDeleteConversation = store.deleteConversation as ReturnType<typeof vi.fn>;
    
    const { container } = render(<App />);
    
    // Delete first conversation
    const deleteButtons = container.querySelectorAll('button');
    const firstDeleteButton = Array.from(deleteButtons).find(btn => btn.textContent === 'Delete');
    fireEvent.click(firstDeleteButton!);
    
    await waitFor(() => {
      expect(mockDeleteConversation).toHaveBeenCalledWith('1');
    });
  });

  it('toggles left sidebar visibility', () => {
    render(<App />);
    
    // Initially, conversations sidebar should be visible
    expect(screen.getByText('Create New')).toBeInTheDocument();
    
    // Click hide button for left sidebar
    const hideLeftButton = screen.getByTitle('Hide conversations');
    fireEvent.click(hideLeftButton);
    
    // Conversations sidebar should be hidden
    expect(screen.queryByText('Create New')).not.toBeInTheDocument();
    
    // Show button should appear
    const showLeftButton = screen.getByTitle('Show conversations');
    expect(showLeftButton).toBeInTheDocument();
    
    // Click show button
    fireEvent.click(showLeftButton);
    
    // Conversations sidebar should be visible again
    expect(screen.getByText('Create New')).toBeInTheDocument();
  });

  it('toggles right sidebar visibility', () => {
    render(<App />);
    
    // Initially, MCP sidebar should be visible
    expect(screen.getByText('MCP Servers')).toBeInTheDocument();
    
    // Click hide button for right sidebar
    const hideRightButton = screen.getByTitle('Hide MCP servers');
    fireEvent.click(hideRightButton);
    
    // MCP sidebar should be hidden
    expect(screen.queryByText('MCP Servers')).not.toBeInTheDocument();
    
    // Show button should appear
    const showRightButton = screen.getByTitle('Show MCP servers');
    expect(showRightButton).toBeInTheDocument();
    
    // Click show button
    fireEvent.click(showRightButton);
    
    // MCP sidebar should be visible again
    expect(screen.getByText('MCP Servers')).toBeInTheDocument();
  });
});