import { useEffect, useRef, useState } from 'preact/hooks';
import { Model } from '../types';
import { settings, getCachedModels, setCachedModels, availableModels, getFailedFetchError, setFailedFetch, failedModelFetchCache } from '../store';

interface ModelSelectorProps {
  selectedModel?: string;
  onModelChange: (modelId: string) => void;
  className?: string;
  showAsDefault?: boolean;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  className = '',
  showAsDefault = false
}: ModelSelectorProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Local component state for UI state (instance-specific)
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Helper to get the effective base URL based on provider
  const getEffectiveBaseURL = () => {
    const { baseURL, provider } = settings.value;
    
    switch (provider) {
    case 'openrouter':
      return baseURL || 'https://openrouter.ai/api/v1';
    case 'ollama':
      return baseURL || 'http://localhost:11434/v1';
    case 'custom':
    default:
      return baseURL;
    }
  };

  // Computed filtered models based on local search term
  const filteredModels = availableModels.value.filter(model => {
    if (searchTerm.trim() === '') {
      return true;
    }
    return model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (model.description && model.description.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  useEffect(() => {
    // For Ollama, we don't need an API key
    const needsApiKey = settings.value.provider !== 'ollama';
    const hasRequiredAuth = !needsApiKey || settings.value.apiKey;
    
    if (settings.value.baseURL && hasRequiredAuth) {
      // Use a small delay to debounce rapid setting changes
      const timeoutId = setTimeout(() => {
        loadModels();
      }, 100);
      
      return () => window.clearTimeout(timeoutId);
    }
  }, [settings.value.baseURL, settings.value.apiKey, settings.value.provider]);

  useEffect(() => {
    // Reset highlighted index when search results change
    setHighlightedIndex(-1);
  }, [filteredModels]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadModels = async () => {
    const effectiveBaseURL = getEffectiveBaseURL();
    
    if (!effectiveBaseURL) {
      setError('Please configure Base URL in settings');
      return;
    }
    
    // Try to get from cache first
    const cachedModels = getCachedModels(effectiveBaseURL);
    
    if (cachedModels) {
      availableModels.value = cachedModels;
      setError(null);
      
      // Auto-select first model if this is a default selector and either:
      // 1. No model is currently selected, OR
      // 2. The currently selected model is not in the available models
      if (showAsDefault && cachedModels.length > 0) {
        const isCurrentModelValid = selectedModel && cachedModels.some(m => m.id === selectedModel);
        if (!selectedModel || !isCurrentModelValid) {
          onModelChange(cachedModels[0].id);
        }
      }
      return;
    }

    // Check if we recently failed to fetch from this URL
    const recentError = getFailedFetchError(effectiveBaseURL);
    if (recentError) {
      console.log('[ModelSelector] Recent failed fetch, showing cached error:', recentError);
      setError(recentError);
      return;
    }

    // Check if we're already loading to prevent duplicate requests
    if (isLoading) {
      console.log('[ModelSelector] Already loading models, skipping duplicate request');
      return;
    }

    // Cache miss or stale, fetch from API
    await fetchModels();
  };

  const fetchModels = async () => {
    const { apiKey, provider } = settings.value;
    const effectiveBaseURL = getEffectiveBaseURL();
    const effectiveApiKey = provider === 'ollama' ? '' : (apiKey || (provider === 'openrouter' ? 'openrouter' : ''));
    
    setIsLoading(true);
    setError(null);
    
    console.log('[ModelSelector] Provider:', provider);
    console.log('[ModelSelector] Fetching models from:', `${effectiveBaseURL}/models`);
    console.log('[ModelSelector] Using API key:', effectiveApiKey ? 'present' : 'missing');
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Only add Authorization header if API key is present
      if (effectiveApiKey) {
        headers['Authorization'] = `Bearer ${effectiveApiKey}`;
      }
      
      const response = await fetch(`${effectiveBaseURL}/models`, {
        headers
      });

      console.log('[ModelSelector] Response status:', response.status);
      
      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch {
          errorText = 'Unable to read error response';
        }
        console.error('[ModelSelector] Error response:', errorText);
        
        if (response.status >= 500) {
          throw new Error(`Server error (${response.status}): The API server is experiencing issues. Please try again later.`);
        } else if (response.status === 401) {
          throw new Error('Authentication failed: Check your API key');
        } else if (response.status === 404) {
          throw new Error('Models endpoint not found: Check your Base URL');
        } else {
          throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('[ModelSelector] Raw response data:', data);
      
      // Handle different response formats based on provider
      let fetchedModels: Model[] = [];
      
      if (provider === 'ollama' && data.models) {
        // Ollama has a different response format
        fetchedModels = data.models.map((model: { name: string; details?: { description?: string } }) => ({
          id: model.name,
          name: model.name,
          description: model.details?.description || ''
        }));
      } else {
        // OpenAI-compatible format (OpenRouter, Custom OpenAI)
        fetchedModels = data.data?.map((model: unknown) => {
          const modelData = model as { id: string; description?: string };
          return {
            id: modelData.id,
            name: modelData.id,
            description: modelData.description || ''
          };
        }) || [];
      }

      console.log('[ModelSelector] Parsed models count:', fetchedModels.length);
      
      // Sort models alphabetically for better UX
      fetchedModels.sort((a, b) => a.name.localeCompare(b.name));
      
      availableModels.value = fetchedModels;
      setCachedModels(effectiveBaseURL, fetchedModels);

      // Auto-select first model if this is a default selector and either:
      // 1. No model is currently selected, OR
      // 2. The currently selected model is not in the available models
      if (showAsDefault && fetchedModels.length > 0) {
        const isCurrentModelValid = selectedModel && fetchedModels.some(m => m.id === selectedModel);
        if (!selectedModel || !isCurrentModelValid) {
          onModelChange(fetchedModels[0].id);
        }
      }
    } catch (err) {
      console.error('[ModelSelector] Failed to fetch models:', err);
      let errorMessage: string;
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to API. Check your Base URL and internet connection.';
      } else {
        errorMessage = err instanceof Error ? err.message : 'Failed to fetch models';
      }
      
      setError(errorMessage);
      // Cache the failure to prevent repeated requests
      setFailedFetch(effectiveBaseURL, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedModelData = availableModels.value.find(m => m.id === selectedModel);
  const displayName = showAsDefault 
    ? `Default model (${selectedModelData?.name || selectedModel || 'None'})`
    : selectedModelData?.name || selectedModel || 'Select Model';

  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleDropdownToggle = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    if (newIsOpen) {
      setSearchTerm('');
      setHighlightedIndex(-1);
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredModels.length - 1 ? prev + 1 : 0
      );
      break;
    case 'ArrowUp':
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev > 0 ? prev - 1 : filteredModels.length - 1
      );
      break;
    case 'Enter':
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredModels[highlightedIndex]) {
        handleModelSelect(filteredModels[highlightedIndex].id);
      }
      break;
    case 'Escape':
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm('');
      setHighlightedIndex(-1);
      break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [highlightedIndex]);

  return (
    <div className={`model-selector ${className}`} ref={dropdownRef}>
      <button
        className="model-selector-button"
        onClick={handleDropdownToggle}
        disabled={isLoading || (!availableModels.value.length && !error)}
        onKeyDown={handleKeyDown}
      >
        <span className="model-selector-text">
          {isLoading ? 'Loading...' : displayName}
        </span>
        <span className="model-selector-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="model-selector-dropdown">
          {error && (
            <div className="model-selector-error">
              {error}
              <button 
                className="model-selector-retry"
                onClick={() => {
                  // Clear the failed cache entry before retrying
                  const effectiveBaseURL = getEffectiveBaseURL();
                  const newFailedCache = new Map(failedModelFetchCache.value);
                  newFailedCache.delete(effectiveBaseURL);
                  failedModelFetchCache.value = newFailedCache;
                  fetchModels();
                }}
              >
                Retry
              </button>
            </div>
          )}
          
          {availableModels.value.length > 0 && (
            <>
              <div className="model-selector-search">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onInput={(e) => setSearchTerm(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search models..."
                  className="model-selector-search-input"
                  autoCorrect="off"
                />
              </div>
              
              <div className="model-selector-list" ref={listRef}>
                {filteredModels.length > 0 ? (
                  filteredModels.map((model, index) => (
                    <button
                      key={model.id}
                      className={`model-selector-option ${
                        selectedModel === model.id ? 'selected' : ''
                      } ${index === highlightedIndex ? 'highlighted' : ''}`}
                      onClick={() => handleModelSelect(model.id)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div className="model-selector-option-name">{model.name}</div>
                      {model.description && (
                        <div className="model-selector-option-description">
                          {model.description}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="model-selector-no-results">
                    No models found matching "{searchTerm}"
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}