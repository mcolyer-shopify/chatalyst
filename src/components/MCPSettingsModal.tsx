import { useState, useEffect } from 'preact/hooks';
import type { MCPServerConfig } from '../types';

interface MCPServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  transport: 'stdio';
}

interface MCPSettingsModalProps {
  show: boolean;
  mcpConfiguration: string | undefined;
  onSave: (mcpConfiguration: string) => void;
  onCancel: () => void;
}

export function MCPSettingsModal({ show, mcpConfiguration, onSave, onCancel }: MCPSettingsModalProps) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Parse configuration on mount and when props change
  useEffect(() => {
    if (mcpConfiguration) {
      try {
        const parsed = JSON.parse(mcpConfiguration);
        const serverList: MCPServer[] = [];
        
        for (const [id, config] of Object.entries(parsed)) {
          const serverConfig = config as MCPServerConfig;
          serverList.push({
            id,
            name: serverConfig.name || '',
            description: serverConfig.description || '',
            command: serverConfig.command || '',
            args: serverConfig.args || [],
            env: serverConfig.env || {},
            transport: 'stdio'
          });
        }
        
        setServers(serverList);
        if (serverList.length > 0 && !selectedServerId) {
          setSelectedServerId(serverList[0].id);
          setEditingServer({ ...serverList[0] });
        }
      } catch {
        setError('Failed to parse configuration');
      }
    }
  }, [mcpConfiguration]);

  // Update editing server when selection changes
  useEffect(() => {
    if (selectedServerId) {
      const server = servers.find(s => s.id === selectedServerId);
      if (server) {
        setEditingServer({ ...server });
      }
    }
  }, [selectedServerId, servers]);

  if (!show) return null;

  const handleAddServer = () => {
    const newId = `server-${Date.now()}`;
    const newServer: MCPServer = {
      id: newId,
      name: 'New Server',
      description: 'Server description',
      command: '',
      args: [],
      env: {},
      transport: 'stdio'
    };
    
    setServers([...servers, newServer]);
    setSelectedServerId(newId);
    setEditingServer({ ...newServer });
  };

  const handleRemoveServer = () => {
    if (!selectedServerId) return;
    
    const newServers = servers.filter(s => s.id !== selectedServerId);
    setServers(newServers);
    
    if (newServers.length > 0) {
      setSelectedServerId(newServers[0].id);
    } else {
      setSelectedServerId(null);
      setEditingServer(null);
    }
  };

  const handleServerChange = (field: keyof MCPServer, value: string | string[] | Record<string, string>) => {
    if (!editingServer) return;
    
    const updated = { ...editingServer, [field]: value };
    setEditingServer(updated);
    
    // Update in servers list
    setServers(servers.map(s => 
      s.id === editingServer.id ? updated : s
    ));
  };

  const handleSave = () => {
    // Validate all servers
    for (const server of servers) {
      if (!server.name.trim()) {
        setError(`Server "${server.id}" must have a name`);
        return;
      }
      if (!server.description.trim()) {
        setError(`Server "${server.id}" must have a description`);
        return;
      }
      if (!server.command.trim()) {
        setError(`Server "${server.id}" must have a command`);
        return;
      }
    }

    // Convert to JSON format
    const config: Record<string, MCPServerConfig> = {};
    for (const server of servers) {
      config[server.id] = {
        name: server.name,
        description: server.description,
        command: server.command,
        transport: server.transport
      };
      
      if (server.args && server.args.length > 0) {
        // Filter out empty args when saving
        const filteredArgs = server.args.filter(arg => arg.trim());
        if (filteredArgs.length > 0) {
          config[server.id].args = filteredArgs;
        }
      }
      
      if (server.env && Object.keys(server.env).length > 0) {
        config[server.id].env = server.env;
      }
    }
    
    onSave(JSON.stringify(config, null, 2));
  };

  const handleCancel = () => {
    setServers([]);
    setSelectedServerId(null);
    setEditingServer(null);
    setError(null);
    onCancel();
  };

  const handleArgsChange = (value: string) => {
    if (!editingServer) return;
    
    // Split by newlines but preserve empty lines for proper textarea behavior
    const args = value.split('\n');
    handleServerChange('args', args);
  };

  const handleEnvChange = (value: string) => {
    if (!editingServer) return;
    
    const env: Record<string, string> = {};
    const lines = value.split('\n');
    
    for (const line of lines) {
      // Only process non-empty lines for env vars
      if (line.trim()) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    
    handleServerChange('env', env);
  };

  const getArgsText = () => {
    if (!editingServer || !editingServer.args) return '';
    return editingServer.args.join('\n');
  };

  const getEnvText = () => {
    if (!editingServer || !editingServer.env) return '';
    return Object.entries(editingServer.env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
  };

  return (
    <>
      <div class="modal-backdrop" onClick={handleCancel} />
      <div class="modal mcp-settings-modal">
        <h2>MCP Server Settings</h2>

        <div class="mcp-settings-content">
          <div class="mcp-servers-list">
            <div class="mcp-servers-header">
              <h3>Servers</h3>
              <div class="mcp-servers-actions">
                <button onClick={handleAddServer} class="mcp-add-button" title="Add Server">
                  +
                </button>
                <button 
                  onClick={handleRemoveServer} 
                  class="mcp-remove-button" 
                  title="Remove Server"
                  disabled={!selectedServerId}
                >
                  −
                </button>
              </div>
            </div>
            
            <div class="mcp-servers-items">
              {servers.map(server => (
                <div
                  key={server.id}
                  class={`mcp-server-item ${server.id === selectedServerId ? 'selected' : ''}`}
                  onClick={() => setSelectedServerId(server.id)}
                >
                  {server.name || 'Unnamed Server'}
                </div>
              ))}
              
              {servers.length === 0 && (
                <div class="mcp-servers-empty">
                  No servers configured
                </div>
              )}
            </div>
          </div>

          <div class="mcp-server-details">
            {editingServer ? (
              <>
                <div class="form-group">
                  <label>Server ID:</label>
                  <input
                    type="text"
                    value={editingServer.id}
                    onInput={(e) => {
                      const newId = e.currentTarget.value;
                      setEditingServer({ ...editingServer, id: newId });
                      setServers(servers.map(s => 
                        s.id === selectedServerId 
                          ? { ...s, id: newId }
                          : s
                      ));
                      setSelectedServerId(newId);
                    }}
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellcheck={false}
                  />
                </div>

                <div class="form-group">
                  <label>Name:</label>
                  <input
                    type="text"
                    value={editingServer.name}
                    onInput={(e) => handleServerChange('name', e.currentTarget.value)}
                  />
                </div>

                <div class="form-group">
                  <label>Description:</label>
                  <input
                    type="text"
                    value={editingServer.description}
                    onInput={(e) => handleServerChange('description', e.currentTarget.value)}
                  />
                </div>

                <div class="form-group">
                  <label>Command:</label>
                  <input
                    type="text"
                    value={editingServer.command}
                    onInput={(e) => handleServerChange('command', e.currentTarget.value)}
                    placeholder="e.g., npx, python, node"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellcheck={false}
                  />
                </div>

                <div class="form-group">
                  <label>Arguments (one per line):</label>
                  <textarea
                    value={getArgsText()}
                    onInput={(e) => handleArgsChange(e.currentTarget.value)}
                    rows={3}
                    placeholder="e.g., @modelcontextprotocol/server-github"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellcheck={false}
                  />
                </div>

                <div class="form-group">
                  <label>Environment Variables (KEY=value format):</label>
                  <textarea
                    value={getEnvText()}
                    onInput={(e) => handleEnvChange(e.currentTarget.value)}
                    rows={3}
                    placeholder="e.g., GITHUB_TOKEN=your-token"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellcheck={false}
                  />
                </div>

                <div class="form-group">
                  <label>Transport:</label>
                  <input
                    type="text"
                    value="stdio"
                    disabled
                    style={{ opacity: 0.6 }}
                  />
                </div>
              </>
            ) : (
              <div class="mcp-server-empty">
                {servers.length === 0 
                  ? 'Click + to add a server'
                  : 'Select a server to edit'
                }
              </div>
            )}
          </div>
        </div>

        {error && (
          <div class="mcp-settings-error">
            {error}
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

      <style>{`
        .mcp-settings-modal {
          width: 800px;
          max-width: 90vw;
        }

        .mcp-settings-content {
          display: flex;
          gap: 1.5rem;
          min-height: 400px;
          margin-bottom: 1.5rem;
        }

        .mcp-servers-list {
          width: 250px;
          border: 1px solid #e0e0e0;
          border-radius: 0.375rem;
          display: flex;
          flex-direction: column;
        }

        .mcp-servers-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e0e0e0;
          background: #f8f9fa;
        }

        .mcp-servers-header h3 {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: #333;
        }

        .mcp-servers-actions {
          display: flex;
          gap: 0.25rem;
        }

        .mcp-add-button,
        .mcp-remove-button {
          width: 24px;
          height: 24px;
          border: 1px solid #e0e0e0;
          background: white;
          border-radius: 0.25rem;
          cursor: pointer;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          padding: 0;
        }

        .mcp-add-button:hover,
        .mcp-remove-button:hover:not(:disabled) {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .mcp-remove-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mcp-servers-items {
          flex: 1;
          overflow-y: auto;
        }

        .mcp-server-item {
          padding: 0.75rem 1rem;
          cursor: pointer;
          border-bottom: 1px solid #f0f0f0;
          transition: background-color 0.2s;
          font-size: 0.875rem;
        }

        .mcp-server-item:hover {
          background: #f8f9fa;
        }

        .mcp-server-item.selected {
          background: #e3f2fd;
          color: #0277bd;
          font-weight: 500;
        }

        .mcp-servers-empty {
          padding: 2rem 1rem;
          text-align: center;
          color: #666;
          font-size: 0.875rem;
        }

        .mcp-server-details {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .mcp-server-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #666;
          font-size: 0.875rem;
        }

        .mcp-settings-error {
          color: #dc3545;
          font-size: 0.875rem;
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 0.375rem;
        }

        .mcp-server-details textarea {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #e0e0e0;
          border-radius: 0.375rem;
          font-family: monospace;
          font-size: 0.875rem;
          resize: vertical;
          min-height: 4rem;
          line-height: 1.4;
          white-space: pre-wrap;
        }

        @media (prefers-color-scheme: dark) {
          .mcp-servers-list {
            border-color: #555;
          }

          .mcp-servers-header {
            background: #3a3a3a;
            border-color: #555;
          }

          .mcp-servers-header h3 {
            color: #e0e0e0;
          }

          .mcp-add-button,
          .mcp-remove-button {
            background: #3a3a3a;
            border-color: #555;
            color: #e0e0e0;
          }

          .mcp-add-button:hover,
          .mcp-remove-button:hover:not(:disabled) {
            background: #007bff;
            color: white;
            border-color: #007bff;
          }

          .mcp-server-item {
            border-color: #444;
          }

          .mcp-server-item:hover {
            background: #3a3a3a;
          }

          .mcp-server-item.selected {
            background: #1e3a5f;
            color: #64b5f6;
          }

          .mcp-server-details textarea {
            background: #3a3a3a;
            border-color: #555;
            color: #e0e0e0;
          }

          .mcp-settings-error {
            background: #5a1a1a;
            color: #f8d7da;
            border-color: #721c24;
          }
        }
      `}</style>
    </>
  );
}