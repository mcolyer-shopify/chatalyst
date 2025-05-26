import { useState } from 'preact/hooks';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  return (
    <form class="message-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={message}
        onInput={(e) => setMessage(e.currentTarget.value)}
        placeholder="Type a message..."
        disabled={disabled}
        class="message-input-field"
      />
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        class="message-send-button"
      >
        Send
      </button>
    </form>
  );
}