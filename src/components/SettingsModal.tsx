import { useState, useEffect } from 'preact/hooks';
import { Settings, AIProvider } from '../types';

interface SettingsModalProps {
  show: boolean;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onCancel: () => void;
}

type ProviderConfig = {
  name: string;
  showBaseURL: boolean;
  showApiKey: boolean;
  defaultBaseURL?: string;
  baseURLPlaceholder?: string;
  apiKeyPlaceholder?: string;
};

const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  custom: {
    name: 'Custom OpenAI-Compatible',
    showBaseURL: true,
    showApiKey: true,
    baseURLPlaceholder: 'https://api.example.com/v1',
    apiKeyPlaceholder: 'your-api-key'
  },
  openai: {
    name: 'OpenAI',
    showBaseURL: false,
    showApiKey: true,
    defaultBaseURL: 'https://api.openai.com/v1',
    apiKeyPlaceholder: 'sk-...'
  },
  anthropic: {
    name: 'Anthropic',
    showBaseURL: false,
    showApiKey: true,
    defaultBaseURL: 'https://api.anthropic.com',
    apiKeyPlaceholder: 'sk-ant-...'
  },
  google: {
    name: 'Google AI',
    showBaseURL: false,
    showApiKey: true,
    defaultBaseURL: 'https://generativelanguage.googleapis.com',
    apiKeyPlaceholder: 'AIza...'
  },
  groq: {
    name: 'Groq',
    showBaseURL: false,
    showApiKey: true,
    defaultBaseURL: 'https://api.groq.com/openai/v1',
    apiKeyPlaceholder: 'gsk_...'
  },
  perplexity: {
    name: 'Perplexity',
    showBaseURL: false,
    showApiKey: true,
    defaultBaseURL: 'https://api.perplexity.ai',
    apiKeyPlaceholder: 'pplx-...'
  },
  openrouter: {
    name: 'OpenRouter',
    showBaseURL: false,
    showApiKey: true,
    defaultBaseURL: 'https://openrouter.ai/api/v1',
    apiKeyPlaceholder: 'sk-or-v1-...'
  },
  ollama: {
    name: 'Ollama (Local)',
    showBaseURL: true,
    showApiKey: false,
    defaultBaseURL: 'http://localhost:11434/v1',
    baseURLPlaceholder: 'http://localhost:11434/v1'
  }
};

export function SettingsModal({ show, settings, onSave, onCancel }: SettingsModalProps) {
  const [tempSettings, setTempSettings] = useState(settings);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);

  // Update temp settings when props change
  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.provider-selector')) {
        setIsProviderDropdownOpen(false);
      }
    };

    if (show && isProviderDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [show, isProviderDropdownOpen]);

  if (!show) return null;

  const handleSave = () => {
    onSave(tempSettings);
  };

  const handleCancel = () => {
    setTempSettings(settings); // Reset temp settings
    onCancel();
  };

  const handleProviderChange = (provider: AIProvider) => {
    const config = PROVIDER_CONFIGS[provider];
    const updates: Partial<Settings> = { provider };
    
    // Set default base URL for non-custom providers
    if (!config.showBaseURL && config.defaultBaseURL) {
      updates.baseURL = config.defaultBaseURL;
    }
    
    // Clear API key for providers that don't need it
    if (!config.showApiKey) {
      updates.apiKey = '';
    }
    
    setTempSettings({
      ...tempSettings,
      ...updates
    });
  };

  const currentConfig = PROVIDER_CONFIGS[tempSettings.provider];

  return (
    <>
      <div class="modal-backdrop" onClick={handleCancel} />
      <div class="modal">
        <h2>Settings</h2>

        <div class="form-group">
          <label>AI Provider:</label>
          <div class="provider-selector">
            <button
              type="button"
              class="provider-selector-button"
              onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)}
            >
              <span class="provider-selector-text">
                {PROVIDER_CONFIGS[tempSettings.provider].name}
              </span>
              <span class="provider-selector-arrow">▼</span>
            </button>
            
            {isProviderDropdownOpen && (
              <div class="provider-selector-dropdown">
                {Object.entries(PROVIDER_CONFIGS).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    class={`provider-selector-option ${tempSettings.provider === key ? 'selected' : ''}`}
                    onClick={() => {
                      handleProviderChange(key as AIProvider);
                      setIsProviderDropdownOpen(false);
                    }}
                  >
                    <div class="provider-selector-option-name">{config.name}</div>
                    {key === 'custom' && (
                      <div class="provider-selector-option-description">
                        Connect to any OpenAI-compatible API
                      </div>
                    )}
                    {key === 'openrouter' && (
                      <div class="provider-selector-option-description">
                        Access multiple AI models through one API
                      </div>
                    )}
                    {key === 'ollama' && (
                      <div class="provider-selector-option-description">
                        Run models locally on your machine
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {currentConfig.showBaseURL && (
          <div class="form-group">
            <label>Base URL:</label>
            <input
              type="text"
              value={tempSettings.baseURL}
              onInput={(e) =>
                setTempSettings({
                  ...tempSettings,
                  baseURL: (e.target as HTMLInputElement).value
                })
              }
              placeholder={currentConfig.baseURLPlaceholder}
            />
          </div>
        )}

        {currentConfig.showApiKey && (
          <div class="form-group">
            <label>API Key:</label>
            <input
              type="password"
              value={tempSettings.apiKey}
              onInput={(e) =>
                setTempSettings({
                  ...tempSettings,
                  apiKey: (e.target as HTMLInputElement).value
                })
              }
              placeholder={currentConfig.apiKeyPlaceholder}
            />
          </div>
        )}

        <div class="modal-actions">
          <button onClick={handleCancel} class="button-secondary">
            Cancel
          </button>
          <button onClick={handleSave} class="button-primary">
            Save
          </button>
        </div>
      </div>
    </>
  );
}