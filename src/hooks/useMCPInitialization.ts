import { useEffect } from 'preact/hooks';
import { listen } from '@tauri-apps/api/event';
import { initializeMCPConnections, shutdownMCPConnections } from '../utils/mcp';

export function useMCPInitialization(mcpConfiguration: string) {
  useEffect(() => {
    // Initialize MCP connections with saved configuration
    initializeMCPConnections(mcpConfiguration);

    // Listen for window close event to cleanup MCP connections
    const setupCloseListener = async () => {
      const unlisten = await listen('tauri://close-requested', async () => {
        await shutdownMCPConnections();
      });
      return unlisten;
    };

    let unlistenClose: (() => void) | null = null;
    setupCloseListener().then(unlisten => {
      unlistenClose = unlisten;
    });

    // Cleanup function to shutdown connections
    return () => {
      shutdownMCPConnections();
      if (unlistenClose) {
        unlistenClose();
      }
    };
  }, []);
}