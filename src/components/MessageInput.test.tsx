import { render, screen, fireEvent } from '@testing-library/preact';
import { MessageInput } from './MessageInput';

describe('MessageInput', () => {
  const mockOnSend = vi.fn();

  beforeEach(() => {
    mockOnSend.mockClear();
  });

  it('renders input field and send button', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('calls onSend with message when form is submitted', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const form = input.closest('form')!;
    
    fireEvent.input(input, { target: { value: 'Hello world' } });
    fireEvent.submit(form);
    
    expect(mockOnSend).toHaveBeenCalledWith('Hello world');
    expect(mockOnSend).toHaveBeenCalledTimes(1);
  });

  it('clears input after sending message', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const input = screen.getByPlaceholderText('Type a message...') as HTMLInputElement;
    const form = input.closest('form')!;
    
    fireEvent.input(input, { target: { value: 'Hello world' } });
    fireEvent.submit(form);
    
    expect(input.value).toBe('');
  });

  it('does not send empty messages', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const form = input.closest('form')!;
    
    fireEvent.input(input, { target: { value: '' } });
    fireEvent.submit(form);
    
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('trims whitespace from messages', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const form = input.closest('form')!;
    
    fireEvent.input(input, { target: { value: '  Hello world  ' } });
    fireEvent.submit(form);
    
    expect(mockOnSend).toHaveBeenCalledWith('Hello world');
  });

  it('disables send button when input is empty', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const sendButton = screen.getByText('Send');
    expect(sendButton).toBeDisabled();
    
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.input(input, { target: { value: 'Hello' } });
    
    expect(sendButton).not.toBeDisabled();
  });

  it('disables input and button when disabled prop is true', () => {
    render(<MessageInput onSend={mockOnSend} disabled={true} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByText('Send');
    
    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('does not call onSend when disabled', () => {
    render(<MessageInput onSend={mockOnSend} disabled={true} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const form = input.closest('form')!;
    
    fireEvent.input(input, { target: { value: 'Hello world' } });
    fireEvent.submit(form);
    
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('handles clicking send button', () => {
    render(<MessageInput onSend={mockOnSend} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
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
    
    const input = screen.getByPlaceholderText('Type a message...') as HTMLInputElement;
    
    fireEvent.input(input, { target: { value: 'H' } });
    expect(input.value).toBe('H');
    
    fireEvent.input(input, { target: { value: 'Hello' } });
    expect(input.value).toBe('Hello');
  });
});