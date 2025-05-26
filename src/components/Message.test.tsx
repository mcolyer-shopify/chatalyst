import { render, screen } from '@testing-library/preact';
import { Message } from './Message';
import type { Message as MessageType } from '../types';

describe('Message', () => {
  const mockUserMessage: MessageType = {
    id: '1',
    content: 'Hello, how are you?',
    role: 'user',
    timestamp: 1704067200000, // 2024-01-01 00:00:00
  };

  const mockAssistantMessage: MessageType = {
    id: '2',
    content: 'I am doing well, thank you!',
    role: 'assistant',
    timestamp: 1704067260000, // 2024-01-01 00:01:00
  };

  it('renders user message with correct styling', () => {
    const { container } = render(<Message message={mockUserMessage} />);
    
    const messageDiv = container.querySelector('.message');
    expect(messageDiv).toHaveClass('message-user');
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
  });

  it('renders assistant message with correct styling', () => {
    const { container } = render(<Message message={mockAssistantMessage} />);
    
    const messageDiv = container.querySelector('.message');
    expect(messageDiv).toHaveClass('message-assistant');
    expect(screen.getByText('I am doing well, thank you!')).toBeInTheDocument();
  });

  it('displays message content', () => {
    render(<Message message={mockUserMessage} />);
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
  });

  it('displays formatted timestamp', () => {
    render(<Message message={mockUserMessage} />);
    
    // The timestamp should be formatted as locale time string
    const timestampElement = screen.getByText(/\d{1,2}:\d{2}:\d{2}/);
    expect(timestampElement).toBeInTheDocument();
  });

  it('applies correct CSS classes to message content', () => {
    const { container } = render(<Message message={mockUserMessage} />);
    
    const contentDiv = container.querySelector('.message-content');
    expect(contentDiv).toBeInTheDocument();
    expect(contentDiv).toHaveTextContent('Hello, how are you?');
  });

  it('handles long messages without breaking layout', () => {
    const longMessage: MessageType = {
      ...mockUserMessage,
      content: 'This is a very long message that should wrap properly within the message bubble without breaking the layout or causing overflow issues in the conversation interface.',
    };

    const { container } = render(<Message message={longMessage} />);
    
    const contentDiv = container.querySelector('.message-content');
    expect(contentDiv).toHaveTextContent(longMessage.content);
  });

  it('handles empty message content', () => {
    const emptyMessage: MessageType = {
      ...mockUserMessage,
      content: '',
    };

    const { container } = render(<Message message={emptyMessage} />);
    
    const contentDiv = container.querySelector('.message-content');
    expect(contentDiv).toHaveTextContent('');
  });
});