import { useState, useEffect } from "preact/hooks";
import "./SettingsModal.css";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: { baseURL: string; apiKey: string }) => void;
}

const DEFAULT_BASE_URL = "https://proxy-shopify-ai.local.shop.dev/v1/";
const DEFAULT_API_KEY = "dummy-key-for-proxy";

function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [baseURL, setBaseURL] = useState(DEFAULT_BASE_URL);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);

  useEffect(() => {
    // Load settings from localStorage when modal opens
    if (isOpen) {
      const savedBaseURL = localStorage.getItem("ai-base-url") || DEFAULT_BASE_URL;
      const savedApiKey = localStorage.getItem("ai-api-key") || DEFAULT_API_KEY;
      setBaseURL(savedBaseURL);
      setApiKey(savedApiKey);
    }
  }, [isOpen]);

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem("ai-base-url", baseURL);
    localStorage.setItem("ai-api-key", apiKey);
    
    // Notify parent component
    onSave({ baseURL, apiKey });
    onClose();
  };

  const handleReset = () => {
    setBaseURL(DEFAULT_BASE_URL);
    setApiKey(DEFAULT_API_KEY);
  };

  if (!isOpen) return null;

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal-content" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Settings</h2>
          <button class="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label for="base-url">Base URL</label>
            <input
              id="base-url"
              type="url"
              value={baseURL}
              onInput={(e) => setBaseURL((e.target as HTMLInputElement).value)}
              placeholder="https://api.example.com/v1/"
            />
          </div>
          
          <div class="form-group">
            <label for="api-key">API Key</label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
              placeholder="Enter your API key"
            />
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="secondary-button" onClick={handleReset}>
            Reset to Defaults
          </button>
          <div style={{ display: "flex", gap: "10px" }}>
            <button class="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button class="primary-button" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;