export const DEFAULT_MODEL = 'gpt-4-turbo';
export const MAX_TOOL_STEPS = 10;

export const AI_PROVIDERS = {
  OPENROUTER: 'openrouter',
  OLLAMA: 'ollama',
  CUSTOM: 'custom'
} as const;

export const PROVIDER_DEFAULTS = {
  [AI_PROVIDERS.OPENROUTER]: {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: 'openrouter'
  },
  [AI_PROVIDERS.OLLAMA]: {
    baseURL: 'http://localhost:11434/v1',
    apiKey: ''
  }
} as const;