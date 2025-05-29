export const DEFAULT_MODEL = 'gpt-4-turbo';
export const MAX_TOOL_STEPS = 10;

export const AI_PROVIDERS = {
  OPENROUTER: 'openrouter',
  OLLAMA: 'ollama',
  CUSTOM: 'custom',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  GROQ: 'groq',
  PERPLEXITY: 'perplexity'
} as const;

export const PROVIDER_DEFAULTS = {
  [AI_PROVIDERS.OPENROUTER]: {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: 'openrouter'
  },
  [AI_PROVIDERS.OLLAMA]: {
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama'
  },
  [AI_PROVIDERS.OPENAI]: {
    baseURL: 'https://api.openai.com/v1',
    apiKey: ''
  },
  [AI_PROVIDERS.ANTHROPIC]: {
    baseURL: 'https://api.anthropic.com',
    apiKey: ''
  },
  [AI_PROVIDERS.GOOGLE]: {
    baseURL: 'https://generativelanguage.googleapis.com',
    apiKey: ''
  },
  [AI_PROVIDERS.GROQ]: {
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: ''
  },
  [AI_PROVIDERS.PERPLEXITY]: {
    baseURL: 'https://api.perplexity.ai',
    apiKey: ''
  }
} as const;