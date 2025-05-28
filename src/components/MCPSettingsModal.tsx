import { useState, useEffect } from 'preact/hooks';

interface MCPSettingsModalProps {
  show: boolean;
  mcpConfiguration: string | undefined;
  onSave: (mcpConfiguration: string) => void;
  onCancel: () => void;
}

export function MCPSettingsModal({ show, mcpConfiguration, onSave, onCancel }: MCPSettingsModalProps) {
  const [tempMcpConfig, setTempMcpConfig] = useState(mcpConfiguration || '');
  const [mcpConfigError, setMcpConfigError] = useState<string | null>(null);

  // Update temp config when props change
  useEffect(() => {
    setTempMcpConfig(mcpConfiguration || '');
  }, [mcpConfiguration]);

  if (!show) return null;

  const validateMcpConfiguration = (value: string): boolean => {
    if (!value.trim()) {
      setMcpConfigError(null);
      return true;
    }

    try {
      const parsed = JSON.parse(value);
      
      if (typeof parsed !== 'object' || parsed === null) {
        setMcpConfigError('Configuration must be a JSON object');
        return false;
      }

      // Validate each server config
      for (const [key, config] of Object.entries(parsed)) {
        if (typeof config !== 'object' || config === null) {
          setMcpConfigError(`Server "${key}" must be an object`);
          return false;
        }

        const serverConfig = config as any;
        if (!serverConfig.name || typeof serverConfig.name !== 'string') {
          setMcpConfigError(`Server "${key}" must have a name`);
          return false;
        }
        if (!serverConfig.description || typeof serverConfig.description !== 'string') {
          setMcpConfigError(`Server "${key}" must have a description`);
          return false;
        }
        if (!serverConfig.command || typeof serverConfig.command !== 'string') {
          setMcpConfigError(`Server "${key}" must have a command`);
          return false;
        }
        if (serverConfig.transport !== 'stdio') {
          setMcpConfigError(`Server "${key}" transport must be "stdio"`);
          return false;
        }
      }

      setMcpConfigError(null);
      return true;
    } catch (e) {
      setMcpConfigError(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
      return false;
    }
  };

  const handleSave = () => {
    if (validateMcpConfiguration(tempMcpConfig)) {
      onSave(tempMcpConfig);
    }
  };

  const handleCancel = () => {
    setTempMcpConfig(mcpConfiguration || '');
    setMcpConfigError(null);
    onCancel();
  };

  return (
    <>
      <div class="modal-backdrop" onClick={handleCancel} />
      <div class="modal">
        <h2>MCP Settings</h2>

        <div class="form-group">
          <label>MCP Configuration (JSON):</label>
          <textarea
            value={tempMcpConfig}
            onInput={(e) => {
              const value = (e.target as HTMLTextAreaElement).value;
              setTempMcpConfig(value);
            }}
            onBlur={() => validateMcpConfiguration(tempMcpConfig)}
            rows={15}
            style={{
              width: '100%',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}
            placeholder='{"server-name": {"name": "...", "description": "...", "transport": "stdio", "command": "..."}}'
          />
          {mcpConfigError && (
            <div style={{ color: 'red', marginTop: '5px', fontSize: '14px' }}>
              {mcpConfigError}
            </div>
          )}
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