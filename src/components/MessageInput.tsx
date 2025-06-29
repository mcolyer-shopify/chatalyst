import { useReducer, useRef, useEffect } from 'preact/hooks';
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
  onOpenPromptLibrary: () => void;
  selectedPromptContent?: string;
}

interface MessageInputState {
  message: string;
  historyIndex: number; // -1 means current message
  tempMessage: string; // Store current message when navigating history
  pendingImages: PendingImage[];
  errorMessage: string | null;
  isProcessingImages: boolean;
}

type MessageInputAction = 
  | { type: 'SET_MESSAGE'; payload: string }
  | { type: 'SET_HISTORY_INDEX'; payload: number }
  | { type: 'SET_TEMP_MESSAGE'; payload: string }
  | { type: 'SET_PENDING_IMAGES'; payload: PendingImage[] }
  | { type: 'ADD_PENDING_IMAGE'; payload: PendingImage }
  | { type: 'SET_ERROR_MESSAGE'; payload: string | null }
  | { type: 'SET_IS_PROCESSING_IMAGES'; payload: boolean }
  | { type: 'RESET_FOR_NEW_CONVERSATION' }
  | { type: 'UPDATE_TEMP_MESSAGE_FROM_MESSAGE'; payload: string };

const initialState: MessageInputState = {
  message: '',
  historyIndex: -1,
  tempMessage: '',
  pendingImages: [],
  errorMessage: null,
  isProcessingImages: false
};

function messageInputReducer(state: MessageInputState, action: MessageInputAction): MessageInputState {
  switch (action.type) {
  case 'SET_MESSAGE':
    return { ...state, message: action.payload };
  case 'SET_HISTORY_INDEX':
    return { ...state, historyIndex: action.payload };
  case 'SET_TEMP_MESSAGE':
    return { ...state, tempMessage: action.payload };
  case 'SET_PENDING_IMAGES':
    return { ...state, pendingImages: action.payload };
  case 'ADD_PENDING_IMAGE':
    return { ...state, pendingImages: [...state.pendingImages, action.payload] };
  case 'SET_ERROR_MESSAGE':
    return { ...state, errorMessage: action.payload };
  case 'SET_IS_PROCESSING_IMAGES':
    return { ...state, isProcessingImages: action.payload };
  case 'RESET_FOR_NEW_CONVERSATION':
    return { ...state, pendingImages: [], errorMessage: null, isProcessingImages: false };
  case 'UPDATE_TEMP_MESSAGE_FROM_MESSAGE':
    return { ...state, tempMessage: action.payload };
  default:
    return state;
  }
}

export function MessageInput({ 
  onSend, 
  onStopGeneration, 
  disabled = false, 
  isGenerating = false, 
  userMessages = [], 
  conversationId,
  onOpenPromptLibrary,
  selectedPromptContent
}: MessageInputProps) {
  const [state, dispatch] = useReducer(messageInputReducer, initialState);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize message history hook
  const { handleKeyDown } = useMessageHistory({
    message: state.message,
    setMessage: (message: string) => dispatch({ type: 'SET_MESSAGE', payload: message }),
    historyIndex: state.historyIndex,
    setHistoryIndex: (index: number) => dispatch({ type: 'SET_HISTORY_INDEX', payload: index }),
    tempMessage: state.tempMessage,
    setTempMessage: (message: string) => dispatch({ type: 'SET_TEMP_MESSAGE', payload: message }),
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
    if (state.historyIndex === -1) {
      dispatch({ type: 'UPDATE_TEMP_MESSAGE_FROM_MESSAGE', payload: state.message });
    }
  }, [state.message, state.historyIndex]);

  // Handle selected prompt content
  useEffect(() => {
    if (selectedPromptContent) {
      dispatch({ type: 'SET_MESSAGE', payload: selectedPromptContent });
      // Focus the input after setting the prompt
      if (inputRef.current) {
        inputRef.current.focus();
        // Move cursor to the end
        inputRef.current.setSelectionRange(selectedPromptContent.length, selectedPromptContent.length);
      }
    }
  }, [selectedPromptContent]);

  // Clear images and errors when conversation changes
  useEffect(() => {
    dispatch({ type: 'RESET_FOR_NEW_CONVERSATION' });
  }, [conversationId]);

  // Handle image paste directly here
  const handleImagePaste = async (event: ClipboardEvent) => {
    const imageFile = getImageFromClipboard(event);
    if (imageFile) {
      event.preventDefault();
      
      dispatch({ type: 'SET_IS_PROCESSING_IMAGES', payload: true });
      try {
        const validation = await validateImageFileSecure(imageFile);
        if (validation.valid) {
          const pendingImage = await createPendingImage(imageFile);
          dispatch({ type: 'ADD_PENDING_IMAGE', payload: pendingImage });
        } else {
          dispatch({ type: 'SET_ERROR_MESSAGE', payload: `${imageFile.name}: ${validation.error}` });
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR_MESSAGE', payload: `Failed to process image "${imageFile.name}": ${error instanceof Error ? error.message : 'Unknown error'}` });
      } finally {
        dispatch({ type: 'SET_IS_PROCESSING_IMAGES', payload: false });
      }
    }
  };

  return (
    <div class="message-input-container">
      {state.errorMessage && (
        <ErrorToast 
          message={state.errorMessage} 
          onClose={() => dispatch({ type: 'SET_ERROR_MESSAGE', payload: null })} 
        />
      )}
      
      <ImageAttachment
        pendingImages={state.pendingImages}
        isProcessingImages={state.isProcessingImages}
        onRemove={(imageId: string) => {
          dispatch({ type: 'SET_PENDING_IMAGES', payload: state.pendingImages.filter(img => img.id !== imageId) });
        }}
      />
      
      <MessageForm
        message={state.message}
        setMessage={(message: string) => dispatch({ type: 'SET_MESSAGE', payload: message })}
        onSend={onSend}
        onStopGeneration={onStopGeneration}
        disabled={disabled}
        isGenerating={isGenerating}
        pendingImages={state.pendingImages}
        setPendingImages={(images: PendingImage[] | ((prev: PendingImage[]) => PendingImage[])) => {
          if (typeof images === 'function') {
            dispatch({ type: 'SET_PENDING_IMAGES', payload: images(state.pendingImages) });
          } else {
            dispatch({ type: 'SET_PENDING_IMAGES', payload: images });
          }
        }}
        setHistoryIndex={(index: number) => dispatch({ type: 'SET_HISTORY_INDEX', payload: index })}
        setTempMessage={(message: string) => dispatch({ type: 'SET_TEMP_MESSAGE', payload: message })}
        onKeyDown={handleKeyDown}
        onPaste={handleImagePaste}
        inputRef={inputRef}
        isProcessingImages={state.isProcessingImages}
        onImageSelect={async (files: File[]) => {
          dispatch({ type: 'SET_IS_PROCESSING_IMAGES', payload: true });
          const validImages: PendingImage[] = [];
          
          try {
            for (const file of files) {
              const validation = await validateImageFileSecure(file);
              if (validation.valid) {
                try {
                  const pendingImage = await createPendingImage(file);
                  validImages.push(pendingImage);
                } catch (error) {
                  console.error('Failed to create image preview:', error);
                  dispatch({ type: 'SET_ERROR_MESSAGE', payload: `Failed to process image "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}` });
                }
              } else {
                console.error('Invalid image file:', validation.error);
                dispatch({ type: 'SET_ERROR_MESSAGE', payload: `${file.name}: ${validation.error}` });
              }
            }
            
            if (validImages.length > 0) {
              dispatch({ type: 'SET_PENDING_IMAGES', payload: [...state.pendingImages, ...validImages] });
            }
          } finally {
            dispatch({ type: 'SET_IS_PROCESSING_IMAGES', payload: false });
          }
        }}
        onOpenPromptLibrary={onOpenPromptLibrary}
      />
    </div>
  );
}