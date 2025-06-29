import { useState, useEffect } from 'preact/hooks';
import { JSX } from 'preact';
import { getImage, createDataURL } from '../utils/images';
import type { StoredImage } from '../types';

interface MessageImageProps {
  imageId: number;
  className?: string;
}

export function MessageImage({ imageId, className = '' }: MessageImageProps): JSX.Element {
  const [image, setImage] = useState<StoredImage | null>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    async function loadImage() {
      try {
        setLoading(true);
        setError('');
        
        const imageData = await getImage(imageId);
        
        if (!mounted) return;
        
        setImage(imageData);
        const url = createDataURL(imageData.data, imageData.mime_type);
        setDataUrl(url);
      } catch (err) {
        if (!mounted) return;
        
        console.error('Failed to load image:', err);
        setError(err instanceof Error ? err.message : 'Failed to load image');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      mounted = false;
    };
  }, [imageId]);

  if (loading) {
    return (
      <div 
        class={`message-image-loading ${className}`}
        role="img" 
        aria-label="Loading image"
      >
        <div class="message-image-spinner" aria-hidden="true" />
        <span aria-live="polite">Loading image...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        class={`message-image-error ${className}`}
        role="alert" 
        aria-label="Image failed to load"
      >
        <span>Failed to load image: {error}</span>
      </div>
    );
  }

  if (!image || !dataUrl) {
    return (
      <div 
        class={`message-image-error ${className}`}
        role="alert" 
        aria-label="Image not found"
      >
        <span>Image not found</span>
      </div>
    );
  }

  return (
    <div class={`message-image-container ${className}`}>
      <img 
        src={dataUrl}
        alt={`Attached image (${image.mime_type}, ${(image.size / 1024).toFixed(1)} KB)`}
        class="message-image"
        loading="lazy"
        role="img"
      />
    </div>
  );
}