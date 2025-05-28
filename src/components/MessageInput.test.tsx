import { render, screen, fireEvent } from '@testing-library/preact';
import { MessageInput } from './MessageInput';

describe('MessageInput', () => {
  const mockOnSend = vi.fn();
  const placeholder = 'Type a message... (Shift+Enter for new line)';

  beforeEach(() => {
    mockOnSend.mockClear();
  });

  it('renders textarea field and send button', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('calls onSend with message when form is submitted', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const input = screen.getByPlaceholderText(placeholder);
    const form = input.closest('form')!;
    
    fireEvent.input(input, { target: { value: 'Hello world' } });
    fireEvent.submit(form);
    
    expect(mockOnSend).toHaveBeenCalledWith('Hello world');
    expect(mockOnSend).toHaveBeenCalledTimes(1);
  });

  it('clears input after sending message', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const input = screen.getByPlaceholderText(placeholder) as HTMLTextAreaElement;
    const form = input.closest('form')!;
    
    fireEvent.input(input, { target: { value: 'Hello world' } });
    fireEvent.submit(form);
    
    expect(input.value).toBe('');
  });

  it('does not send empty messages', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const input = screen.getByPlaceholderText(placeholder);
    const form = input.closest('form')!;
    
    fireEvent.input(input, { target: { value: '' } });
    fireEvent.submit(form);
    
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('trims whitespace from messages', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const input = screen.getByPlaceholderText(placeholder);
    const form = input.closest('form')!;
    
    fireEvent.input(input, { target: { value: '  Hello world  ' } });
    fireEvent.submit(form);
    
    expect(mockOnSend).toHaveBeenCalledWith('Hello world');
  });

  it('disables send button when input is empty', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const sendButton = screen.getByText('Send');
    expect(sendButton).toBeDisabled();
    
    const input = screen.getByPlaceholderText(placeholder);
    fireEvent.input(input, { target: { value: 'Hello' } });
    
    expect(sendButton).not.toBeDisabled();
  });

  it('disables input and button when disabled prop is true', () => {
    render(<MessageInput onSend={mockOnSend} disabled={true} />);
    
    const input = screen.getByPlaceholderText(placeholder);
    const sendButton = screen.getByText('Send');
    
    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('does not call onSend when disabled', () => {
    render(<MessageInput onSend={mockOnSend} disabled={true} />);
    
    const input = screen.getByPlaceholderText(placeholder);
    const form = input.closest('form')!;
    
    fireEvent.input(input, { target: { value: 'Hello world' } });
    fireEvent.submit(form);
    
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('handles clicking send button', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const input = screen.getByPlaceholderText(placeholder);
    const sendButton = screen.getByText('Send');
    
    fireEvent.input(input, { target: { value: 'Click test' } });
    fireEvent.click(sendButton);
    
    expect(mockOnSend).toHaveBeenCalledWith('Click test');
  });

  it('shows stop button when generating and is always enabled', () => {
    const mockOnStopGeneration = vi.fn();
    render(<MessageInput onSend={mockOnSend} onStopGeneration={mockOnStopGeneration} isGenerating={true} />);
    
    const stopButton = screen.getByText('Stop');
    expect(stopButton).not.toBeDisabled();
    expect(stopButton).toHaveClass('stop-button');
    
    fireEvent.click(stopButton);
    expect(mockOnStopGeneration).toHaveBeenCalled();
  });

  it('updates input value as user types', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const input = screen.getByPlaceholderText(placeholder) as HTMLTextAreaElement;
    
    fireEvent.input(input, { target: { value: 'H' } });
    expect(input.value).toBe('H');
    
    fireEvent.input(input, { target: { value: 'Hello' } });
    expect(input.value).toBe('Hello');
  });

  describe('message history navigation', () => {
    const userMessages = ['First message', 'Second message', 'Third message'];

    it('navigates to previous message with up arrow at start of input', () => {
      render(<MessageInput onSend={mockOnSend} userMessages={userMessages} />);
      
      const input = screen.getByPlaceholderText(placeholder) as HTMLTextAreaElement;
      
      // Ensure cursor is at position 0
      input.setSelectionRange(0, 0);
      
      // Press up arrow
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      
      expect(input.value).toBe('Third message');
    });

    it('navigates through history with multiple up arrow presses', () => {
      render(<MessageInput onSend={mockOnSend} userMessages={userMessages} />);
      
      const input = screen.getByPlaceholderText(placeholder) as HTMLTextAreaElement;
      
      // Ensure cursor is at position 0
      input.setSelectionRange(0, 0);
      
      // Press up arrow three times
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('Third message');
      
      input.setSelectionRange(0, 0);
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('Second message');
      
      input.setSelectionRange(0, 0);
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('First message');
      
      // Should stay at oldest message
      input.setSelectionRange(0, 0);
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('First message');
    });

    it('navigates back with down arrow', () => {
      render(<MessageInput onSend={mockOnSend} userMessages={userMessages} />);
      
      const input = screen.getByPlaceholderText(placeholder) as HTMLTextAreaElement;
      
      // Navigate up twice
      input.setSelectionRange(0, 0);
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      input.setSelectionRange(0, 0);
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('Second message');
      
      // Navigate down
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(input.value).toBe('Third message');
    });

    it('returns to current message when navigating past most recent', () => {
      render(<MessageInput onSend={mockOnSend} userMessages={userMessages} />);
      
      const input = screen.getByPlaceholderText(placeholder) as HTMLTextAreaElement;
      
      // Type something
      fireEvent.input(input, { target: { value: 'Current message' } });
      
      // Navigate up then down
      input.setSelectionRange(0, 0);
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('Third message');
      
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(input.value).toBe('Current message');
    });

    it('submits message with Enter key', () => {
      render(<MessageInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText(placeholder);
      
      fireEvent.input(input, { target: { value: 'Enter test' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(mockOnSend).toHaveBeenCalledWith('Enter test');
    });

    it('creates new line with Shift+Enter', () => {
      render(<MessageInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText(placeholder);
      
      fireEvent.input(input, { target: { value: 'Line 1' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
      
      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('does not navigate history when cursor is not at position 0', () => {
      render(<MessageInput onSend={mockOnSend} userMessages={userMessages} />);
      
      const input = screen.getByPlaceholderText(placeholder) as HTMLTextAreaElement;
      
      // Type something and move cursor to middle
      fireEvent.input(input, { target: { value: 'Current text' } });
      input.setSelectionRange(5, 5); // Cursor in middle of text
      
      // Try to navigate up
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      
      // Should not change the value
      expect(input.value).toBe('Current text');
    });
  });
});