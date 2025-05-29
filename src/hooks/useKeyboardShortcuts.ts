import { useEffect } from 'preact/hooks';

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  handler: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlOrMeta = shortcut.ctrl || shortcut.meta;
        const isCtrlPressed = event.ctrlKey || event.metaKey;
        
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