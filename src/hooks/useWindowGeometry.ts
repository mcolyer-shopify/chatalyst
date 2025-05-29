import { useEffect } from 'preact/hooks';
import { restoreWindowGeometry, setupWindowGeometryPersistence } from '../utils/windowSize';

export function useWindowGeometry() {
  useEffect(() => {
    // Restore window geometry on startup
    restoreWindowGeometry();

    // Setup window geometry persistence (resize and move listeners)
    let unlistenGeometry: (() => void) | null = null;

    setupWindowGeometryPersistence().then(unlisten => {
      unlistenGeometry = unlisten;
    });

    return () => {
      // Cleanup geometry listeners
      if (unlistenGeometry) {
        unlistenGeometry();
      }
    };
  }, []);
}