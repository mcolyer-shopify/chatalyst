import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import type { StoredImage, ImageMetadata, PendingImage } from '../types';

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Supported image types
const SUPPORTED_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp'
];

// File magic numbers (signatures) for security validation
const IMAGE_SIGNATURES = [
  // JPEG
  { signature: [0xFF, 0xD8, 0xFF], type: 'image/jpeg', name: 'JPEG' },
  // PNG
  { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], type: 'image/png', name: 'PNG' },
  // GIF87a
  { signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], type: 'image/gif', name: 'GIF87a' },
  // GIF89a
  { signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], type: 'image/gif', name: 'GIF89a' },
  // WebP
  { signature: [0x52, 0x49, 0x46, 0x46], type: 'image/webp', name: 'WebP', offset: 0, additionalCheck: (bytes: Uint8Array) => {
    // WebP files have "WEBP" at offset 8-11 after RIFF header
    return bytes.length >= 12 && 
           bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }}
];

// Database instance (cached)
let db: Database | null = null;

async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:chatalyst.db');
  }
  return db;
}

export function isValidImageType(type: string): boolean {
  return SUPPORTED_TYPES.includes(type.toLowerCase());
}

export function isValidImageSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

/**
 * Validates file by checking magic numbers (file signatures) for security
 * This prevents malicious files from being uploaded with fake MIME types
 */
export async function validateImageMagicNumbers(file: File): Promise<{ valid: boolean; detectedType?: string; error?: string }> {
  try {
    // Read first 16 bytes to check magic numbers (enough for all image formats)
    const buffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    if (bytes.length === 0) {
      return { valid: false, error: 'File is empty' };
    }
    
    // Check each known image signature
    for (const sig of IMAGE_SIGNATURES) {
      const startOffset = sig.offset || 0;
      let matches = true;
      
      // Check if we have enough bytes
      if (bytes.length < startOffset + sig.signature.length) {
        continue;
      }
      
      // Compare signature bytes
      for (let i = 0; i < sig.signature.length; i++) {
        if (bytes[startOffset + i] !== sig.signature[i]) {
          matches = false;
          break;
        }
      }
      
      // Additional validation for formats that need it (like WebP)
      if (matches && sig.additionalCheck) {
        matches = sig.additionalCheck(bytes);
      }
      
      if (matches) {
        return { 
          valid: true, 
          detectedType: sig.type
        };
      }
    }
    
    return { 
      valid: false, 
      error: 'File signature does not match any supported image format. This may be a security risk.' 
    };
  } catch (error) {
    return { 
      valid: false, 
      error: `Failed to read file for validation: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!isValidImageType(file.type)) {
    return {
      valid: false,
      error: `Unsupported image type: ${file.type}. Supported types: ${SUPPORTED_TYPES.join(', ')}`
    };
  }

  if (!isValidImageSize(file.size)) {
    return {
      valid: false,
      error: `Image too large: ${formatFileSize(file.size)}. Maximum size: ${formatFileSize(MAX_FILE_SIZE)}`
    };
  }

  return { valid: true };
}

/**
 * Comprehensive async validation that includes magic number checking for security
 * Use this for thorough validation when security is a concern
 */
export async function validateImageFileSecure(file: File): Promise<{ valid: boolean; error?: string; detectedType?: string }> {
  // First do the basic synchronous checks
  const basicValidation = validateImageFile(file);
  if (!basicValidation.valid) {
    return basicValidation;
  }
  
  // Then do the magic number validation
  const magicValidation = await validateImageMagicNumbers(file);
  if (!magicValidation.valid) {
    return magicValidation;
  }
  
  // Check if detected type matches declared MIME type (security check)
  const declaredType = file.type.toLowerCase();
  const detectedType = magicValidation.detectedType?.toLowerCase();
  
  // Allow 'image/jpg' to match 'image/jpeg' 
  const normalizedDeclared = declaredType === 'image/jpg' ? 'image/jpeg' : declaredType;
  const normalizedDetected = detectedType === 'image/jpg' ? 'image/jpeg' : detectedType;
  
  if (normalizedDeclared !== normalizedDetected) {
    return {
      valid: false,
      error: `File type mismatch: declared as ${declaredType} but detected as ${detectedType}. This may be a security risk.`
    };
  }
  
  return { 
    valid: true, 
    detectedType: magicValidation.detectedType 
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export async function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function fileToUint8Array(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      resolve(new Uint8Array(arrayBuffer));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// Calculate SHA-256 hash using the backend function (this works)
async function calculateImageHash(data: Uint8Array): Promise<string> {
  const dataArray = Array.from(data);
  return invoke('calculate_image_hash', { data: dataArray });
}

export async function storeImage(
  file: File,
  conversationId: string
): Promise<ImageMetadata> {
  const database = await getDatabase();
  const data = await fileToUint8Array(file);
  const hash = await calculateImageHash(data);
  
  // Check if image already exists
  const existingImages = await database.select<StoredImage[]>(
    'SELECT * FROM images WHERE hash = ?',
    [hash]
  );
  
  let imageId: number;
  
  if (existingImages.length > 0) {
    // Image already exists, use existing ID
    imageId = existingImages[0].id;
  } else {
    // Store new image - use array format since SQLite converts everything to JSON anyway
    const dataArray = Array.from(data);
    
    const result = await database.execute(
      'INSERT INTO images (hash, data, mime_type, size) VALUES (?, ?, ?, ?)',
      [hash, dataArray, file.type, file.size]
    );
    imageId = result.lastInsertId ?? 0;
  }
  
  // Add reference to conversation (ignore if already exists)
  try {
    await database.execute(
      'INSERT OR IGNORE INTO image_references (image_id, conversation_id) VALUES (?, ?)',
      [imageId, conversationId]
    );
  } catch (error) {
    console.error('Failed to create image reference (may already exist):', error);
  }
  
  const result = {
    id: imageId,
    hash,
    mime_type: file.type,
    size: file.size,
    created_at: new Date().toISOString()
  };
  
  return result;
}

export async function getImage(imageId: number): Promise<StoredImage> {
  const database = await getDatabase();
  
  const images = await database.select<StoredImage[]>(
    'SELECT * FROM images WHERE id = ?',
    [imageId]
  );
  
  if (images.length === 0) {
    throw new Error(`Image not found: ${imageId}`);
  }
  
  const image = images[0];
  
  // Parse JSON array string back to array of numbers
  let processedData: number[];
  if (typeof image.data === 'string') {
    try {
      // Parse JSON array string back to actual array
      processedData = JSON.parse(image.data);
      if (!Array.isArray(processedData)) {
        throw new Error('Parsed data is not an array');
      }
    } catch (error) {
      console.error('Failed to parse JSON array:', error);
      console.error('First 100 chars of invalid JSON:', String(image.data).substring(0, 100));
      throw new Error('Failed to parse image data');
    }
  } else if (Array.isArray(image.data)) {
    processedData = image.data;
  } else {
    console.error('Unexpected data format:', typeof image.data, (image.data as any)?.constructor?.name);
    throw new Error(`Unsupported image data format: ${typeof image.data}`);
  }
  
  const processedImage = {
    ...image,
    data: processedData
  };
  
  return processedImage;
}

export async function getImageByHash(hash: string): Promise<StoredImage | null> {
  const database = await getDatabase();
  const images = await database.select<StoredImage[]>(
    'SELECT * FROM images WHERE hash = ?',
    [hash]
  );
  
  return images.length > 0 ? images[0] : null;
}

export async function getConversationImages(conversationId: string): Promise<ImageMetadata[]> {
  const database = await getDatabase();
  const images = await database.select<ImageMetadata[]>(
    `SELECT i.id, i.hash, i.mime_type, i.size, i.created_at 
     FROM images i 
     JOIN image_references ir ON i.id = ir.image_id 
     WHERE ir.conversation_id = ?
     ORDER BY ir.created_at`,
    [conversationId]
  );
  
  return images;
}

export async function deleteConversationImages(conversationId: string): Promise<number> {
  const database = await getDatabase();
  
  // Get images that will become orphaned after deleting this conversation's references
  const orphanedImages = await database.select<{ id: number }[]>(
    `SELECT i.id 
     FROM images i 
     JOIN image_references ir ON i.id = ir.image_id 
     WHERE ir.conversation_id = ?
     AND NOT EXISTS (
       SELECT 1 FROM image_references ir2 
       WHERE ir2.image_id = i.id 
       AND ir2.conversation_id != ?
     )`,
    [conversationId, conversationId]
  );
  
  // Delete conversation references
  await database.execute(
    'DELETE FROM image_references WHERE conversation_id = ?',
    [conversationId]
  );
  
  // Delete orphaned images
  let deletedCount = 0;
  for (const image of orphanedImages) {
    await database.execute('DELETE FROM images WHERE id = ?', [image.id]);
    deletedCount++;
  }
  
  return deletedCount;
}

export async function cleanupOrphanedImages(): Promise<number> {
  const database = await getDatabase();
  
  const result = await database.execute(
    `DELETE FROM images 
     WHERE id NOT IN (
       SELECT DISTINCT image_id FROM image_references
     )`
  );
  
  return result.rowsAffected;
}

export async function getImageStats(): Promise<[number, number]> {
  const database = await getDatabase();
  
  const imageCount = await database.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM images'
  );
  
  const totalSize = await database.select<{ total: number }[]>(
    'SELECT COALESCE(SUM(size), 0) as total FROM images'
  );
  
  return [imageCount[0]?.count || 0, totalSize[0]?.total || 0];
}

export function createDataURL(data: number[], mimeType: string): string {
  if (!Array.isArray(data)) {
    console.error('Data is not an array:', typeof data);
    throw new Error('Image data must be an array of numbers');
  }
  
  const uint8Array = new Uint8Array(data);
  
  try {
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
    const dataUrl = `data:${mimeType};base64,${base64}`;
    return dataUrl;
  } catch (error) {
    console.error('Failed to create base64:', error);
    throw error;
  }
}

export function createPendingImage(file: File): Promise<PendingImage> {
  return createImagePreview(file).then(preview => ({
    id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    file,
    preview
  }));
}

export function getImageFromClipboard(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
}

export function handleFileInput(event: Event): File[] {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  if (!files) return [];
  
  return Array.from(files).filter(file => isValidImageType(file.type));
}