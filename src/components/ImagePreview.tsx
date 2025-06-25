import { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import type { PendingImage } from '../types';

interface ImagePreviewProps {
  images: PendingImage[];
  onRemove: (imageId: string) => void;
}

export function ImagePreview({ images, onRemove }: ImagePreviewProps): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return null;
  }

  const handleKeyDown = (e: KeyboardEvent, imageId: string, index: number) => {
    const container = containerRef.current;
    if (!container) return;

    const buttons = container.querySelectorAll('.image-preview-remove') as NodeListOf<HTMLButtonElement>;
    
    switch (e.key) {
    case 'Delete':
    case 'Backspace': {
      e.preventDefault();
      onRemove(imageId);
      
      // Focus next button if available, otherwise previous
      const nextIndex = index < buttons.length - 1 ? index : index - 1;
      if (nextIndex >= 0 && buttons[nextIndex]) {
        setTimeout(() => buttons[nextIndex].focus(), 0);
      }
      break;
    }
      
    case 'ArrowLeft':
      e.preventDefault();
      if (index > 0 && buttons[index - 1]) {
        buttons[index - 1].focus();
      }
      break;
      
    case 'ArrowRight':
      e.preventDefault();
      if (index < buttons.length - 1 && buttons[index + 1]) {
        buttons[index + 1].focus();
      }
      break;
      
    case 'Home':
      e.preventDefault();
      if (buttons[0]) {
        buttons[0].focus();
      }
      break;
      
    case 'End':
      e.preventDefault();
      if (buttons[buttons.length - 1]) {
        buttons[buttons.length - 1].focus();
      }
      break;
    }
  };

  return (
    <div 
      ref={containerRef}
      class="image-preview-container"
      role="region"
      aria-label={`${images.length} image${images.length === 1 ? '' : 's'} attached. Use arrow keys to navigate, Delete or Backspace to remove.`}
    >
      {images.map((image, index) => (
        <div key={image.id} class="image-preview-item">
          <div class="image-preview-wrapper">
            <img 
              src={image.preview} 
              alt={`Preview of ${image.file.name} (${(image.file.size / 1024).toFixed(1)} KB)`}
              class="image-preview-thumbnail"
              role="img"
            />
            <button
              class="image-preview-remove"
              onClick={() => onRemove(image.id)}
              onKeyDown={(e) => handleKeyDown(e, image.id, index)}
              title={`Remove ${image.file.name} from attachments`}
              aria-label={`Remove ${image.file.name} from attachments (${index + 1} of ${images.length})`}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}