import { useState, useRef, useEffect } from 'preact/hooks';
import { ImagePreview } from './ImagePreview';
import { createPendingImage, validateImageFile, getImageFromClipboard, handleFileInput } from '../utils/images';
import type { PendingImage } from '../types';

interface MessageInputProps {
  onSend: (message: string, images?: PendingImage[]) => void;
  onStopGeneration?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  userMessages?: string[]; // Array of previous user messages
  conversationId?: string; // Track conversation changes for auto-focus
}

export function MessageInput({ onSend, onStopGeneration, disabled = false, isGenerating = false, userMessages = [], conversationId }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means current message
  const [tempMessage, setTempMessage] = useState(''); // Store current message when navigating history
  const [isStopping, setIsStopping] = useState(false); // Track if we're in the process of stopping
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when component mounts, becomes enabled, or conversation changes
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled, conversationId]);

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

  // Clear images when conversation changes
  useEffect(() => {
    setPendingImages([]);
  }, [conversationId]);

  const handleImageSelect = async (files: File[]) => {
    const validImages: PendingImage[] = [];
    
    for (const file of files) {
      const validation = validateImageFile(file);
      if (validation.valid) {
        try {
          const pendingImage = await createPendingImage(file);
          validImages.push(pendingImage);
        } catch (error) {
          console.error('Failed to create image preview:', error);
        }
      } else {
        console.error('Invalid image file:', validation.error);
        // TODO: Show error notification to user
      }
    }
    
    if (validImages.length > 0) {
      setPendingImages(prev => [...prev, ...validImages]);
    }
  };

  const handleFileInputChange = (event: Event) => {
    const files = handleFileInput(event);
    if (files.length > 0) {
      handleImageSelect(files);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImagePaste = async (event: ClipboardEvent) => {
    const imageFile = getImageFromClipboard(event);
    if (imageFile) {
      event.preventDefault();
      await handleImageSelect([imageFile]);
    }
  };

  const removeImage = (imageId: string) => {
    setPendingImages(prev => prev.filter(img => img.id !== imageId));
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

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

  return (
    <div class="message-input-container">
      <ImagePreview images={pendingImages} onRemove={removeImage} />
      <form class="message-input" onSubmit={handleSubmit}>
        <div class="message-input-content">
          <div class="message-input-toolbar">
            <button
              type="button"
              onClick={openFileDialog}
              disabled={disabled && !isGenerating}
              class="message-input-attach-button"
              title="Attach image"
            >
              📎
            </button>
          </div>
          <textarea
            ref={inputRef}
            value={message}
            onInput={(e) => setMessage(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onPaste={handleImagePaste}
            placeholder="Type a message... (Shift+Enter for new line, Ctrl+V to paste images)"
            disabled={disabled && !isGenerating}
            class="message-input-field"
            rows={1}
          />
          <button
            type="submit"
            disabled={isStopping || (!isGenerating && (disabled || (!message.trim() && pendingImages.length === 0)))}
            class={`message-send-button ${isGenerating ? 'stop-button' : ''} ${isStopping ? 'stopping' : ''}`}
          >
            {isStopping ? 'Stopping...' : isGenerating ? 'Stop' : 'Send'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
      </form>
    </div>
  );
}