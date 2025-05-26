import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import App from './App';
import { loadConversations, saveConversations } from './utils/storage';
import type { Conversation } from './types';

// Mock dependencies
vi.mock('./utils/storage');
vi.mock('@ai-sdk/openai-compatible');
vi.mock('ai');

// Mock child components with basic functionality
vi.mock('./components/ConversationList', () => ({
  ConversationList: ({ conversations, _selectedId, onSelect, onCreate, onRename, onDelete }: any) => (
    <div data-testid="conversation-list">
      <button onClick={onCreate}>Create New</button>
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
    
    // Default mock implementations
    (loadConversations as any).mockReturnValue([]);
    (saveConversations as any).mockImplementation(() => {});
  });

  it('renders main app structure', () => {
    render(<App />);
    
    expect(screen.getByText('Chatalyst')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-list')).toBeInTheDocument();
    expect(screen.getByTestId('conversation')).toBeInTheDocument();
  });

  it('loads conversations on mount', () => {
    (loadConversations as any).mockReturnValue(mockConversations);
    
    render(<App />);
    
    expect(loadConversations).toHaveBeenCalled();
    expect(screen.getByTestId('conv-1')).toHaveTextContent('First Conversation');
  });

  it('saves conversations when they change', async () => {
    render(<App />);
    
    // Create a new conversation
    fireEvent.click(screen.getByText('Create New'));
    
    await waitFor(() => {
      expect(saveConversations).toHaveBeenCalled();
    });
  });

  it('creates new conversation', async () => {
    render(<App />);
    
    fireEvent.click(screen.getByText('Create New'));
    
    await waitFor(() => {
      expect(saveConversations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('New Conversation'),
            messages: []
          })
        ])
      );
    });
  });

  it('selects conversation when clicked', () => {
    (loadConversations as any).mockReturnValue(mockConversations);
    
    const { container } = render(<App />);
    
    // Click on the conversation title in the list
    const convTitle = container.querySelector('[data-testid="conv-1"] span');
    fireEvent.click(convTitle!);
    
    expect(screen.getByText('user: Hello')).toBeInTheDocument();
  });

  it('renames conversation', async () => {
    (loadConversations as any).mockReturnValue(mockConversations);
    
    render(<App />);
    
    fireEvent.click(screen.getByText('Rename'));
    
    await waitFor(() => {
      expect(saveConversations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            title: 'Renamed'
          })
        ])
      );
    });
  });

  it('deletes conversation', async () => {
    (loadConversations as any).mockReturnValue(mockConversations);
    
    render(<App />);
    
    fireEvent.click(screen.getByText('Delete'));
    
    await waitFor(() => {
      expect(saveConversations).toHaveBeenCalledWith([]);
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
    render(<App />);
    
    fireEvent.click(screen.getByTitle('Settings'));
    
    const baseUrlInput = screen.getByDisplayValue('https://openrouter.ai/api/v1');
    fireEvent.input(baseUrlInput, { target: { value: 'https://new-api.com' } });
    
    fireEvent.click(screen.getByText('Save'));
    
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'chatalyst-settings',
      expect.stringContaining('https://new-api.com')
    );
  });

  it('cancels settings changes', () => {
    render(<App />);
    
    fireEvent.click(screen.getByTitle('Settings'));
    
    const baseUrlInput = screen.getByDisplayValue('https://openrouter.ai/api/v1');
    fireEvent.input(baseUrlInput, { target: { value: 'https://new-api.com' } });
    
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      'chatalyst-settings',
      expect.any(String)
    );
  });

  it('loads settings from localStorage', () => {
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'chatalyst-settings') {
        return JSON.stringify({
          baseURL: 'https://custom-api.com',
          apiKey: 'test-key'
        });
      }
      return null;
    });
    
    render(<App />);
    
    fireEvent.click(screen.getByTitle('Settings'));
    
    expect(screen.getByDisplayValue('https://custom-api.com')).toBeInTheDocument();
  });

  it('handles empty conversation list', () => {
    render(<App />);
    
    expect(screen.getByText('No conversation selected')).toBeInTheDocument();
  });

  it('auto-selects first conversation when loaded', () => {
    (loadConversations as any).mockReturnValue(mockConversations);
    
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
    
    (loadConversations as any).mockReturnValue(multipleConversations);
    
    render(<App />);
    
    expect(screen.getByTestId('conv-1')).toHaveTextContent('First Conversation');
    expect(screen.getByTestId('conv-2')).toHaveTextContent('Second Conversation');
  });

  it('selects next conversation after deleting current', async () => {
    const multipleConversations: Conversation[] = [
      ...mockConversations,
      {
        id: '2',
        title: 'Second Conversation',
        messages: [
          {
            id: 'msg2',
            content: 'Second message',
            role: 'user',
            timestamp: Date.now()
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
    
    (loadConversations as any).mockReturnValue(multipleConversations);
    
    const { container } = render(<App />);
    
    // Delete first conversation
    const deleteButtons = container.querySelectorAll('button');
    const firstDeleteButton = Array.from(deleteButtons).find(btn => btn.textContent === 'Delete');
    fireEvent.click(firstDeleteButton!);
    
    await waitFor(() => {
      expect(screen.getByText('user: Second message')).toBeInTheDocument();
    });
  });
});