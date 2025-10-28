import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenAI } from '@ai-sdk/openai';
import { AI_PROVIDERS, PROVIDER_DEFAULTS } from '../constants/ai';
import type { Settings } from '../types';

// Type for AI provider with metadata
type AIProviderWithMetadata = (ReturnType<typeof createOpenAI> | ReturnType<typeof createOpenAICompatible>) & {
  _providerType: string;
};

// OpenAI models that explicitly support the responses API
// This is an explicit allowlist - only models here are treated as responses API models
// All other models use the standard API
const RESPONSES_API_MODELS = [
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
  'o4-mini-deep-research'
];

// Check if a model should use the responses API
export function shouldUseResponsesAPI(provider: string, model: string): boolean {
  console.log('[DEBUG] shouldUseResponsesAPI check:', { provider, model });

  // Only use responses API for OpenAI provider
  if (provider !== AI_PROVIDERS.OPENAI) {
    console.log('[DEBUG] Not OpenAI provider, returning false');
    return false;
  }

  // Check if the model is in the responses API models list using exact match only
  // This is conservative - we assume models DON'T use responses API unless explicitly listed
  const isResponsesAPIModel = RESPONSES_API_MODELS.some(responsesModel =>
    model.toLowerCase() === responsesModel.toLowerCase()
  );

  console.log('[DEBUG] Is responses API model?', isResponsesAPIModel, {
    model: model.toLowerCase(),
    responsesModels: RESPONSES_API_MODELS
  });
  return isResponsesAPIModel;
}

// Create a model function that can use either standard or responses API
export function createModelFunction(provider: AIProviderWithMetadata, model: string, baseURL?: string): unknown {
  const providerType = provider._providerType;
  const useResponsesAPI = shouldUseResponsesAPI(providerType, model);

  console.log('[DEBUG] createModelFunction:', { providerType, model, useResponsesAPI, baseURL });

  if (useResponsesAPI && providerType === AI_PROVIDERS.OPENAI && 'responses' in provider) {
    console.log('[DEBUG] Using responses API for', model);
    return (provider as ReturnType<typeof createOpenAI>).responses(model);
  }

  // For non-responses API models with OpenAI provider, create a custom provider
  // that redirects responses API calls to chat completions
  if (providerType === AI_PROVIDERS.OPENAI && !useResponsesAPI) {
    console.log('[DEBUG] Using chat completions for non-responses model:', model);

    const apiKey = (provider as any).config?.apiKey || (provider as any).apiKey || '';
    const url = baseURL || 'https://api.openai.com/v1';

    // Create a custom fetch function that intercepts responses API calls
    // and redirects them to chat completions, also converting the request body
     
    const customFetch = async (input: unknown, init?: unknown) => {
      let url_str = typeof input === 'string' ? input : String(input);
      const initObj = init as any || {};

      console.log('[DEBUG] customFetch intercepting:', { url: url_str, model });

      // If this is a responses API call, redirect to chat completions
      if (url_str.includes('/v1/responses')) {
        url_str = url_str.replace('/v1/responses', '/v1/chat/completions');
        console.log('[DEBUG] Redirecting responses to chat completions:', url_str);

        // Also need to transform the request body from responses API format to chat completions
        if (initObj.body) {
          try {
            const body = typeof initObj.body === 'string' ? JSON.parse(initObj.body) : initObj.body;
            console.log('[DEBUG] Original body:', JSON.stringify(body, null, 2));

            // Convert responses API body to chat completions body
            // Responses API uses "input" array with content objects like {type: "input_text", text: "..."}
            // Chat completions uses "messages" array with content as strings
            const convertedMessages = (body.input || []).map((msg: any) => {
              // Convert content from array format to string format
              let content = msg.content;
              if (Array.isArray(content)) {
                // Extract text from content array
                content = content
                  .map((c: any) => (typeof c === 'string' ? c : c.text || ''))
                  .join('');
              }
              return {
                role: msg.role,
                content
              };
            });

            const convertedBody = {
              model: body.model,
              messages: convertedMessages,
              temperature: body.temperature,
              top_p: body.top_p,
              max_tokens: body.max_tokens,
              presence_penalty: body.presence_penalty,
              frequency_penalty: body.frequency_penalty,
              stream: body.stream,
              tools: body.tools,
              tool_choice: body.tool_choice
            };

            // Remove undefined values
            Object.keys(convertedBody).forEach((key: string) => {
              if ((convertedBody as any)[key] === undefined) {
                delete (convertedBody as any)[key];
              }
            });

            initObj.body = JSON.stringify(convertedBody);
            console.log('[DEBUG] Converted body:', convertedBody);
          } catch (e) {
            console.error('[DEBUG] Failed to convert body:', e);
          }
        }
      }

      // Use fetch from global scope
      const response = await fetch(url_str, initObj);

      // If redirected to chat completions, transform response back to responses API format
      if (url_str.includes('/v1/chat/completions') && response.ok) {
        console.log('[DEBUG] Transforming chat completions response to responses API format');
        const contentType = response.headers.get('content-type') || '';

        // For streaming responses
        if (initObj.stream || contentType.includes('text/event-stream') || contentType.includes('stream')) {
          console.log('[DEBUG] Transforming streaming response');
          const reader = response.body?.getReader();
          if (!reader) return response;

          // eslint-disable-next-line no-undef
          const decoder = new TextDecoder();
          let buffer = '';

          // eslint-disable-next-line no-undef
          const transformStream = new ReadableStream({
            async start(controller) {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || '';

                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const data = line.slice(6).trim();
                      if (data === '[DONE]') {
                        // Send done marker
                        controller.enqueue(
                          // eslint-disable-next-line no-undef
                          new TextEncoder().encode('data: {"type":"response.done"}\n\n')
                        );
                      } else {
                        try {
                          const chunk = JSON.parse(data);
                          // Transform chat completions chunk to responses API format
                          if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta?.content) {
                            const transformed = {
                              type: 'response.output_text.delta',
                              delta: chunk.choices[0].delta.content
                            };
                            console.log('[DEBUG] Transformed chunk:', transformed);
                            controller.enqueue(
                              // eslint-disable-next-line no-undef
                              new TextEncoder().encode(`data: ${JSON.stringify(transformed)}\n\n`)
                            );
                          }
                        } catch (e) {
                          console.error('[DEBUG] Failed to parse chunk:', e);
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                console.error('[DEBUG] Stream transformation error:', e);
                controller.error(e);
              } finally {
                controller.close();
              }
            }
          });

          // eslint-disable-next-line no-undef
          return new Response(transformStream, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        }
      }

      return response;
    };

    // Create provider with custom fetch
    const customProvider = createOpenAI({
      apiKey,
      baseURL: url,
      fetch: customFetch as any
    });

    return customProvider(model);
  }

  console.log('[DEBUG] Using standard API for', model);
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
    model.toLowerCase() === restrictedModel.toLowerCase()
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

