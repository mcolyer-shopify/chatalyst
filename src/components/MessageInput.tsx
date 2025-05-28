import { useState, useRef, useEffect } from 'preact/hooks';

interface MessageInputProps {
  onSend: (message: string) => void;
  onStopGeneration?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  userMessages?: string[]; // Array of previous user messages
}

export function MessageInput({ onSend, onStopGeneration, disabled = false, isGenerating = false, userMessages = [] }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means current message
  const [tempMessage, setTempMessage] = useState(''); // Store current message when navigating history
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the input when component mounts or becomes enabled
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  // Reset history index when message changes manually
  useEffect(() => {
    if (historyIndex === -1) {
      setTempMessage(message);
    }
  }, [message, historyIndex]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleKeyDown = (e: KeyboardEvent) => {
    const textarea = e.currentTarget as HTMLTextAreaElement;
    
    if (e.key === 'ArrowUp') {
      // Only navigate history if cursor is at position 0
      if (textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
        if (userMessages.length > 0) {
          e.preventDefault();
          
          if (historyIndex === -1) {
            // Save current message before navigating
            setTempMessage(message);
          }
          
          const newIndex = Math.min(historyIndex + 1, userMessages.length - 1);
          if (newIndex !== historyIndex) {
            setHistoryIndex(newIndex);
            const historicalMessage = userMessages[userMessages.length - 1 - newIndex];
            setMessage(historicalMessage);
            
            // Set cursor to beginning
            setTimeout(() => {
              if (inputRef.current) {
                inputRef.current.setSelectionRange(0, 0);
              }
            }, 0);
          }
        }
      }
    } else if (e.key === 'ArrowDown') {
      // Only navigate history if we're in history mode
      if (historyIndex >= 0) {
        e.preventDefault();
        
        const newIndex = historyIndex - 1;
        if (newIndex >= 0) {
          setHistoryIndex(newIndex);
          const historicalMessage = userMessages[userMessages.length - 1 - newIndex];
          setMessage(historicalMessage);
        } else {
          // Return to current message
          setHistoryIndex(-1);
          setMessage(tempMessage);
        }
        
        // Set cursor to end
        setTimeout(() => {
          if (inputRef.current) {
            const length = inputRef.current.value.length;
            inputRef.current.setSelectionRange(length, length);
          }
        }, 0);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Submit on Enter (without Shift)
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = (e?: Event) => {
    if (e) e.preventDefault();
    
    if (isGenerating && onStopGeneration) {
      onStopGeneration();
    } else if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
      setHistoryIndex(-1);
      setTempMessage('');
    }
  };

  return (
    <form class="message-input" onSubmit={handleSubmit}>
      <textarea
        ref={inputRef}
        value={message}
        onInput={(e) => setMessage(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (Shift+Enter for new line)"
        disabled={disabled}
        class="message-input-field"
        rows={1}
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