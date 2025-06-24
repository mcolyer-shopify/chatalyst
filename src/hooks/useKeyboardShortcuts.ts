import { useEffect } from 'preact/hooks';

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  handler: () => void;
  globalOnly?: boolean; // Only work when no input is focused
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  useEffect(() => {
    const isInputFocused = () => {
      const activeElement = document.activeElement;
      return activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlOrMeta = shortcut.ctrl || shortcut.meta;
        const isCtrlPressed = event.ctrlKey || event.metaKey;
        
        // Skip global-only shortcuts if an input is focused
        if (shortcut.globalOnly && isInputFocused()) {
          continue;
        }
        
        if (
          event.key === shortcut.key &&
          (!ctrlOrMeta || isCtrlPressed)
        ) {
          event.preventDefault();
          shortcut.handler();
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}