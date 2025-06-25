import { render, screen, waitFor } from '@testing-library/preact';
import { MessageImage } from './MessageImage';
import * as imageUtils from '../utils/images';
import type { StoredImage } from '../types';

// Mock the image utils module
vi.mock('../utils/images', () => ({
  getImage: vi.fn(),
  createDataURL: vi.fn()
}));

describe('MessageImage', () => {
  const mockGetImage = vi.mocked(imageUtils.getImage);
  const mockCreateDataURL = vi.mocked(imageUtils.createDataURL);

  const mockStoredImage: StoredImage = {
    id: 1,
    hash: 'test-hash',
    data: [255, 216, 255, 224], // JPEG header
    mime_type: 'image/jpeg',
    size: 1024,
    created_at: '2023-01-01T00:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockGetImage.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<MessageImage imageId={1} />);
    
    expect(screen.getByText('Loading image...')).toBeInTheDocument();
    expect(document.querySelector('.message-image-spinner')).toBeInTheDocument();
  });

  it('displays image after successful load', async () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD';
    
    mockGetImage.mockResolvedValue(mockStoredImage);
    mockCreateDataURL.mockReturnValue(dataUrl);
    
    render(<MessageImage imageId={1} />);
    
    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
    
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toBe(dataUrl);
    expect(img.alt).toBe('Attached image (image/jpeg, 1.0 KB)');
    expect(img).toHaveClass('message-image');
  });

  it('shows error state when image fails to load', async () => {
    mockGetImage.mockRejectedValue(new Error('Image not found'));
    
    render(<MessageImage imageId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load image/)).toBeInTheDocument();
    });
    
    expect(document.querySelector('.message-image-error')).toBeInTheDocument();
  });

  it('shows specific error message', async () => {
    mockGetImage.mockRejectedValue(new Error('Network error'));
    
    render(<MessageImage imageId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load image: Network error')).toBeInTheDocument();
    });
  });

  it('shows generic error for non-Error objects', async () => {
    mockGetImage.mockRejectedValue('String error');
    
    render(<MessageImage imageId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load image: Failed to load image')).toBeInTheDocument();
    });
  });

  it('shows error when image data is missing', async () => {
    mockGetImage.mockResolvedValue(mockStoredImage);
    mockCreateDataURL.mockReturnValue('');
    
    render(<MessageImage imageId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Image not found')).toBeInTheDocument();
    });
  });

  it('calls getImage with correct imageId', async () => {
    mockGetImage.mockResolvedValue(mockStoredImage);
    mockCreateDataURL.mockReturnValue('data:image/jpeg;base64,test');
    
    render(<MessageImage imageId={42} />);
    
    await waitFor(() => {
      expect(mockGetImage).toHaveBeenCalledWith(42);
    });
  });

  it('calls createDataURL with correct parameters', async () => {
    mockGetImage.mockResolvedValue(mockStoredImage);
    mockCreateDataURL.mockReturnValue('data:image/jpeg;base64,test');
    
    render(<MessageImage imageId={1} />);
    
    await waitFor(() => {
      expect(mockCreateDataURL).toHaveBeenCalledWith(
        mockStoredImage.data,
        mockStoredImage.mime_type
      );
    });
  });

  it('applies custom className', async () => {
    mockGetImage.mockResolvedValue(mockStoredImage);
    mockCreateDataURL.mockReturnValue('data:image/jpeg;base64,test');
    
    render(<MessageImage imageId={1} className="custom-class" />);
    
    await waitFor(() => {
      const container = document.querySelector('.message-image-container');
      expect(container).toHaveClass('custom-class');
    });
  });

  it('has correct container structure', async () => {
    mockGetImage.mockResolvedValue(mockStoredImage);
    mockCreateDataURL.mockReturnValue('data:image/jpeg;base64,test');
    
    render(<MessageImage imageId={1} />);
    
    await waitFor(() => {
      expect(document.querySelector('.message-image-container')).toBeInTheDocument();
      expect(document.querySelector('.message-image')).toBeInTheDocument();
    });
  });

  it('cleans up on unmount', async () => {
    mockGetImage.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve(mockStoredImage), 100);
    }));
    
    const { unmount } = render(<MessageImage imageId={1} />);
    
    unmount();
    
    // Wait a bit to ensure the promise doesn't resolve after unmount
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Should not crash or show anything after unmount
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('sets loading attribute on image', async () => {
    mockGetImage.mockResolvedValue(mockStoredImage);
    mockCreateDataURL.mockReturnValue('data:image/jpeg;base64,test');
    
    render(<MessageImage imageId={1} />);
    
    await waitFor(() => {
      const img = screen.getByRole('img') as HTMLImageElement;
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });
});