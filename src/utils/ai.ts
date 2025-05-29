import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenAI } from '@ai-sdk/openai';
import { AI_PROVIDERS, PROVIDER_DEFAULTS } from '../constants/ai';
import type { Settings } from '../types';

export function createAIProvider(settings: Settings) {
  let baseURL = settings.baseURL;
  let apiKey = settings.apiKey;
  
  // Use provider-specific implementations
  switch (settings.provider) {
  case AI_PROVIDERS.OPENAI:
    // Use native OpenAI provider
    baseURL = baseURL || PROVIDER_DEFAULTS.openai.baseURL;
    return createOpenAI({
      apiKey: apiKey || '',
      baseURL: baseURL !== PROVIDER_DEFAULTS.openai.baseURL ? baseURL : undefined
    });
    
  case AI_PROVIDERS.OPENROUTER:
    // OpenRouter is OpenAI-compatible
    baseURL = baseURL || PROVIDER_DEFAULTS.openrouter.baseURL;
    apiKey = apiKey || PROVIDER_DEFAULTS.openrouter.apiKey;
    return createOpenAICompatible({
      name: 'openrouter-ai-provider',
      baseURL,
      apiKey
    });
    
  case AI_PROVIDERS.OLLAMA:
    // Ollama is OpenAI-compatible
    baseURL = baseURL || PROVIDER_DEFAULTS.ollama.baseURL;
    apiKey = PROVIDER_DEFAULTS.ollama.apiKey || 'ollama'; // Ollama needs a non-empty key
    return createOpenAICompatible({
      name: 'ollama-ai-provider',
      baseURL,
      apiKey
    });
    
  case AI_PROVIDERS.GROQ:
  case AI_PROVIDERS.PERPLEXITY:
    // These providers are OpenAI-compatible
    baseURL = baseURL || PROVIDER_DEFAULTS[settings.provider].baseURL;
    return createOpenAICompatible({
      name: `${settings.provider}-ai-provider`,
      baseURL,
      apiKey: apiKey || ''
    });
    
  case AI_PROVIDERS.ANTHROPIC:
  case AI_PROVIDERS.GOOGLE:
    // These providers need their specific SDKs but can work with OpenAI-compatible mode
    baseURL = baseURL || PROVIDER_DEFAULTS[settings.provider].baseURL;
    return createOpenAICompatible({
      name: `${settings.provider}-ai-provider`,
      baseURL,
      apiKey: apiKey || ''
    });
    
  case AI_PROVIDERS.CUSTOM:
  default:
    // Check if it's an OpenAI endpoint
    if (baseURL && (baseURL.includes('api.openai.com') || baseURL.includes('openai.azure.com'))) {
      // Use native OpenAI provider for better compatibility
      return createOpenAI({
        apiKey: apiKey || '',
        baseURL: baseURL
      });
    }
    
    // Use OpenAI-compatible for other custom endpoints
    return createOpenAICompatible({
      name: 'custom-ai-provider',
      baseURL: baseURL || 'http://localhost:8080/v1',
      apiKey: apiKey || ''
    });
  }
}

