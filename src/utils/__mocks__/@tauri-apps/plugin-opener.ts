// Mock for @tauri-apps/plugin-opener
import { vi } from 'vitest';

export const openUrl = vi.fn().mockResolvedValue(undefined);