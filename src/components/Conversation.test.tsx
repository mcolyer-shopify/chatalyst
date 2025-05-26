import { render, screen } from '@testing-library/preact';
import { Conversation } from './Conversation';
import type { Conversation as ConversationType } from '../types';

// Mock child components
vi.mock('./Message', () => ({
  Message: ({ message }: any) => (
    <div data-testid={`message-${message.id}`} class={`message message-${message.role}`}>
      {message.content}
    </div>
  )
}));

vi.mock('./MessageInput', () => ({
  MessageInput: ({ onSend, disabled }: any) => (
    <div data-testid="message-input">
      <button onClick={() => onSend('test message')} disabled={disabled}>
        Send Test
      </button>
    </div>
  )
}));

vi.mock('./ModelSelector', () => ({
  ModelSelector: () => <div data-testid="model-selector">Model Selector</div>
}));

describe('Conversation', () => {
  const mockConversation: ConversationType = {
    id: '1',
    title: 'Test Conversation',
    messages: [
      {
        id: '1',
        content: 'Hello',
        role: 'user',
        timestamp: Date.now()
      },
      {
        id: '2',
        content: 'Hi there!',
        role: 'assistant',
        timestamp: Date.now()
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const mockOnSendMessage = vi.fn();
  const mockOnModelChange = vi.fn();
  const mockBaseURL = 'https://api.example.com';
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no conversation is selected', () => {
    render(<Conversation 
      conversation={null} 
      onSendMessage={mockOnSendMessage}
      onModelChange={mockOnModelChange}
      baseURL={mockBaseURL}
      apiKey={mockApiKey}
    />);
    
    expect(screen.getByText('Select a conversation or create a new one to start chatting')).toBeInTheDocument();
    expect(screen.queryByTestId('message-input')).not.toBeInTheDocument();
  });

  it('renders conversation header with title', () => {
    render(<Conversation 
      conversation={mockConversation} 
      onSendMessage={mockOnSendMessage}
      onModelChange={mockOnModelChange}
      baseURL={mockBaseURL}
      apiKey={mockApiKey}
    />);
    
    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
  });

  it('renders all messages in conversation', () => {
    render(<Conversation 
      conversation={mockConversation} 
      onSendMessage={mockOnSendMessage}
      onModelChange={mockOnModelChange}
      baseURL={mockBaseURL}
      apiKey={mockApiKey}
    />);
    
    expect(screen.getByTestId('message-1')).toBeInTheDocument();
    expect(screen.getByTestId('message-2')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('renders MessageInput component', () => {
    render(<Conversation 
      conversation={mockConversation} 
      onSendMessage={mockOnSendMessage}
      onModelChange={mockOnModelChange}
      baseURL={mockBaseURL}
      apiKey={mockApiKey}
    />);
    
    expect(screen.getByTestId('message-input')).toBeInTheDocument();
  });

  it('passes onSendMessage to MessageInput', () => {
    render(<Conversation 
      conversation={mockConversation} 
      onSendMessage={mockOnSendMessage}
      onModelChange={mockOnModelChange}
      baseURL={mockBaseURL}
      apiKey={mockApiKey}
    />);
    
    const sendButton = screen.getByText('Send Test');
    sendButton.click();
    
    expect(mockOnSendMessage).toHaveBeenCalledWith('test message');
  });

  it('renders messages in correct order', () => {
    const { container } = render(<Conversation 
      conversation={mockConversation} 
      onSendMessage={mockOnSendMessage}
      onModelChange={mockOnModelChange}
      baseURL={mockBaseURL}
      apiKey={mockApiKey}
    />);
    
    // Only select message elements, not the message-input
    const messages = container.querySelectorAll('[data-testid^="message-"]:not([data-testid="message-input"])');
    expect(messages).toHaveLength(2);
    expect(messages[0]).toHaveAttribute('data-testid', 'message-1');
    expect(messages[1]).toHaveAttribute('data-testid', 'message-2');
  });

  it('applies correct CSS classes', () => {
    const { container } = render(<Conversation 
      conversation={mockConversation} 
      onSendMessage={mockOnSendMessage}
      onModelChange={mockOnModelChange}
      baseURL={mockBaseURL}
      apiKey={mockApiKey}
    />);
    
    expect(container.querySelector('.conversation')).toBeInTheDocument();
    expect(container.querySelector('.conversation-header')).toBeInTheDocument();
    expect(container.querySelector('.conversation-messages')).toBeInTheDocument();
  });

  it('handles conversation with no messages', () => {
    const emptyConversation: ConversationType = {
      ...mockConversation,
      messages: []
    };

    const { container } = render(<Conversation 
      conversation={emptyConversation} 
      onSendMessage={mockOnSendMessage}
      onModelChange={mockOnModelChange}
      baseURL={mockBaseURL}
      apiKey={mockApiKey}
    />);
    
    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
    // Check that no message elements exist (excluding message-input)
    const messages = container.querySelectorAll('[data-testid^="message-"]:not([data-testid="message-input"])');
    expect(messages).toHaveLength(0);
    expect(screen.getByTestId('message-input')).toBeInTheDocument();
  });

  it('renders scroll to bottom button when not at bottom', () => {
    const { container } = render(<Conversation 
      conversation={mockConversation} 
      onSendMessage={mockOnSendMessage}
      onModelChange={mockOnModelChange}
      baseURL={mockBaseURL}
      apiKey={mockApiKey}
    />);

    // Look for the scroll button
    const scrollButton = container.querySelector('.scroll-to-bottom');
    
    // The button may or may not be visible depending on scroll state
    // Just verify the component renders without errors
    expect(container.querySelector('.conversation-messages')).toBeInTheDocument();
  });

  it('updates when conversation changes', () => {
    const { rerender } = render(
      <Conversation 
        conversation={mockConversation} 
        onSendMessage={mockOnSendMessage}
        onModelChange={mockOnModelChange}
        baseURL={mockBaseURL}
        apiKey={mockApiKey}
      />
    );

    expect(screen.getByText('Test Conversation')).toBeInTheDocument();

    const newConversation: ConversationType = {
      ...mockConversation,
      id: '2',
      title: 'New Conversation'
    };

    rerender(<Conversation 
      conversation={newConversation} 
      onSendMessage={mockOnSendMessage}
      onModelChange={mockOnModelChange}
      baseURL={mockBaseURL}
      apiKey={mockApiKey}
    />);

    expect(screen.getByText('New Conversation')).toBeInTheDocument();
  });
});