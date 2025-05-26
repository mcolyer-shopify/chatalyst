import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import App from './App';
import * as store from './store';
import type { Conversation } from './types';

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
    settings: signal({ baseURL: 'https://openrouter.ai/api/v1', apiKey: '', defaultModel: '' }),
    isStreaming: signal(false),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    addMessage: vi.fn(),
    updateMessage: vi.fn(),
    updateSettings: vi.fn()
  };
});

// Mock child components with basic functionality
vi.mock('./components/ConversationList', () => ({
  ConversationList: ({ conversations, _selectedId, onSelect, onCreate, onRename, onDelete, onSettingsClick }: any) => (
    <div data-testid="conversation-list">
      <button onClick={onCreate}>Create New</button>
      <button onClick={onSettingsClick} title="Settings">Settings</button>
      {conversations.map((conv: any) => (
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
  Conversation: ({ conversation, onSendMessage }: any) => (
    <div data-testid="conversation">
      {conversation ? (
        <>
          <h2>{conversation.title}</h2>
          <div data-testid="messages">
            {conversation.messages.map((msg: any) => (
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
    (store as any).selectedConversation = { value: null };
    store.settings.value = { baseURL: 'https://openrouter.ai/api/v1', apiKey: '', defaultModel: '' };
  });

  it('renders main app structure', () => {
    render(<App />);
    
    expect(screen.getByTestId('conversation-list')).toBeInTheDocument();
    expect(screen.getByTestId('conversation')).toBeInTheDocument();
  });

  it('loads conversations on mount', () => {
    store.conversations.value = mockConversations;
    store.selectedConversationId.value = mockConversations[0].id;
    (store as any).selectedConversation = { value: mockConversations[0] };
    
    render(<App />);
    
    expect(screen.getByTestId('conv-1')).toHaveTextContent('First Conversation');
  });

  it('creates conversation when create button is clicked', async () => {
    const mockCreateConversation = store.createConversation as any;
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
    const mockCreateConversation = store.createConversation as any;
    
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
    const mockUpdateTitle = store.updateConversationTitle as any;
    
    render(<App />);
    
    fireEvent.click(screen.getByText('Rename'));
    
    await waitFor(() => {
      expect(mockUpdateTitle).toHaveBeenCalledWith('1', 'Renamed');
    });
  });

  it('deletes conversation', async () => {
    store.conversations.value = mockConversations;
    const mockDeleteConversation = store.deleteConversation as any;
    
    render(<App />);
    
    fireEvent.click(screen.getByText('Delete'));
    
    await waitFor(() => {
      expect(mockDeleteConversation).toHaveBeenCalledWith('1');
    });
  });

  it('shows settings modal when settings button is clicked', () => {
    render(<App />);
    
    fireEvent.click(screen.getByTitle('Settings'));
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Base URL:')).toBeInTheDocument();
    expect(screen.getByText('API Key:')).toBeInTheDocument();
  });

  it('saves settings', () => {
    const mockUpdateSettings = store.updateSettings as any;
    
    render(<App />);
    
    fireEvent.click(screen.getByTitle('Settings'));
    
    const baseUrlInput = screen.getByDisplayValue('https://openrouter.ai/api/v1');
    fireEvent.input(baseUrlInput, { target: { value: 'https://new-api.com' } });
    
    fireEvent.click(screen.getByText('Save'));
    
    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://new-api.com'
      })
    );
  });

  it('cancels settings changes', () => {
    const mockUpdateSettings = store.updateSettings as any;
    
    render(<App />);
    
    fireEvent.click(screen.getByTitle('Settings'));
    
    const baseUrlInput = screen.getByDisplayValue('https://openrouter.ai/api/v1');
    fireEvent.input(baseUrlInput, { target: { value: 'https://new-api.com' } });
    
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it('shows current settings in modal', () => {
    store.settings.value = {
      baseURL: 'https://custom-api.com',
      apiKey: 'test-key',
      defaultModel: ''
    };
    
    render(<App />);
    
    fireEvent.click(screen.getByTitle('Settings'));
    
    expect(screen.getByDisplayValue('https://custom-api.com')).toBeInTheDocument();
  });

  it('handles empty conversation list', () => {
    render(<App />);
    
    expect(screen.getByText('No conversation selected')).toBeInTheDocument();
  });

  it('shows selected conversation', () => {
    store.conversations.value = mockConversations;
    store.selectedConversationId.value = mockConversations[0].id;
    (store as any).selectedConversation = { value: mockConversations[0] };
    
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
    const mockDeleteConversation = store.deleteConversation as any;
    
    const { container } = render(<App />);
    
    // Delete first conversation
    const deleteButtons = container.querySelectorAll('button');
    const firstDeleteButton = Array.from(deleteButtons).find(btn => btn.textContent === 'Delete');
    fireEvent.click(firstDeleteButton!);
    
    await waitFor(() => {
      expect(mockDeleteConversation).toHaveBeenCalledWith('1');
    });
  });
});