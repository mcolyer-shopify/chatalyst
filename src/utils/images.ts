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

// Database instance (cached)
let db: Database | null = null;

async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:images.db');
  }
  return db;
}

export function isValidImageType(type: string): boolean {
  return SUPPORTED_TYPES.includes(type.toLowerCase());
}

export function isValidImageSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
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
  console.log('🔄 [storeImage] Starting image upload:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    conversationId
  });

  const database = await getDatabase();
  console.log('✅ [storeImage] Database connection established');

  const data = await fileToUint8Array(file);
  console.log('✅ [storeImage] File converted to Uint8Array, size:', data.length);

  const hash = await calculateImageHash(data);
  console.log('✅ [storeImage] Hash calculated:', hash);
  
  // Check if image already exists
  const existingImages = await database.select<StoredImage[]>(
    'SELECT * FROM images WHERE hash = ?',
    [hash]
  );
  console.log('✅ [storeImage] Checked for existing images, found:', existingImages.length);
  
  let imageId: number;
  
  if (existingImages.length > 0) {
    // Image already exists, use existing ID
    imageId = existingImages[0].id;
    console.log('♻️ [storeImage] Using existing image ID:', imageId);
  } else {
    // Store new image - use array format since SQLite converts everything to JSON anyway
    console.log('💾 [storeImage] Storing new image in database...');
    console.log('🔍 [storeImage] Data type being stored:', typeof data, data.constructor.name);
    
    const dataArray = Array.from(data);
    console.log('🔍 [storeImage] Converting to array for storage, length:', dataArray.length);
    
    const result = await database.execute(
      'INSERT INTO images (hash, data, mime_type, size) VALUES (?, ?, ?, ?)',
      [hash, dataArray, file.type, file.size]
    );
    imageId = result.lastInsertId;
    console.log('✅ [storeImage] New image stored with ID:', imageId);
  }
  
  // Add reference to conversation (ignore if already exists)
  try {
    console.log('🔗 [storeImage] Creating image reference...');
    await database.execute(
      'INSERT OR IGNORE INTO image_references (image_id, conversation_id) VALUES (?, ?)',
      [imageId, conversationId]
    );
    console.log('✅ [storeImage] Image reference created');
  } catch (error) {
    console.warn('⚠️ [storeImage] Failed to create image reference (may already exist):', error);
  }
  
  const result = {
    id: imageId,
    hash,
    mime_type: file.type,
    size: file.size,
    created_at: new Date().toISOString()
  };
  
  console.log('🎉 [storeImage] Image upload complete:', result);
  return result;
}

export async function getImage(imageId: number): Promise<StoredImage> {
  console.log('🔍 [getImage] Fetching image:', imageId);
  
  const database = await getDatabase();
  console.log('✅ [getImage] Database connection established');
  
  const images = await database.select<StoredImage[]>(
    'SELECT * FROM images WHERE id = ?',
    [imageId]
  );
  console.log('✅ [getImage] Database query completed, found images:', images.length);
  
  if (images.length === 0) {
    console.error('❌ [getImage] Image not found:', imageId);
    throw new Error(`Image not found: ${imageId}`);
  }
  
  const image = images[0];
  console.log('✅ [getImage] Raw image from database:', {
    id: image.id,
    hash: image.hash,
    mimeType: image.mime_type,
    size: image.size,
    dataType: typeof image.data,
    dataConstructor: image.data?.constructor?.name,
    dataLength: Array.isArray(image.data) ? image.data.length : (image.data?.length || 'no length')
  });
  
  // Parse JSON array string back to array of numbers
  let processedData: number[];
  if (typeof image.data === 'string') {
    console.log('🔍 [getImage] Data string sample:', image.data.substring(0, 50) + '...');
    console.log('🔍 [getImage] Data string length:', image.data.length);
    
    try {
      // Parse JSON array string back to actual array
      processedData = JSON.parse(image.data);
      if (!Array.isArray(processedData)) {
        throw new Error('Parsed data is not an array');
      }
      console.log('✅ [getImage] Parsed JSON array, length:', processedData.length);
    } catch (error) {
      console.error('❌ [getImage] Failed to parse JSON array:', error);
      console.error('❌ [getImage] First 100 chars of invalid JSON:', image.data.substring(0, 100));
      throw new Error('Failed to parse image data');
    }
  } else if (Array.isArray(image.data)) {
    processedData = image.data;
    console.log('✅ [getImage] Data is already an array, length:', processedData.length);
  } else {
    console.error('❌ [getImage] Unexpected data format:', typeof image.data, image.data?.constructor?.name);
    throw new Error(`Unsupported image data format: ${typeof image.data}`);
  }
  
  const processedImage = {
    ...image,
    data: processedData
  };
  
  console.log('✅ [getImage] Image processed successfully, data length:', processedData.length);
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
  console.log('🔄 [createDataURL] Creating data URL:', {
    mimeType,
    dataType: typeof data,
    dataLength: Array.isArray(data) ? data.length : 'not array',
    firstFewBytes: Array.isArray(data) ? data.slice(0, 10) : 'not array'
  });
  
  if (!Array.isArray(data)) {
    console.error('❌ [createDataURL] Data is not an array:', typeof data);
    throw new Error('Image data must be an array of numbers');
  }
  
  const uint8Array = new Uint8Array(data);
  console.log('✅ [createDataURL] Uint8Array created, length:', uint8Array.length);
  
  try {
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
    const dataUrl = `data:${mimeType};base64,${base64}`;
    console.log('✅ [createDataURL] Data URL created successfully, length:', dataUrl.length);
    console.log('📄 [createDataURL] Data URL preview:', dataUrl.substring(0, 100) + '...');
    return dataUrl;
  } catch (error) {
    console.error('❌ [createDataURL] Failed to create base64:', error);
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