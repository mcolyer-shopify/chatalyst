import { useRef, useEffect } from 'preact/hooks';
import { ImagePreview } from './ImagePreview';
import { createPendingImage, validateImageFileSecure, handleFileInput, getImageFromClipboard } from '../utils/images';
import type { PendingImage } from '../types';

interface ImageAttachmentProps {
  pendingImages: PendingImage[];
  setPendingImages: (images: PendingImage[] | ((prev: PendingImage[]) => PendingImage[])) => void;
  setErrorMessage: (message: string | null) => void;
  isProcessingImages: boolean;
  setIsProcessingImages: (processing: boolean) => void;
  onOpenFileDialog?: (fn: () => void) => void;
}

export function ImageAttachment({
  pendingImages,
  setPendingImages,
  setErrorMessage,
  isProcessingImages,
  setIsProcessingImages,
  onOpenFileDialog
}: ImageAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsProcessingImages(true);
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
            setErrorMessage(`Failed to process image "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } else {
          console.error('Invalid image file:', validation.error);
          setErrorMessage(`${file.name}: ${validation.error}`);
        }
      }
      
      if (validImages.length > 0) {
        setPendingImages(prev => [...prev, ...validImages]);
      }
    } finally {
      setIsProcessingImages(false);
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

  const removeImage = (imageId: string) => {
    setPendingImages(prev => prev.filter(img => img.id !== imageId));
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  // Expose the openFileDialog function to parent component
  useEffect(() => {
    if (onOpenFileDialog) {
      onOpenFileDialog(openFileDialog);
    }
  }, [onOpenFileDialog]);


  return (
    <>
      {/* Only show processing and preview sections when there's something to show */}
      {(isProcessingImages || pendingImages.length > 0) && (
        <div class="image-attachment-section">
          {isProcessingImages && (
            <div 
              class="image-processing-indicator"
              role="status"
              aria-live="polite"
              aria-label="Processing images"
            >
              <span class="processing-text">Processing images...</span>
              <span class="processing-spinner" aria-hidden="true">⏳</span>
            </div>
          )}
          <ImagePreview images={pendingImages} onRemove={removeImage} />
        </div>
      )}
      
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
    </>
  );
}

// Export the attachment button as a separate component to be used inline with the form
export function AttachmentButton({
  onClick,
  disabled,
  isProcessingImages
}: {
  onClick: () => void;
  disabled: boolean;
  isProcessingImages: boolean;
}) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      disabled={disabled || isProcessingImages}
      class={`message-input-attach-button ${isProcessingImages ? 'processing' : ''}`}
      title={isProcessingImages ? 'Processing images...' : 'Attach image'}
      aria-label={isProcessingImages ? 'Processing images, please wait' : 'Attach image file'}
      aria-describedby={isProcessingImages ? 'processing-status' : undefined}
    >
      <span aria-hidden="true">
        {isProcessingImages ? '⏳' : '📎'}
      </span>
    </button>
  );
}

// Export the paste handler for external use
export function createImagePasteHandler(handleImageSelect: (files: File[]) => Promise<void>) {
  return async (event: ClipboardEvent) => {
    const imageFile = getImageFromClipboard(event);
    if (imageFile) {
      event.preventDefault();
      await handleImageSelect([imageFile]);
    }
  };
}