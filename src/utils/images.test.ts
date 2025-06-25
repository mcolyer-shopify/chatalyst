import { describe, it, expect } from 'vitest';
import { 
  isValidImageType,
  isValidImageSize,
  validateImageFile,
  formatFileSize,
  createDataURL,
  getImageFromClipboard,
  handleFileInput
} from './images';

describe('Image Utils', () => {
  describe('isValidImageType', () => {
    it('accepts valid image types', () => {
      expect(isValidImageType('image/jpeg')).toBe(true);
      expect(isValidImageType('image/jpg')).toBe(true);
      expect(isValidImageType('image/png')).toBe(true);
      expect(isValidImageType('image/gif')).toBe(true);
      expect(isValidImageType('image/webp')).toBe(true);
    });

    it('handles case insensitive types', () => {
      expect(isValidImageType('IMAGE/JPEG')).toBe(true);
      expect(isValidImageType('Image/PNG')).toBe(true);
    });

    it('rejects invalid image types', () => {
      expect(isValidImageType('image/bmp')).toBe(false);
      expect(isValidImageType('image/tiff')).toBe(false);
      expect(isValidImageType('application/pdf')).toBe(false);
      expect(isValidImageType('text/plain')).toBe(false);
      expect(isValidImageType('')).toBe(false);
    });
  });

  describe('isValidImageSize', () => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    it('accepts valid image sizes', () => {
      expect(isValidImageSize(0)).toBe(true);
      expect(isValidImageSize(1024)).toBe(true);
      expect(isValidImageSize(MAX_SIZE)).toBe(true);
    });

    it('rejects oversized images', () => {
      expect(isValidImageSize(MAX_SIZE + 1)).toBe(false);
      expect(isValidImageSize(20 * 1024 * 1024)).toBe(false);
    });
  });

  describe('validateImageFile', () => {
    it('validates correct files', () => {
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = validateImageFile(validFile);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects invalid file types', () => {
      const invalidFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const result = validateImageFile(invalidFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported image type');
    });

    it('rejects oversized files', () => {
      // Create a file that's too large (11MB)
      const largeFile = new File(
        [new ArrayBuffer(11 * 1024 * 1024)], 
        'large.jpg', 
        { type: 'image/jpeg' }
      );
      const result = validateImageFile(largeFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Image too large');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(512)).toBe('512 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('createDataURL', () => {
    it('creates valid data URLs', () => {
      const data = [255, 216, 255, 224]; // JPEG header bytes
      const mimeType = 'image/jpeg';
      
      const result = createDataURL(data, mimeType);
      
      expect(result).toMatch(/^data:image\/jpeg;base64,/);
      expect(result.length).toBeGreaterThan(30);
    });

    it('handles empty data', () => {
      const data: number[] = [];
      const mimeType = 'image/png';
      
      const result = createDataURL(data, mimeType);
      
      expect(result).toBe('data:image/png;base64,');
    });

    it('throws error for invalid data', () => {
      expect(() => {
        createDataURL('invalid' as any, 'image/jpeg');
      }).toThrow('Image data must be an array of numbers');
    });
  });

  describe('getImageFromClipboard', () => {
    it('extracts image from clipboard', () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const mockItem = {
        type: 'image/jpeg',
        getAsFile: () => mockFile
      };
      
      const mockEvent = {
        clipboardData: {
          items: [mockItem]
        }
      } as ClipboardEvent;

      const result = getImageFromClipboard(mockEvent);
      expect(result).toBe(mockFile);
    });

    it('returns null for non-image clipboard', () => {
      const mockItem = {
        type: 'text/plain',
        getAsFile: () => null
      };
      
      const mockEvent = {
        clipboardData: {
          items: [mockItem]
        }
      } as ClipboardEvent;

      const result = getImageFromClipboard(mockEvent);
      expect(result).toBeNull();
    });

    it('returns null for empty clipboard', () => {
      const mockEvent = {
        clipboardData: null
      } as ClipboardEvent;

      const result = getImageFromClipboard(mockEvent);
      expect(result).toBeNull();
    });
  });

  describe('handleFileInput', () => {
    it('filters valid image files', () => {
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const invalidFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      
      const mockInput = {
        target: {
          files: [validFile, invalidFile]
        }
      } as Event;

      const result = handleFileInput(mockInput);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(validFile);
    });

    it('returns empty array for no files', () => {
      const mockInput = {
        target: {
          files: null
        }
      } as Event;

      const result = handleFileInput(mockInput);
      expect(result).toEqual([]);
    });
  });
});