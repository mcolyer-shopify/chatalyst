import { useEffect, useRef } from 'preact/hooks';
import { signal, computed } from '@preact/signals';
import { Model } from '../types';
import { settings, getCachedModels, setCachedModels, availableModels } from '../store';

interface ModelSelectorProps {
  selectedModel?: string;
  onModelChange: (modelId: string) => void;
  className?: string;
  showAsDefault?: boolean;
}

// Local component signals for UI state
const isOpen = signal(false);
const searchTerm = signal('');
const highlightedIndex = signal(-1);
const isLoading = signal(false);
const error = signal<string | null>(null);

// Computed filtered models
const filteredModels = computed(() => {
  const models = availableModels.value;
  if (searchTerm.value.trim() === '') {
    return models;
  }
  return models.filter(model =>
    model.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
    (model.description && model.description.toLowerCase().includes(searchTerm.value.toLowerCase()))
  );
});

export function ModelSelector({
  selectedModel,
  onModelChange,
  className = '',
  showAsDefault = false
}: ModelSelectorProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings.value.baseURL && settings.value.apiKey) {
      loadModels();
    }
  }, [settings.value.baseURL, settings.value.apiKey]);

  useEffect(() => {
    // Reset highlighted index when search results change
    highlightedIndex.value = -1;
  }, [filteredModels.value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        isOpen.value = false;
        searchTerm.value = '';
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadModels = async () => {
    const { baseURL } = settings.value;
    
    // Try to get from cache first
    const cachedModels = getCachedModels(baseURL);
    
    if (cachedModels) {
      availableModels.value = cachedModels;
      error.value = null;
      
      // Auto-select first model if no default is selected and this is a default selector
      if (showAsDefault && !selectedModel && cachedModels.length > 0) {
        onModelChange(cachedModels[0].id);
      }
      return;
    }

    // Cache miss or stale, fetch from API
    await fetchModels();
  };

  const fetchModels = async () => {
    const { baseURL, apiKey } = settings.value;
    isLoading.value = true;
    error.value = null;
    
    try {
      const response = await fetch(`${baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      const fetchedModels: Model[] = data.data?.map((model: unknown) => {
        const modelData = model as { id: string; description?: string };
        return {
          id: modelData.id,
          name: modelData.id,
          description: modelData.description || ''
        };
      }) || [];

      // Sort models alphabetically for better UX
      fetchedModels.sort((a, b) => a.name.localeCompare(b.name));
      
      availableModels.value = fetchedModels;
      setCachedModels(baseURL, fetchedModels);

      // Auto-select first model if no default is selected and this is a default selector
      if (showAsDefault && !selectedModel && fetchedModels.length > 0) {
        onModelChange(fetchedModels[0].id);
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch models';
    } finally {
      isLoading.value = false;
    }
  };

  const selectedModelData = availableModels.value.find(m => m.id === selectedModel);
  const displayName = showAsDefault 
    ? `Default model (${selectedModelData?.name || selectedModel || 'None'})`
    : selectedModelData?.name || selectedModel || 'Select Model';

  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId);
    isOpen.value = false;
    searchTerm.value = '';
    highlightedIndex.value = -1;
  };

  const handleDropdownToggle = () => {
    const newIsOpen = !isOpen.value;
    isOpen.value = newIsOpen;
    
    if (newIsOpen) {
      searchTerm.value = '';
      highlightedIndex.value = -1;
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen.value) return;

    switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      highlightedIndex.value = 
        highlightedIndex.value < filteredModels.value.length - 1 
          ? highlightedIndex.value + 1 
          : 0;
      break;
    case 'ArrowUp':
      e.preventDefault();
      highlightedIndex.value = 
        highlightedIndex.value > 0 
          ? highlightedIndex.value - 1 
          : filteredModels.value.length - 1;
      break;
    case 'Enter':
      e.preventDefault();
      if (highlightedIndex.value >= 0 && filteredModels.value[highlightedIndex.value]) {
        handleModelSelect(filteredModels.value[highlightedIndex.value].id);
      }
      break;
    case 'Escape':
      e.preventDefault();
      isOpen.value = false;
      searchTerm.value = '';
      highlightedIndex.value = -1;
      break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex.value >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex.value] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [highlightedIndex.value]);

  return (
    <div className={`model-selector ${className}`} ref={dropdownRef}>
      <button
        className="model-selector-button"
        onClick={handleDropdownToggle}
        disabled={isLoading.value || (!availableModels.value.length && !error.value)}
        onKeyDown={handleKeyDown}
      >
        <span className="model-selector-text">
          {isLoading.value ? 'Loading...' : displayName}
        </span>
        <span className="model-selector-arrow">▼</span>
      </button>

      {isOpen.value && (
        <div className="model-selector-dropdown">
          {error.value && (
            <div className="model-selector-error">
              {error.value}
              <button 
                className="model-selector-retry"
                onClick={() => fetchModels()}
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
                  value={searchTerm.value}
                  onInput={(e) => searchTerm.value = e.currentTarget.value}
                  onKeyDown={handleKeyDown}
                  placeholder="Search models..."
                  className="model-selector-search-input"
                />
              </div>
              
              <div className="model-selector-list" ref={listRef}>
                {filteredModels.value.length > 0 ? (
                  filteredModels.value.map((model, index) => (
                    <button
                      key={model.id}
                      className={`model-selector-option ${
                        selectedModel === model.id ? 'selected' : ''
                      } ${index === highlightedIndex.value ? 'highlighted' : ''}`}
                      onClick={() => handleModelSelect(model.id)}
                      onMouseEnter={() => highlightedIndex.value = index}
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
                    No models found matching "{searchTerm.value}"
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