import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { AI_PROVIDERS, PROVIDER_DEFAULTS } from '../constants/ai';
import type { Settings } from '../types';

export function createAIProvider(settings: Settings) {
  let baseURL = settings.baseURL;
  let apiKey = settings.apiKey;
  
  // Use provider-specific defaults
  switch (settings.provider) {
  case AI_PROVIDERS.OPENROUTER:
    baseURL = baseURL || PROVIDER_DEFAULTS.openrouter.baseURL;
    apiKey = apiKey || PROVIDER_DEFAULTS.openrouter.apiKey;
    break;
  case AI_PROVIDERS.OLLAMA:
    baseURL = baseURL || PROVIDER_DEFAULTS.ollama.baseURL;
    apiKey = PROVIDER_DEFAULTS.ollama.apiKey;
    break;
  case AI_PROVIDERS.CUSTOM:
    // Use whatever is configured
    break;
  }
  
  return createOpenAICompatible({
    name: `${settings.provider}-ai-provider`,
    baseURL,
    apiKey
  });
}