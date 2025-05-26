import { useState, useEffect, useRef } from 'preact/hooks';
import { Model } from '../types';
import { getCachedModels, setCachedModels, isCacheStale } from '../utils/modelsCache';

interface ModelSelectorProps {
  selectedModel?: string;
  onModelChange: (modelId: string) => void;
  baseURL: string;
  apiKey: string;
  className?: string;
  showAsDefault?: boolean;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  baseURL,
  apiKey,
  className = '',
  showAsDefault = false
}: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [filteredModels, setFilteredModels] = useState<Model[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (baseURL && apiKey) {
      loadModels();
    }
  }, [baseURL, apiKey]);

  useEffect(() => {
    // Filter models based on search term
    if (searchTerm.trim() === '') {
      setFilteredModels(models);
    } else {
      const filtered = models.filter(model =>
        model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (model.description && model.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredModels(filtered);
    }
    setHighlightedIndex(-1);
  }, [models, searchTerm]);

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
    // Try to get from cache first
    const cachedModels = getCachedModels(baseURL, apiKey);
    
    if (cachedModels && !isCacheStale(baseURL, apiKey)) {
      setModels(cachedModels);
      setError(null);
      
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
    setLoading(true);
    setError(null);
    
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
      
      setModels(fetchedModels);
      setCachedModels(baseURL, apiKey, fetchedModels);

      // Auto-select first model if no default is selected and this is a default selector
      if (showAsDefault && !selectedModel && fetchedModels.length > 0) {
        onModelChange(fetchedModels[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch models');
    } finally {
      setLoading(false);
    }
  };

  const selectedModelData = models.find(m => m.id === selectedModel);
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
        disabled={loading || (!models.length && !error)}
        onKeyDown={handleKeyDown}
      >
        <span className="model-selector-text">
          {loading ? 'Loading...' : displayName}
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
                onClick={() => fetchModels()}
              >
                Retry
              </button>
            </div>
          )}
          
          {models.length > 0 && (
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