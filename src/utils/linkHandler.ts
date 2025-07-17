import { openUrl } from '@tauri-apps/plugin-opener';

/**
 * Validates if a URL is safe to open externally
 * Only allows http and https protocols
 */
function isValidExternalUrl(url: string): boolean {
  try {
    const urlObject = new URL(url);
    return urlObject.protocol === 'http:' || urlObject.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Opens a URL in the system's default browser using Tauri opener plugin
 * @param url - The URL to open
 * @returns Promise that resolves when the URL is opened successfully
 */
export async function openExternalLink(url: string): Promise<void> {
  if (!isValidExternalUrl(url)) {
    console.warn('Invalid or unsafe URL provided:', url);
    return;
  }

  try {
    await openUrl(url);
  } catch (error) {
    console.error('Failed to open external link:', error);
    // Fallback: try to open in current window (though this shouldn't happen in Tauri)
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Handles click events on elements that might contain links
 * Should be used with event delegation on containers with dangerouslySetInnerHTML
 */
export function handleLinkClick(event: Event): void {
  const target = event.target as HTMLElement;
  
  // Check if the clicked element is an anchor tag
  if (target.tagName === 'A') {
    const anchor = target as HTMLElement & { href?: string };
    const href = anchor.href;
    
    if (href) {
      // Prevent default browser behavior
      event.preventDefault();
      
      // Open the link externally
      openExternalLink(href);
    }
  }
}