import { render, screen } from '@testing-library/preact';
import { Message } from './Message';
import type { Message as MessageType } from '../types';

describe('Message', () => {
  const mockUserMessage: MessageType = {
    id: '1',
    content: 'Hello, how are you?',
    role: 'user',
    timestamp: 1704067200000 // 2024-01-01 00:00:00
  };

  const mockAssistantMessage: MessageType = {
    id: '2',
    content: 'I am doing well, thank you!',
    role: 'assistant',
    timestamp: 1704067260000 // 2024-01-01 00:01:00
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
      content: 'This is a very long message that should wrap properly within the message bubble without breaking the layout or causing overflow issues in the conversation interface.'
    };

    const { container } = render(<Message message={longMessage} />);
    
    const contentDiv = container.querySelector('.message-content');
    expect(contentDiv).toHaveTextContent(longMessage.content);
  });

  it('handles empty message content', () => {
    const emptyMessage: MessageType = {
      ...mockUserMessage,
      content: ''
    };

    const { container } = render(<Message message={emptyMessage} />);
    
    const contentDiv = container.querySelector('.message-content');
    expect(contentDiv).toHaveTextContent('');
  });

  describe('Markdown rendering', () => {
    it('renders markdown in assistant messages', () => {
      const markdownMessage: MessageType = {
        id: '3',
        content: '# Hello\n\nThis is **bold** and *italic* text.',
        role: 'assistant',
        timestamp: Date.now()
      };

      const { container } = render(<Message message={markdownMessage} />);
      
      // Check that markdown is converted to HTML
      expect(container.querySelector('h1')).toHaveTextContent('Hello');
      expect(container.querySelector('strong')).toHaveTextContent('bold');
      expect(container.querySelector('em')).toHaveTextContent('italic');
    });

    it('renders markdown in user messages', () => {
      const markdownMessage: MessageType = {
        id: '4',
        content: '# Hello\n\nThis is **bold** text.',
        role: 'user',
        timestamp: Date.now()
      };

      const { container } = render(<Message message={markdownMessage} />);
      
      // Check that markdown is converted for user messages
      expect(container.querySelector('h1')).toHaveTextContent('Hello');
      expect(container.querySelector('strong')).toHaveTextContent('bold');
    });

    it('preserves newlines in multi-line user messages', () => {
      const multiLineMessage: MessageType = {
        id: '7',
        content: 'Line 1\nLine 2\n\nLine 3 after blank line',
        role: 'user',
        timestamp: Date.now()
      };

      const { container } = render(<Message message={multiLineMessage} />);
      
      // Check that the content is split into paragraphs
      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs.length).toBeGreaterThan(1);
      expect(paragraphs[0]).toHaveTextContent('Line 1');
    });

    it('renders code blocks correctly', () => {
      const codeMessage: MessageType = {
        id: '5',
        content: 'Here is some code:\n\n```javascript\nconst x = 42;\nconsole.log(x);\n```',
        role: 'assistant',
        timestamp: Date.now()
      };

      const { container } = render(<Message message={codeMessage} />);
      
      expect(container.querySelector('pre')).toBeInTheDocument();
      expect(container.querySelector('code')).toHaveTextContent('const x = 42;');
    });

    it('renders links correctly', () => {
      const linkMessage: MessageType = {
        id: '6',
        content: 'Check out [this link](https://example.com)',
        role: 'assistant',
        timestamp: Date.now()
      };

      const { container } = render(<Message message={linkMessage} />);
      
      const link = container.querySelector('a');
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveTextContent('this link');
    });
  });
});