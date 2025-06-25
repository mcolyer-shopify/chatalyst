import { useState, useRef, useEffect } from 'preact/hooks';
import { ErrorToast } from './ErrorToast';
import { ImageAttachment } from './ImageAttachment';
import { MessageForm } from './MessageForm';
import { useMessageHistory } from './MessageHistory';
import { getImageFromClipboard, validateImageFileSecure, createPendingImage } from '../utils/images';
import type { PendingImage } from '../types';

interface MessageInputProps {
  onSend: (message: string, images?: PendingImage[]) => void;
  onStopGeneration?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  userMessages?: string[]; // Array of previous user messages
  conversationId?: string; // Track conversation changes for auto-focus
}

export function MessageInput({ 
  onSend, 
  onStopGeneration, 
  disabled = false, 
  isGenerating = false, 
  userMessages = [], 
  conversationId 
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means current message
  const [tempMessage, setTempMessage] = useState(''); // Store current message when navigating history
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize message history hook
  const { handleKeyDown } = useMessageHistory({
    message,
    setMessage,
    historyIndex,
    setHistoryIndex,
    tempMessage,
    setTempMessage,
    userMessages,
    inputRef
  });

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

  // Clear images and errors when conversation changes
  useEffect(() => {
    setPendingImages([]);
    setErrorMessage(null);
    setIsProcessingImages(false);
  }, [conversationId]);

  // Handle image paste directly here
  const handleImagePaste = async (event: ClipboardEvent) => {
    const imageFile = getImageFromClipboard(event);
    if (imageFile) {
      event.preventDefault();
      
      setIsProcessingImages(true);
      try {
        const validation = await validateImageFileSecure(imageFile);
        if (validation.valid) {
          const pendingImage = await createPendingImage(imageFile);
          setPendingImages(prev => [...prev, pendingImage]);
        } else {
          setErrorMessage(`${imageFile.name}: ${validation.error}`);
        }
      } catch (error) {
        setErrorMessage(`Failed to process image "${imageFile.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsProcessingImages(false);
      }
    }
  };

  return (
    <div class="message-input-container">
      {errorMessage && (
        <ErrorToast 
          message={errorMessage} 
          onClose={() => setErrorMessage(null)} 
        />
      )}
      
      <ImageAttachment
        pendingImages={pendingImages}
        setPendingImages={setPendingImages}
        setErrorMessage={setErrorMessage}
        isProcessingImages={isProcessingImages}
        setIsProcessingImages={setIsProcessingImages}
        disabled={disabled}
        isGenerating={isGenerating}
      />
      
      <MessageForm
        message={message}
        setMessage={setMessage}
        onSend={onSend}
        onStopGeneration={onStopGeneration}
        disabled={disabled}
        isGenerating={isGenerating}
        pendingImages={pendingImages}
        setPendingImages={setPendingImages}
        setHistoryIndex={setHistoryIndex}
        setTempMessage={setTempMessage}
        onKeyDown={handleKeyDown}
        onPaste={handleImagePaste}
        inputRef={inputRef}
      />
    </div>
  );
}