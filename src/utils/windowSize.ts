import { getCurrentWindow } from '@tauri-apps/api/window';
import { PhysicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { showError } from '../store';

// Check if we're running in a Tauri environment
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export interface WindowGeometry {
  width: number;
  height: number;
  x: number;
  y: number;
}

const WINDOW_GEOMETRY_KEY = 'chatalyst_window_geometry';

export async function getWindowGeometry(): Promise<WindowGeometry> {
  if (!isTauri()) {
    return { width: 800, height: 600, x: 100, y: 100 }; // Default for non-Tauri environments
  }
  
  const window = getCurrentWindow();
  const [size, position] = await Promise.all([
    window.outerSize(),
    window.outerPosition()
  ]);
  
  return {
    width: size.width,
    height: size.height,
    x: position.x,
    y: position.y
  };
}

export async function setWindowGeometry(geometry: WindowGeometry): Promise<void> {
  if (!isTauri()) {
    return; // No-op in non-Tauri environments
  }
  
  const window = getCurrentWindow();
  const size = new PhysicalSize(geometry.width, geometry.height);
  const position = new PhysicalPosition(geometry.x, geometry.y);
  
  // Set size and position
  await Promise.all([
    window.setSize(size),
    window.setPosition(position)
  ]);
}

export function saveWindowGeometry(geometry: WindowGeometry): void {
  try {
    localStorage.setItem(WINDOW_GEOMETRY_KEY, JSON.stringify(geometry));
  } catch (error) {
    showError(`Failed to save window geometry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function loadWindowGeometry(): WindowGeometry | null {
  try {
    const saved = localStorage.getItem(WINDOW_GEOMETRY_KEY);
    if (saved) {
      return JSON.parse(saved) as WindowGeometry;
    }
    return null;
  } catch (error) {
    showError(`Failed to load window geometry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

export async function saveCurrentWindowGeometry(): Promise<void> {
  try {
    const geometry = await getWindowGeometry();
    saveWindowGeometry(geometry);
  } catch (error) {
    showError(`Failed to save current window geometry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function restoreWindowGeometry(): Promise<void> {
  if (!isTauri()) {
    return; // No-op in non-Tauri environments
  }
  
  try {
    const savedGeometry = loadWindowGeometry();
    if (savedGeometry) {
      await setWindowGeometry(savedGeometry);
    }
  } catch (error) {
    showError(`Failed to restore window geometry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function setupWindowGeometryPersistence(): Promise<() => void> {
  if (!isTauri()) {
    return () => {}; // Return no-op function in non-Tauri environments
  }
  
  const window = getCurrentWindow();
  
  // Listen for window resize and move events
  const [unlistenResize, unlistenMove] = await Promise.all([
    window.onResized((_event) => {
      // When window is resized, save the new geometry
      saveCurrentWindowGeometry();
    }),
    window.onMoved((_event) => {
      // When window is moved, save the new geometry
      saveCurrentWindowGeometry();
    })
  ]);

  // Return a function that cleans up both listeners
  return () => {
    unlistenResize();
    unlistenMove();
  };
}