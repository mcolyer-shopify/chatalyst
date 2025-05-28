import { useState, useEffect } from 'preact/hooks';
import { Settings } from '../types';

interface SettingsModalProps {
  show: boolean;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onCancel: () => void;
}

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

  return (
    <>
      <div class="modal-backdrop" onClick={handleCancel} />
      <div class="modal">
        <h2>Settings</h2>

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
          />
        </div>

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
            placeholder="Leave blank to use 'openrouter'"
          />
        </div>

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