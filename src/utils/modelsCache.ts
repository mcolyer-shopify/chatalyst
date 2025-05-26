import type { Model } from '../types';

interface ModelsCacheEntry {
  baseURL: string;
  models: Model[];
  timestamp: number;
  apiKeyHash: string;
}

const CACHE_KEY = 'chatalyst-models-cache';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

// Simple hash function for API key (for cache key, not security)
function hashString(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString();
}

export function getCachedModels(baseURL: string, apiKey: string): Model[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const entry: ModelsCacheEntry = JSON.parse(cached);
    const now = Date.now();
    const apiKeyHash = hashString(apiKey);

    // Check if cache is valid
    if (
      entry.baseURL === baseURL &&
      entry.apiKeyHash === apiKeyHash &&
      (now - entry.timestamp) < CACHE_DURATION_MS
    ) {
      return entry.models;
    }

    // Cache is stale or for different base URL/API key
    return null;
  } catch {
    // If there's any error reading cache, return null
    return null;
  }
}

export function setCachedModels(baseURL: string, apiKey: string, models: Model[]): void {
  try {
    const entry: ModelsCacheEntry = {
      baseURL,
      models,
      timestamp: Date.now(),
      apiKeyHash: hashString(apiKey)
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Silently fail if localStorage is not available
  }
}

export function clearModelsCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Silently fail if localStorage is not available
  }
}

export function isCacheStale(baseURL: string, apiKey: string): boolean {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return true;

    const entry: ModelsCacheEntry = JSON.parse(cached);
    const now = Date.now();
    const apiKeyHash = hashString(apiKey);

    return (
      entry.baseURL !== baseURL ||
      entry.apiKeyHash !== apiKeyHash ||
      (now - entry.timestamp) >= CACHE_DURATION_MS
    );
  } catch {
    return true;
  }
}