import { useState, useRef, useEffect } from 'preact/hooks';
import { handleFileInput } from '../utils/images';
import type { PendingImage } from '../types';
import { RecentPromptPicker } from './RecentPromptPicker';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

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
  inputRef: { current: HTMLTextAreaElement | null };
  isProcessingImages: boolean;
  onImageSelect: (files: File[]) => Promise<void>;
  onOpenPromptLibrary: () => void;
  onSelectPrompt: (content: string) => void;
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
  inputRef,
  isProcessingImages,
  onImageSelect,
  onOpenPromptLibrary,
  onSelectPrompt
}: MessageFormProps) {
  const [isStopping, setIsStopping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Detect if we're on macOS
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // Speech recognition hook
  const {
    isSupported: isSpeechSupported,
    isListening,
    isProcessing: isSpeechProcessing,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    clearTranscript
  } = useSpeechRecognition();

  // Auto-resize textarea based on content (but not for interim text)
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [message]);

  // Hotkey for speech recognition (right Cmd key)
  useEffect(() => {
    if (!isSpeechSupported) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for right Cmd key (location 2 = right modifier key)
      if (event.key === 'Meta' && event.location === 2) {
        event.preventDefault();
        if (!isListening) {
          startListening();
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Release right Cmd key to stop recording
      if (event.key === 'Meta' && event.location === 2 && isListening) {
        event.preventDefault();
        stopListening();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpeechSupported, isListening, startListening, stopListening]);

  // Track cursor position for speech insertion
  const cursorPositionRef = useRef<number>(0);

  // Update cursor position when user interacts with textarea
  const handleCursorChange = () => {
    if (inputRef.current) {
      cursorPositionRef.current = inputRef.current.selectionStart || 0;
    }
  };

  // Handle speech recognition transcript
  useEffect(() => {
    if (transcript && inputRef.current) {
      const cursorPos = cursorPositionRef.current;
      const beforeCursor = message.slice(0, cursorPos);
      const afterCursor = message.slice(cursorPos);
      const newMessage = beforeCursor + transcript + afterCursor;
      
      setMessage(newMessage);
      
      // Update cursor position to after inserted text
      const newCursorPos = cursorPos + transcript.length;
      cursorPositionRef.current = newCursorPos;
      
      // Set cursor position after state update
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
      
      clearTranscript();
    }
  }, [transcript, message, setMessage, clearTranscript]);

  // Update message with interim transcript at cursor position
  const cursorPos = cursorPositionRef.current;
  const beforeCursor = message.slice(0, cursorPos);
  const afterCursor = message.slice(cursorPos);
  const displayValue = beforeCursor + interimTranscript + afterCursor;

  const handleFileInputChange = (event: Event) => {
    const files = handleFileInput(event);
    if (files.length > 0) {
      onImageSelect(files);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const toggleSpeechRecognition = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
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
        <button
          type="button"
          onClick={openFileDialog}
          disabled={(disabled && !isGenerating) || isProcessingImages}
          class={`message-input-attach-button ${isProcessingImages ? 'processing' : ''}`}
          title={isProcessingImages ? 'Processing images...' : 'Attach image'}
          aria-label={isProcessingImages ? 'Processing images, please wait' : 'Attach image file'}
        >
          <span aria-hidden="true">
            {isProcessingImages ? '⏳' : '📎'}
          </span>
        </button>
        {isSpeechSupported && (
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            disabled={disabled && !isGenerating}
            class={`message-input-mic-button ${isListening ? 'listening' : ''} ${isSpeechProcessing ? 'processing' : ''}`}
            title={
              isListening ? 'Stop recording' : 
                isSpeechProcessing ? 'Starting microphone...' : 
                  'Start voice input'
            }
            aria-label={
              isListening ? 'Stop voice recording' : 
                isSpeechProcessing ? 'Starting microphone, please wait' : 
                  'Start voice input'
            }
          >
            <span aria-hidden="true">
              {isSpeechProcessing ? '⏳' : isListening ? '⏸️' : '🎤'}
            </span>
          </button>
        )}
        <RecentPromptPicker
          onSelectPrompt={onSelectPrompt}
          onOpenFullLibrary={onOpenPromptLibrary}
          disabled={disabled && !isGenerating}
        />
        <textarea
          ref={inputRef}
          value={displayValue}
          onInput={(e) => {
            setMessage(e.currentTarget.value);
            handleCursorChange();
          }}
          onKeyDown={(e) => {
            combinedKeyDown(e);
            handleCursorChange();
          }}
          onPaste={onPaste}
          onClick={handleCursorChange}
          onSelect={handleCursorChange}
          placeholder={`Type a message... (${isMac ? '⌘V' : 'Ctrl+V'} for images${isSpeechSupported ? ', 🎤 for voice' : ''})`}
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
        Use Shift+Enter for new line, {isMac ? 'Cmd+V' : 'Ctrl+V'} to paste images, click the attach button to select image files{isSpeechSupported ? ', or click the microphone button for voice input' : ''}.
      </div>
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        aria-label="Select image files to attach"
      />
    </form>
  );
}

// Custom hook to provide input ref access
export function useMessageFormRef() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  return inputRef;
}