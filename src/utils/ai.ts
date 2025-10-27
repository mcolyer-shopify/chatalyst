import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenAI } from '@ai-sdk/openai';
import { AI_PROVIDERS, PROVIDER_DEFAULTS } from '../constants/ai';
import type { Settings } from '../types';

// Type for AI provider with metadata
type AIProviderWithMetadata = (ReturnType<typeof createOpenAI> | ReturnType<typeof createOpenAICompatible>) & {
  _providerType: string;
};

// Common OpenAI models that support the responses API
const OPENAI_MODELS = [
  'gpt-5',
  'gpt-5-chat-latest',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5-turbo',
  'gpt-5-preview',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4o-2024-08-06',
  'gpt-4o-2024-05-13',
  'gpt-4o-mini-2024-07-18',
  'o1-preview',
  'o1-mini',
  'o3-deep-research',
  'o4-mini-deep-research',
  'gpt-4-turbo',
  'gpt-4-turbo-2024-04-09',
  'gpt-4-turbo-preview',
  'gpt-4-0125-preview',
  'gpt-4-1106-preview',
  'gpt-4',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-0125',
  'gpt-3.5-turbo-1106'
];

// Check if a model should use the responses API
export function shouldUseResponsesAPI(provider: string, model: string): boolean {
  // Only use responses API for OpenAI provider
  if (provider !== AI_PROVIDERS.OPENAI) {
    return false;
  }
  
  // Check if the model is in the OpenAI models list (supports both exact match and partial match)
  const isOpenAIModel = OPENAI_MODELS.some(openaiModel => 
    model.toLowerCase() === openaiModel.toLowerCase() || 
    model.toLowerCase().includes(openaiModel.toLowerCase())
  );
  
  return isOpenAIModel;
}

// Create a model function that can use either standard or responses API
export function createModelFunction(provider: AIProviderWithMetadata, model: string) {
  const providerType = provider._providerType;
  const useResponsesAPI = shouldUseResponsesAPI(providerType, model);
  
  if (useResponsesAPI && providerType === AI_PROVIDERS.OPENAI && 'responses' in provider) {
    return (provider as ReturnType<typeof createOpenAI>).responses(model);
  }
  return provider(model);
}

// Check if a model supports built-in tools
export function modelSupportsBuiltinTools(provider: string, model: string): boolean {
  return provider === AI_PROVIDERS.OPENAI && shouldUseResponsesAPI(provider, model);
}

// Models that have restricted parameter support (reasoning models)
const RESTRICTED_PARAMETER_MODELS = [
  'gpt-5',
  'gpt-5-chat-latest',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5-turbo',
  'gpt-5-preview',
  'o1-preview',
  'o1-mini',
  'o3-deep-research',
  'o4-mini-deep-research'
];

// Check if a model has restricted parameter support (e.g., reasoning models that don't support temperature)
export function modelHasRestrictedParameters(model: string): boolean {
  return RESTRICTED_PARAMETER_MODELS.some(restrictedModel =>
    model.toLowerCase() === restrictedModel.toLowerCase() ||
    model.toLowerCase().includes(restrictedModel.toLowerCase())
  );
}

// Build parameters object based on model capabilities
export interface GenerateTextParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export function buildModelSpecificParams(model: string, params: GenerateTextParams): GenerateTextParams {
  // For restricted parameter models, only include maxTokens
  if (modelHasRestrictedParameters(model)) {
    return {
      maxTokens: params.maxTokens
    };
  }

  // For other models, include all provided parameters
  return params;
}

// Filter streamText options for model capabilities
// For reasoning models (GPT-5, o1, o3), only pass parameters they support
export function filterStreamTextOptionsForModel(
  model: string,
  options: Record<string, unknown>
): Record<string, unknown> {
  if (modelHasRestrictedParameters(model)) {
    // For reasoning models, only pass core parameters they support
    // Exclude all sampling parameters: temperature, topP, topK, frequencyPenalty, presencePenalty, stopSequences, seed
    const { temperature: _temperature, topP: _topP, topK: _topK, frequencyPenalty: _frequencyPenalty, presencePenalty: _presencePenalty, stopSequences: _stopSequences, seed: _seed, ...supportedOptions } = options;
    return supportedOptions;
  }

  // For other models, return all options unchanged
  return options;
}

export function createAIProvider(settings: Settings): AIProviderWithMetadata {
  let baseURL = settings.baseURL;
  let apiKey = settings.apiKey;
  
  // Use provider-specific implementations
  switch (settings.provider) {
  case AI_PROVIDERS.OPENAI: {
    // Use native OpenAI provider
    baseURL = baseURL || PROVIDER_DEFAULTS.openai.baseURL;
    const openaiProvider = createOpenAI({
      apiKey: apiKey || '',
      baseURL: baseURL
    });
    
    // Add provider metadata for responses API detection
    (openaiProvider as AIProviderWithMetadata)._providerType = AI_PROVIDERS.OPENAI;
    return openaiProvider as AIProviderWithMetadata;
  }
    
  case AI_PROVIDERS.OPENROUTER: {
    // OpenRouter is OpenAI-compatible
    baseURL = baseURL || PROVIDER_DEFAULTS.openrouter.baseURL;
    apiKey = apiKey || PROVIDER_DEFAULTS.openrouter.apiKey;
    const openrouterProvider = createOpenAICompatible({
      name: 'openrouter-ai-provider',
      baseURL,
      apiKey
    });
    
    (openrouterProvider as unknown as AIProviderWithMetadata)._providerType = AI_PROVIDERS.OPENROUTER;
    return openrouterProvider as unknown as AIProviderWithMetadata;
  }
    
  case AI_PROVIDERS.OLLAMA: {
    // Ollama is OpenAI-compatible
    baseURL = baseURL || PROVIDER_DEFAULTS.ollama.baseURL;
    apiKey = apiKey || PROVIDER_DEFAULTS.ollama.apiKey; // Use configured key or default
    const ollamaProvider = createOpenAICompatible({
      name: 'ollama-ai-provider',
      baseURL,
      apiKey
    });
    
    (ollamaProvider as unknown as AIProviderWithMetadata)._providerType = AI_PROVIDERS.OLLAMA;
    return ollamaProvider as unknown as AIProviderWithMetadata;
  }
    
  case AI_PROVIDERS.GROQ:
  case AI_PROVIDERS.PERPLEXITY: {
    // These providers are OpenAI-compatible
    baseURL = baseURL || PROVIDER_DEFAULTS[settings.provider].baseURL;
    const compatibleProvider = createOpenAICompatible({
      name: `${settings.provider}-ai-provider`,
      baseURL,
      apiKey: apiKey || ''
    });
    
    (compatibleProvider as unknown as AIProviderWithMetadata)._providerType = settings.provider;
    return compatibleProvider as unknown as AIProviderWithMetadata;
  }
    
  case AI_PROVIDERS.ANTHROPIC:
  case AI_PROVIDERS.GOOGLE: {
    // These providers need their specific SDKs but can work with OpenAI-compatible mode
    baseURL = baseURL || PROVIDER_DEFAULTS[settings.provider].baseURL;
    const sdkProvider = createOpenAICompatible({
      name: `${settings.provider}-ai-provider`,
      baseURL,
      apiKey: apiKey || ''
    });
    
    (sdkProvider as unknown as AIProviderWithMetadata)._providerType = settings.provider;
    return sdkProvider as unknown as AIProviderWithMetadata;
  }
    
  case AI_PROVIDERS.CUSTOM:
  default: {
    // Check if it's an OpenAI endpoint
    if (baseURL && (baseURL.includes('api.openai.com') || baseURL.includes('openai.azure.com'))) {
      // Use native OpenAI provider for better compatibility
      const customOpenAIProvider = createOpenAI({
        apiKey: apiKey || '',
        baseURL: baseURL
      });
      
      (customOpenAIProvider as AIProviderWithMetadata)._providerType = AI_PROVIDERS.OPENAI;
      return customOpenAIProvider as AIProviderWithMetadata;
    }
    
    // Use OpenAI-compatible for other custom endpoints
    const customProvider = createOpenAICompatible({
      name: 'custom-ai-provider',
      baseURL: baseURL || 'http://localhost:8080/v1',
      apiKey: apiKey || ''
    });
    
    (customProvider as unknown as AIProviderWithMetadata)._providerType = AI_PROVIDERS.CUSTOM;
    return customProvider as unknown as AIProviderWithMetadata;
  }
  }
}

