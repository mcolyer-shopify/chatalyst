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
    name: 'Custom OpenAI',
    showBaseURL: true,
    showApiKey: true,
    baseURLPlaceholder: 'https://api.openai.com/v1',
    apiKeyPlaceholder: 'sk-...'
  },
  openrouter: {
    name: 'OpenRouter',
    showBaseURL: false,
    showApiKey: true,
    defaultBaseURL: 'https://openrouter.ai/api/v1',
    apiKeyPlaceholder: 'sk-or-v1-...'
  },
  ollama: {
    name: 'Ollama',
    showBaseURL: false,
    showApiKey: false,
    defaultBaseURL: 'http://localhost:11434/v1'
  }
};

export function SettingsModal({ show, settings, onSave, onCancel }: SettingsModalProps) {
  const [tempSettings, setTempSettings] = useState(settings);

  // Update temp settings when props change
  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

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
          <select
            value={tempSettings.provider}
            onChange={(e) => handleProviderChange(e.currentTarget.value as AIProvider)}
          >
            {Object.entries(PROVIDER_CONFIGS).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name}
              </option>
            ))}
          </select>
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