import { useState, useRef, useEffect } from 'preact/hooks';

interface MessageInputProps {
  onSend: (message: string) => void;
  onStopGeneration?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
}

export function MessageInput({ onSend, onStopGeneration, disabled = false, isGenerating = false }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when component mounts or becomes enabled
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (isGenerating && onStopGeneration) {
      onStopGeneration();
    } else if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  return (
    <form class="message-input" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
        value={message}
        onInput={(e) => setMessage(e.currentTarget.value)}
        placeholder="Type a message..."
        disabled={disabled}
        class="message-input-field"
      />
      <button
        type="submit"
        disabled={isGenerating ? false : (disabled || !message.trim())}
        class={`message-send-button ${isGenerating ? 'stop-button' : ''}`}
      >
        {isGenerating ? 'Stop' : 'Send'}
      </button>
    </form>
  );
}