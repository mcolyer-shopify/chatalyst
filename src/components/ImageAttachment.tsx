import { useRef } from 'preact/hooks';
import { ImagePreview } from './ImagePreview';
import { createPendingImage, validateImageFile, handleFileInput, getImageFromClipboard } from '../utils/images';
import type { PendingImage } from '../types';

interface ImageAttachmentProps {
  pendingImages: PendingImage[];
  setPendingImages: (images: PendingImage[] | ((prev: PendingImage[]) => PendingImage[])) => void;
  setErrorMessage: (message: string | null) => void;
  isProcessingImages: boolean;
  setIsProcessingImages: (processing: boolean) => void;
  disabled: boolean;
  isGenerating: boolean;
}

export function ImageAttachment({
  pendingImages,
  setPendingImages,
  setErrorMessage,
  isProcessingImages,
  setIsProcessingImages,
  disabled,
  isGenerating
}: ImageAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsProcessingImages(true);
    const validImages: PendingImage[] = [];
    let _hasErrors = false;
    
    try {
      for (const file of files) {
        const validation = validateImageFile(file);
        if (validation.valid) {
          try {
            const pendingImage = await createPendingImage(file);
            validImages.push(pendingImage);
          } catch (error) {
            console.error('Failed to create image preview:', error);
            setErrorMessage(`Failed to process image "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
            _hasErrors = true;
          }
        } else {
          console.error('Invalid image file:', validation.error);
          setErrorMessage(`${file.name}: ${validation.error}`);
          _hasErrors = true;
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

  const handleAttachKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFileDialog();
    }
  };

  return (
    <>
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
      <div class="message-input-toolbar">
        <button
          type="button"
          onClick={openFileDialog}
          onKeyDown={handleAttachKeyDown}
          disabled={(disabled && !isGenerating) || isProcessingImages}
          class={`message-input-attach-button ${isProcessingImages ? 'processing' : ''}`}
          title={isProcessingImages ? 'Processing images...' : 'Attach image'}
          aria-label={isProcessingImages ? 'Processing images, please wait' : 'Attach image file'}
          aria-describedby={isProcessingImages ? 'processing-status' : undefined}
        >
          <span aria-hidden="true">
            {isProcessingImages ? '⏳' : '📎'}
          </span>
        </button>
      </div>
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