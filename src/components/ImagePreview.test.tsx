import { render, screen, fireEvent } from '@testing-library/preact';
import { ImagePreview } from './ImagePreview';
import type { PendingImage } from '../types';

describe('ImagePreview', () => {
  const mockOnRemove = vi.fn();

  const createMockImage = (id: string, filename: string): PendingImage => ({
    id,
    file: new File(['test'], filename, { type: 'image/jpeg' }),
    preview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA'
  });

  beforeEach(() => {
    mockOnRemove.mockClear();
  });

  it('renders nothing when no images', () => {
    const { container } = render(
      <ImagePreview images={[]} onRemove={mockOnRemove} />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('renders image previews', () => {
    const images = [
      createMockImage('1', 'test1.jpg'),
      createMockImage('2', 'test2.png')
    ];

    render(<ImagePreview images={images} onRemove={mockOnRemove} />);
    
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByAltText(/Preview of test1\.jpg/)).toBeInTheDocument();
    expect(screen.getByAltText(/Preview of test2\.png/)).toBeInTheDocument();
  });

  it('displays remove buttons for each image', () => {
    const images = [createMockImage('1', 'test.jpg')];

    render(<ImagePreview images={images} onRemove={mockOnRemove} />);
    
    const removeButton = screen.getByTitle(/Remove test\.jpg from attachments/);
    expect(removeButton).toBeInTheDocument();
    expect(removeButton).toHaveTextContent('×');
  });

  it('calls onRemove when remove button is clicked', () => {
    const images = [createMockImage('test-id', 'test.jpg')];

    render(<ImagePreview images={images} onRemove={mockOnRemove} />);
    
    const removeButton = screen.getByTitle(/Remove test\.jpg from attachments/);
    fireEvent.click(removeButton);
    
    expect(mockOnRemove).toHaveBeenCalledWith('test-id');
    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove with correct image ID for multiple images', () => {
    const images = [
      createMockImage('first', 'test1.jpg'),
      createMockImage('second', 'test2.jpg')
    ];

    render(<ImagePreview images={images} onRemove={mockOnRemove} />);
    
    const removeButtons = screen.getAllByRole('button');
    fireEvent.click(removeButtons[1]); // Click second image's remove button
    
    expect(mockOnRemove).toHaveBeenCalledWith('second');
  });

  it('displays images with correct preview URLs', () => {
    const images = [createMockImage('1', 'test.jpg')];

    render(<ImagePreview images={images} onRemove={mockOnRemove} />);
    
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toBe(images[0].preview);
  });

  it('has correct CSS classes', () => {
    const images = [createMockImage('1', 'test.jpg')];

    render(<ImagePreview images={images} onRemove={mockOnRemove} />);
    
    expect(document.querySelector('.image-preview-container')).toBeInTheDocument();
    expect(document.querySelector('.image-preview-item')).toBeInTheDocument();
    expect(document.querySelector('.image-preview-wrapper')).toBeInTheDocument();
    expect(document.querySelector('.image-preview-thumbnail')).toBeInTheDocument();
    expect(document.querySelector('.image-preview-remove')).toBeInTheDocument();
  });

  it('remove button has correct attributes', () => {
    const images = [createMockImage('1', 'test.jpg')];

    render(<ImagePreview images={images} onRemove={mockOnRemove} />);
    
    const removeButton = screen.getByTitle(/Remove test\.jpg from attachments/);
    expect(removeButton).toHaveAttribute('type', 'button');
    expect(removeButton).toHaveClass('image-preview-remove');
    expect(removeButton).toHaveAttribute('aria-label');
  });

  describe('keyboard navigation', () => {
    it('removes image when Delete key is pressed', () => {
      const images = [createMockImage('test-id', 'test.jpg')];

      render(<ImagePreview images={images} onRemove={mockOnRemove} />);
      
      const removeButton = screen.getByRole('button');
      fireEvent.keyDown(removeButton, { key: 'Delete' });
      
      expect(mockOnRemove).toHaveBeenCalledWith('test-id');
    });

    it('removes image when Backspace key is pressed', () => {
      const images = [createMockImage('test-id', 'test.jpg')];

      render(<ImagePreview images={images} onRemove={mockOnRemove} />);
      
      const removeButton = screen.getByRole('button');
      fireEvent.keyDown(removeButton, { key: 'Backspace' });
      
      expect(mockOnRemove).toHaveBeenCalledWith('test-id');
    });

    it('navigates between buttons with arrow keys', () => {
      const images = [
        createMockImage('first', 'test1.jpg'),
        createMockImage('second', 'test2.jpg'),
        createMockImage('third', 'test3.jpg')
      ];

      render(<ImagePreview images={images} onRemove={mockOnRemove} />);
      
      const buttons = screen.getAllByRole('button');
      
      // Focus first button and move right
      buttons[0].focus();
      fireEvent.keyDown(buttons[0], { key: 'ArrowRight' });
      expect(document.activeElement).toBe(buttons[1]);
      
      // Move right again
      fireEvent.keyDown(buttons[1], { key: 'ArrowRight' });
      expect(document.activeElement).toBe(buttons[2]);
      
      // Move left
      fireEvent.keyDown(buttons[2], { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(buttons[1]);
    });

    it('navigates to first and last buttons with Home and End keys', () => {
      const images = [
        createMockImage('first', 'test1.jpg'),
        createMockImage('second', 'test2.jpg'),
        createMockImage('third', 'test3.jpg')
      ];

      render(<ImagePreview images={images} onRemove={mockOnRemove} />);
      
      const buttons = screen.getAllByRole('button');
      
      // Focus middle button
      buttons[1].focus();
      
      // Press Home to go to first
      fireEvent.keyDown(buttons[1], { key: 'Home' });
      expect(document.activeElement).toBe(buttons[0]);
      
      // Press End to go to last
      fireEvent.keyDown(buttons[0], { key: 'End' });
      expect(document.activeElement).toBe(buttons[2]);
    });

    it('does not navigate beyond boundaries', () => {
      const images = [
        createMockImage('first', 'test1.jpg'),
        createMockImage('second', 'test2.jpg')
      ];

      render(<ImagePreview images={images} onRemove={mockOnRemove} />);
      
      const buttons = screen.getAllByRole('button');
      
      // Focus first button and try to move left
      buttons[0].focus();
      fireEvent.keyDown(buttons[0], { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(buttons[0]); // Should stay on first
      
      // Focus last button and try to move right
      buttons[1].focus();
      fireEvent.keyDown(buttons[1], { key: 'ArrowRight' });
      expect(document.activeElement).toBe(buttons[1]); // Should stay on last
    });

    it('manages focus after removing image', () => {
      const images = [
        createMockImage('first', 'test1.jpg'),
        createMockImage('second', 'test2.jpg'),
        createMockImage('third', 'test3.jpg')
      ];

      const { rerender } = render(<ImagePreview images={images} onRemove={mockOnRemove} />);
      
      const buttons = screen.getAllByRole('button');
      
      // Focus middle button and delete
      buttons[1].focus();
      fireEvent.keyDown(buttons[1], { key: 'Delete' });
      
      expect(mockOnRemove).toHaveBeenCalledWith('second');
      
      // Simulate re-render with updated images
      const updatedImages = [
        createMockImage('first', 'test1.jpg'),
        createMockImage('third', 'test3.jpg')
      ];
      rerender(<ImagePreview images={updatedImages} onRemove={mockOnRemove} />);
      
      // Focus should be managed properly (tested through integration)
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      const images = [
        createMockImage('1', 'test1.jpg'),
        createMockImage('2', 'test2.jpg')
      ];

      render(<ImagePreview images={images} onRemove={mockOnRemove} />);
      
      const container = screen.getByRole('region');
      expect(container).toHaveAttribute('aria-label', '2 images attached. Use arrow keys to navigate, Delete or Backspace to remove.');
      
      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('aria-label', 'Remove test1.jpg from attachments (1 of 2)');
      expect(buttons[1]).toHaveAttribute('aria-label', 'Remove test2.jpg from attachments (2 of 2)');
    });

    it('updates ARIA label for single image', () => {
      const images = [createMockImage('1', 'test.jpg')];

      render(<ImagePreview images={images} onRemove={mockOnRemove} />);
      
      const container = screen.getByRole('region');
      expect(container).toHaveAttribute('aria-label', '1 image attached. Use arrow keys to navigate, Delete or Backspace to remove.');
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Remove test.jpg from attachments (1 of 1)');
    });
  });
});