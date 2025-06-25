import { useState, useRef, useEffect } from 'preact/hooks';
import type { PendingImage } from '../types';

interface MessageFormProps {
  message: string;
  setMessage: (message: string) => void;
  onSend: (message: string, images?: PendingImage[]) => void;
  onStopGeneration?: () => void;
  disabled: boolean;
  isGenerating: boolean;
  pendingImages: PendingImage[];
  setPendingImages: (images: PendingImage[]) => void;
  setHistoryIndex: (index: number) => void;
  setTempMessage: (message: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onPaste: (e: ClipboardEvent) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

export function MessageForm({
  message,
  setMessage,
  onSend,
  onStopGeneration,
  disabled,
  isGenerating,
  pendingImages,
  setPendingImages,
  setHistoryIndex,
  setTempMessage,
  onKeyDown,
  onPaste,
  inputRef
}: MessageFormProps) {
  const [isStopping, setIsStopping] = useState(false);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e?: Event) => {
    if (e) e.preventDefault();
    
    if (isGenerating && onStopGeneration) {
      setIsStopping(true);
      onStopGeneration();
      // Reset stopping state after a short delay
      setTimeout(() => setIsStopping(false), 500);
    } else if ((message.trim() || pendingImages.length > 0) && !disabled && !isGenerating) {
      onSend(message.trim(), pendingImages.length > 0 ? pendingImages : undefined);
      setMessage('');
      setPendingImages([]);
      setHistoryIndex(-1);
      setTempMessage('');
    }
  };

  const combinedKeyDown = (e: KeyboardEvent) => {
    // Handle Enter for form submission
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }
    
    // Pass through to history navigation
    onKeyDown(e);
  };

  return (
    <form class="message-input" onSubmit={handleSubmit}>
      <div class="message-input-content">
        <textarea
          ref={inputRef}
          value={message}
          onInput={(e) => setMessage(e.currentTarget.value)}
          onKeyDown={combinedKeyDown}
          onPaste={onPaste}
          placeholder="Type a message... (Shift+Enter for new line, Ctrl+V to paste images)"
          disabled={disabled && !isGenerating}
          class="message-input-field"
          rows={1}
          aria-label="Message input"
          aria-describedby="message-input-instructions"
        />
        <button
          type="submit"
          disabled={isStopping || (!isGenerating && (disabled || (!message.trim() && pendingImages.length === 0)))}
          class={`message-send-button ${isGenerating ? 'stop-button' : ''} ${isStopping ? 'stopping' : ''}`}
          aria-label={
            isStopping ? 'Stopping message generation' : 
              isGenerating ? 'Stop message generation' : 
                'Send message'
          }
        >
          {isStopping ? 'Stopping...' : isGenerating ? 'Stop' : 'Send'}
        </button>
      </div>
      <div 
        id="message-input-instructions" 
        class="sr-only"
      >
        Use Shift+Enter for new line, Ctrl+V to paste images, or click the attach button to select image files.
      </div>
    </form>
  );
}

// Custom hook to provide input ref access
export function useMessageFormRef() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  return inputRef;
}