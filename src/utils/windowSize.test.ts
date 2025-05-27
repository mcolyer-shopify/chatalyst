import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveWindowGeometry,
  loadWindowGeometry,
  getWindowGeometry,
  setWindowGeometry,
  restoreWindowGeometry,
  saveCurrentWindowGeometry,
  setupWindowGeometryPersistence
} from './windowSize';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('Window Geometry Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('saveWindowGeometry', () => {
    it('saves window geometry to localStorage', () => {
      const geometry = { width: 1024, height: 768, x: 100, y: 50 };
      saveWindowGeometry(geometry);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chatalyst_window_geometry',
        JSON.stringify(geometry)
      );
    });

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const geometry = { width: 1024, height: 768, x: 100, y: 50 };
      saveWindowGeometry(geometry);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save window geometry to localStorage:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('loadWindowGeometry', () => {
    it('returns null when no saved geometry exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = loadWindowGeometry();

      expect(result).toBeNull();
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('chatalyst_window_geometry');
    });

    it('returns parsed window geometry from localStorage', () => {
      const savedGeometry = { width: 1200, height: 900, x: 200, y: 100 };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedGeometry));

      const result = loadWindowGeometry();

      expect(result).toEqual(savedGeometry);
    });

    it('handles invalid JSON gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const result = loadWindowGeometry();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load window geometry from localStorage:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = loadWindowGeometry();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load window geometry from localStorage:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Non-Tauri environment (test environment)', () => {
    it('getWindowGeometry returns default geometry', async () => {
      const result = await getWindowGeometry();
      expect(result).toEqual({ width: 800, height: 600, x: 100, y: 100 });
    });

    it('setWindowGeometry is a no-op', async () => {
      const geometry = { width: 1024, height: 768, x: 100, y: 50 };
      await expect(setWindowGeometry(geometry)).resolves.toBeUndefined();
    });

    it('restoreWindowGeometry is a no-op', async () => {
      await expect(restoreWindowGeometry()).resolves.toBeUndefined();
    });

    it('saveCurrentWindowGeometry handles non-Tauri environment', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await saveCurrentWindowGeometry();

      // Should save the default geometry from getWindowGeometry
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chatalyst_window_geometry',
        JSON.stringify({ width: 800, height: 600, x: 100, y: 100 })
      );

      consoleSpy.mockRestore();
    });

    it('setupWindowGeometryPersistence returns no-op function', async () => {
      const unlistenFn = await setupWindowGeometryPersistence();
      
      expect(typeof unlistenFn).toBe('function');
      // Should not throw when called
      expect(() => unlistenFn()).not.toThrow();
    });
  });

  describe('Integration', () => {
    it('can save and load window geometry', () => {
      let storage: { [key: string]: string } = {};

      mockLocalStorage.setItem.mockImplementation((key, value) => {
        storage[key] = value;
      });

      mockLocalStorage.getItem.mockImplementation((key) => storage[key] || null);

      const geometry = { width: 1400, height: 1000, x: 200, y: 150 };

      // Save window geometry
      saveWindowGeometry(geometry);

      // Load window geometry
      const loaded = loadWindowGeometry();

      expect(loaded).toEqual(geometry);
    });
  });
});