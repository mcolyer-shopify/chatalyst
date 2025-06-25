import { JSX } from 'preact';
import type { PendingImage } from '../types';
import { formatFileSize } from '../utils/images';

interface ImagePreviewProps {
  images: PendingImage[];
  onRemove: (imageId: string) => void;
}

export function ImagePreview({ images, onRemove }: ImagePreviewProps): JSX.Element | null {
  if (images.length === 0) {
    return null;
  }

  return (
    <div class="image-preview-container">
      {images.map((image) => (
        <div key={image.id} class="image-preview-item">
          <div class="image-preview-wrapper">
            <img 
              src={image.preview} 
              alt={image.file.name}
              class="image-preview-thumbnail"
            />
            <button
              class="image-preview-remove"
              onClick={() => onRemove(image.id)}
              title="Remove image"
              type="button"
            >
              ×
            </button>
          </div>
          <div class="image-preview-info">
            <div class="image-preview-filename" title={image.file.name}>
              {image.file.name}
            </div>
            <div class="image-preview-size">
              {formatFileSize(image.file.size)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}