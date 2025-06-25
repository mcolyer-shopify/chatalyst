import { ImagePreview } from './ImagePreview';
import type { PendingImage } from '../types';

interface ImageAttachmentProps {
  pendingImages: PendingImage[];
  isProcessingImages: boolean;
  onRemove: (imageId: string) => void;
}

export function ImageAttachment({
  pendingImages,
  isProcessingImages,
  onRemove
}: ImageAttachmentProps) {
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
          <ImagePreview images={pendingImages} onRemove={onRemove} />
        </div>
      )}
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