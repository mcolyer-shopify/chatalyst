import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openExternalLink, handleLinkClick } from './linkHandler';
import { openUrl } from '@tauri-apps/plugin-opener';

// Mock the opener plugin
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined)
}));

describe('linkHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('openExternalLink', () => {
    it('opens valid http URLs', async () => {
      await openExternalLink('http://example.com');
      expect(openUrl).toHaveBeenCalledWith('http://example.com');
    });

    it('opens valid https URLs', async () => {
      await openExternalLink('https://example.com');
      expect(openUrl).toHaveBeenCalledWith('https://example.com');
    });

    it('rejects javascript URLs', async () => {
      await openExternalLink('javascript:alert("xss")');
      expect(openUrl).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('Invalid or unsafe URL provided:', 'javascript:alert("xss")');
    });

    it('rejects invalid URLs', async () => {
      await openExternalLink('not-a-url');
      expect(openUrl).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('Invalid or unsafe URL provided:', 'not-a-url');
    });

    it('handles Tauri errors gracefully', async () => {
      const mockError = new Error('Tauri error');
      (openUrl as any).mockRejectedValueOnce(mockError);
      
      // Mock window.open
      const mockWindowOpen = vi.fn();
      global.window = { open: mockWindowOpen } as any;

      await openExternalLink('https://example.com');
      
      expect(openUrl).toHaveBeenCalledWith('https://example.com');
      expect(console.error).toHaveBeenCalledWith('Failed to open external link:', mockError);
      expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    });
  });

  describe('handleLinkClick', () => {
    it('handles anchor tag clicks', () => {
      const mockAnchor = document.createElement('a');
      mockAnchor.href = 'https://example.com';
      
      const mockEvent = {
        target: mockAnchor,
        preventDefault: vi.fn()
      } as any;

      handleLinkClick(mockEvent);
      
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(openUrl).toHaveBeenCalledWith('https://example.com/');
    });

    it('ignores non-anchor clicks', () => {
      const mockDiv = document.createElement('div');
      
      const mockEvent = {
        target: mockDiv,
        preventDefault: vi.fn()
      } as any;

      handleLinkClick(mockEvent);
      
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(openUrl).not.toHaveBeenCalled();
    });

    it('ignores anchor tags without href', () => {
      const mockAnchor = document.createElement('a');
      // No href set
      
      const mockEvent = {
        target: mockAnchor,
        preventDefault: vi.fn()
      } as any;

      handleLinkClick(mockEvent);
      
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(openUrl).not.toHaveBeenCalled();
    });
  });
});