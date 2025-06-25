import { describe, it, expect } from 'vitest';
import { 
  isValidImageType,
  isValidImageSize,
  validateImageFile,
  validateImageMagicNumbers,
  validateImageFileSecure,
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

  describe('validateImageMagicNumbers', () => {
    // Helper function to create a mock file with proper slice and arrayBuffer methods
    function createMockFile(bytes: Uint8Array, name: string, type: string): File {
      const file = new File([bytes], name, { type });
      
      // Mock the slice method to return an object with arrayBuffer method
      (file as any).slice = function(start: number, end: number) {
        const slicedBytes = bytes.slice(start, end);
        return {
          arrayBuffer: async () => slicedBytes.buffer.slice(slicedBytes.byteOffset, slicedBytes.byteOffset + slicedBytes.byteLength)
        };
      };
      
      return file;
    }

    it('validates JPEG files correctly', async () => {
      // JPEG magic numbers: FF D8 FF
      const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const jpegFile = createMockFile(jpegBytes, 'test.jpg', 'image/jpeg');
      
      const result = await validateImageMagicNumbers(jpegFile);
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('image/jpeg');
    });

    it('validates PNG files correctly', async () => {
      // PNG magic numbers: 89 50 4E 47 0D 0A 1A 0A
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
      const pngFile = createMockFile(pngBytes, 'test.png', 'image/png');
      
      const result = await validateImageMagicNumbers(pngFile);
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('image/png');
    });

    it('validates GIF87a files correctly', async () => {
      // GIF87a magic numbers: 47 49 46 38 37 61
      const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00]);
      const gifFile = createMockFile(gifBytes, 'test.gif', 'image/gif');
      
      const result = await validateImageMagicNumbers(gifFile);
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('image/gif');
    });

    it('validates GIF89a files correctly', async () => {
      // GIF89a magic numbers: 47 49 46 38 39 61
      const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);
      const gifFile = createMockFile(gifBytes, 'test.gif', 'image/gif');
      
      const result = await validateImageMagicNumbers(gifFile);
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('image/gif');
    });

    it('validates WebP files correctly', async () => {
      // WebP magic numbers: RIFF + WEBP
      const webpBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // File size (not important for test)
        0x57, 0x45, 0x42, 0x50  // WEBP
      ]);
      const webpFile = createMockFile(webpBytes, 'test.webp', 'image/webp');
      
      const result = await validateImageMagicNumbers(webpFile);
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('image/webp');
    });

    it('rejects files with invalid magic numbers', async () => {
      // PDF magic numbers (not an image)
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
      const fakeImageFile = createMockFile(pdfBytes, 'fake.jpg', 'image/jpeg');
      
      const result = await validateImageMagicNumbers(fakeImageFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File signature does not match any supported image format');
    });

    it('rejects empty files', async () => {
      const emptyBytes = new Uint8Array([]);
      const emptyFile = createMockFile(emptyBytes, 'empty.jpg', 'image/jpeg');
      
      const result = await validateImageMagicNumbers(emptyFile);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File is empty');
    });

    it('rejects files with insufficient bytes', async () => {
      // Only 2 bytes, not enough for any image format
      const shortBytes = new Uint8Array([0xFF, 0xD8]);
      const shortFile = createMockFile(shortBytes, 'short.jpg', 'image/jpeg');
      
      const result = await validateImageMagicNumbers(shortFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File signature does not match any supported image format');
    });
  });

  describe('validateImageFileSecure', () => {
    // Use the same createMockFile helper function
    function createMockFile(bytes: Uint8Array, name: string, type: string): File {
      const file = new File([bytes], name, { type });
      
      // Mock the slice method to return an object with arrayBuffer method
      (file as any).slice = function(start: number, end: number) {
        const slicedBytes = bytes.slice(start, end);
        return {
          arrayBuffer: async () => slicedBytes.buffer.slice(slicedBytes.byteOffset, slicedBytes.byteOffset + slicedBytes.byteLength)
        };
      };
      
      return file;
    }

    it('validates legitimate image files', async () => {
      const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const jpegFile = createMockFile(jpegBytes, 'test.jpg', 'image/jpeg');
      
      const result = await validateImageFileSecure(jpegFile);
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('image/jpeg');
    });

    it('allows image/jpg to match image/jpeg', async () => {
      const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const jpegFile = createMockFile(jpegBytes, 'test.jpg', 'image/jpg');
      
      const result = await validateImageFileSecure(jpegFile);
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('image/jpeg');
    });

    it('rejects files with mismatched MIME types', async () => {
      // PNG bytes but declared as JPEG
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const mismatchedFile = createMockFile(pngBytes, 'fake.jpg', 'image/jpeg');
      
      const result = await validateImageFileSecure(mismatchedFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type mismatch');
      expect(result.error).toContain('declared as image/jpeg but detected as image/png');
    });

    it('rejects oversized files', async () => {
      // Create a file that's too large (11MB)
      const largeSize = 11 * 1024 * 1024;
      const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      
      // Mock the file size property
      const largeFile = createMockFile(jpegBytes, 'large.jpg', 'image/jpeg');
      Object.defineProperty(largeFile, 'size', { value: largeSize });
      
      const result = await validateImageFileSecure(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Image too large');
    });

    it('rejects unsupported file types', async () => {
      const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const unsupportedFile = createMockFile(jpegBytes, 'test.bmp', 'image/bmp');
      
      const result = await validateImageFileSecure(unsupportedFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported image type: image/bmp');
    });
  });
});