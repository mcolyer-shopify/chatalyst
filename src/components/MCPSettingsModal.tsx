import { useState, useEffect, useRef } from 'preact/hooks';
import type { MCPServerConfig, StdioMCPServerConfig, HttpMCPServerConfig, SSEMCPServerConfig } from '../types';
import { EnvVarsTable } from './EnvVarsTable';

type TransportType = 'stdio' | 'http' | 'sse';

interface BaseMCPServer {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface StdioMCPServer extends BaseMCPServer {
  transport: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

interface HttpMCPServer extends BaseMCPServer {
  transport: 'http';
  url: string;
  headers?: Record<string, string>;
  headersText?: string;
}

interface SSEMCPServer extends BaseMCPServer {
  transport: 'sse';
  url: string;
  headers?: Record<string, string>;
  headersText?: string;
}

type MCPServer = StdioMCPServer | HttpMCPServer | SSEMCPServer;

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
  const [isTransportDropdownOpen, setIsTransportDropdownOpen] = useState(false);
  const transportDropdownRef = useRef<HTMLDivElement>(null);

  // Parse configuration when modal is shown or when props change
  useEffect(() => {
    if (show && mcpConfiguration) {
      try {
        const parsed = JSON.parse(mcpConfiguration);
        const serverList: MCPServer[] = [];
        
        for (const [id, config] of Object.entries(parsed)) {
          const serverConfig = config as MCPServerConfig;
          
          // Handle different transport types
          if (!serverConfig.transport || serverConfig.transport === 'stdio') {
            const stdioConfig = serverConfig as StdioMCPServerConfig;
            serverList.push({
              id,
              name: stdioConfig.name || '',
              description: stdioConfig.description || '',
              command: stdioConfig.command || '',
              args: stdioConfig.args || [],
              env: stdioConfig.env || {},
              cwd: stdioConfig.cwd,
              transport: 'stdio',
              enabled: stdioConfig.enabled !== false
            });
          } else if (serverConfig.transport === 'http') {
            const httpConfig = serverConfig as HttpMCPServerConfig;
            serverList.push({
              id,
              name: httpConfig.name || '',
              description: httpConfig.description || '',
              url: httpConfig.url || '',
              headers: httpConfig.headers || {},
              transport: 'http',
              enabled: httpConfig.enabled !== false
            });
          } else if (serverConfig.transport === 'sse') {
            const sseConfig = serverConfig as SSEMCPServerConfig;
            serverList.push({
              id,
              name: sseConfig.name || '',
              description: sseConfig.description || '',
              url: sseConfig.url || '',
              headers: sseConfig.headers || {},
              transport: 'sse',
              enabled: sseConfig.enabled !== false
            });
          }
        }
        
        setServers(serverList);
        if (serverList.length > 0 && !selectedServerId) {
          setSelectedServerId(serverList[0].id);
          setEditingServer({ ...serverList[0] });
        }
      } catch {
        setError('Failed to parse configuration');
      }
    } else if (show && !mcpConfiguration) {
      // If modal is shown but no configuration exists, ensure state is clean
      setServers([]);
      setSelectedServerId(null);
      setEditingServer(null);
    }
  }, [show, mcpConfiguration]);

  // Update editing server when selection changes
  useEffect(() => {
    if (selectedServerId) {
      const server = servers.find(s => s.id === selectedServerId);
      if (server) {
        setEditingServer({ ...server });
      }
    }
  }, [selectedServerId, servers]);

  // Handle click outside for transport dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (transportDropdownRef.current && !transportDropdownRef.current.contains(event.target as Node)) {
        setIsTransportDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!show) return null;

  const handleAddServer = () => {
    const newId = `server-${Date.now()}`;
    const newServer: StdioMCPServer = {
      id: newId,
      name: 'New Server',
      description: 'Server description',
      command: '',
      args: [],
      env: {},
      transport: 'stdio',
      enabled: true
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

  const handleServerChange = (field: string, value: unknown) => {
    if (!editingServer) return;
    
    const updated = { ...editingServer, [field]: value } as MCPServer;
    setEditingServer(updated);
    
    // Update in servers list
    setServers(servers.map(s => 
      s.id === editingServer.id ? updated : s
    ));
  };

  const handleTransportChange = (newTransport: TransportType) => {
    if (!editingServer) return;
    
    let newServer: MCPServer;
    
    if (newTransport === 'stdio') {
      newServer = {
        id: editingServer.id,
        name: editingServer.name,
        description: editingServer.description,
        enabled: editingServer.enabled,
        transport: 'stdio',
        command: '',
        args: [],
        env: {}
      };
    } else if (newTransport === 'http') {
      newServer = {
        id: editingServer.id,
        name: editingServer.name,
        description: editingServer.description,
        enabled: editingServer.enabled,
        transport: 'http',
        url: '',
        headers: {},
        headersText: ''
      };
    } else if (newTransport === 'sse') {
      newServer = {
        id: editingServer.id,
        name: editingServer.name,
        description: editingServer.description,
        enabled: editingServer.enabled,
        transport: 'sse',
        url: '',
        headers: {},
        headersText: ''
      };
    }
    
    setEditingServer(newServer);
    setServers(servers.map(s => s.id === editingServer.id ? newServer : s));
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
      
      // Transport-specific validation
      if (server.transport === 'stdio') {
        if (!server.command.trim()) {
          setError(`Server "${server.id}" must have a command`);
          return;
        }
      } else if (server.transport === 'http' || server.transport === 'sse') {
        if (!server.url.trim()) {
          setError(`Server "${server.id}" must have a URL`);
          return;
        }
        try {
          new globalThis.URL(server.url);
        } catch {
          setError(`Server "${server.id}" has an invalid URL`);
          return;
        }
      }
    }

    // Convert to JSON format
    const config: Record<string, MCPServerConfig> = {};
    for (const server of servers) {
      if (server.transport === 'stdio') {
        const stdioServer = server as StdioMCPServer;
        const stdioConfig: StdioMCPServerConfig = {
          name: stdioServer.name,
          description: stdioServer.description,
          transport: 'stdio',
          command: stdioServer.command,
          enabled: stdioServer.enabled
        };
        
        if (stdioServer.args && stdioServer.args.length > 0) {
          const filteredArgs = stdioServer.args.filter(arg => arg.trim());
          if (filteredArgs.length > 0) {
            stdioConfig.args = filteredArgs;
          }
        }
        
        if (stdioServer.env && Object.keys(stdioServer.env).length > 0) {
          stdioConfig.env = stdioServer.env;
        }
        
        if (stdioServer.cwd) {
          stdioConfig.cwd = stdioServer.cwd;
        }
        
        config[server.id] = stdioConfig;
      } else if (server.transport === 'http') {
        const httpServer = server as HttpMCPServer;
        const httpConfig: HttpMCPServerConfig = {
          name: httpServer.name,
          description: httpServer.description,
          transport: 'http',
          url: httpServer.url,
          enabled: httpServer.enabled
        };
        
        if (httpServer.headers && Object.keys(httpServer.headers).length > 0) {
          httpConfig.headers = httpServer.headers;
        }
        
        config[server.id] = httpConfig;
      } else if (server.transport === 'sse') {
        const sseServer = server as SSEMCPServer;
        const sseConfig: SSEMCPServerConfig = {
          name: sseServer.name,
          description: sseServer.description,
          transport: 'sse',
          url: sseServer.url,
          enabled: sseServer.enabled
        };
        
        if (sseServer.headers && Object.keys(sseServer.headers).length > 0) {
          sseConfig.headers = sseServer.headers;
        }
        
        config[server.id] = sseConfig;
      }
    }
    
    onSave(JSON.stringify(config, null, 2));
  };

  const handleCancel = () => {
    setError(null);
    onCancel();
  };

  const handleArgsChange = (value: string) => {
    if (!editingServer) return;
    
    // Split by newlines but preserve empty lines for proper textarea behavior
    const args = value.split('\n');
    handleServerChange('args', args);
  };

  const getArgsText = () => {
    if (!editingServer || editingServer.transport !== 'stdio' || !editingServer.args) return '';
    return editingServer.args.join('\n');
  };

  const getHeadersText = () => {
    if (!editingServer || (editingServer.transport !== 'http' && editingServer.transport !== 'sse')) return '';
    
    // If we have raw headers text, use that; otherwise convert from headers object
    if (editingServer.headersText !== undefined) {
      return editingServer.headersText;
    }
    
    if (!editingServer.headers) return '';
    return Object.entries(editingServer.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  };

  const handleHeadersChange = (value: string) => {
    if (!editingServer || (editingServer.transport !== 'http' && editingServer.transport !== 'sse')) return;
    
    // Store the raw text for immediate display
    const updatedServer = { ...editingServer, headersText: value };
    setEditingServer(updatedServer);
    
    // Parse only complete key-value pairs for the headers object
    const headers: Record<string, string> = {};
    const lines = value.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const headerValue = line.substring(colonIndex + 1).trim();
          if (key) {
            headers[key] = headerValue;
          }
        }
      }
    }
    
    // Update the server in the list with both raw text and parsed headers
    setServers(servers.map(s => 
      s.id === editingServer.id 
        ? { ...s, headersText: value, headers }
        : s
    ));
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
                >
                  <input
                    type="checkbox"
                    checked={server.enabled}
                    onChange={(e) => {
                      const updatedServer = { ...server, enabled: e.currentTarget.checked };
                      setServers(servers.map(s => s.id === server.id ? updatedServer : s));
                      if (editingServer && editingServer.id === server.id) {
                        setEditingServer(updatedServer);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span
                    class="server-name"
                    onClick={() => setSelectedServerId(server.id)}
                  >
                    {server.name || 'Unnamed Server'}
                  </span>
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
                  <label>Transport:</label>
                  <div class="transport-dropdown" ref={transportDropdownRef}>
                    <button
                      type="button"
                      class="transport-dropdown-button"
                      onClick={() => setIsTransportDropdownOpen(!isTransportDropdownOpen)}
                    >
                      <span class="transport-dropdown-text">
                        {editingServer.transport === 'stdio' && 'Local Process (stdio)'}
                        {editingServer.transport === 'http' && 'Remote HTTP'}
                        {editingServer.transport === 'sse' && 'Remote SSE'}
                      </span>
                      <span class="transport-dropdown-arrow">▼</span>
                    </button>
                    
                    {isTransportDropdownOpen && (
                      <div class="transport-dropdown-menu">
                        <button
                          type="button"
                          class={`transport-dropdown-option ${editingServer.transport === 'stdio' ? 'selected' : ''}`}
                          onClick={() => {
                            handleTransportChange('stdio');
                            setIsTransportDropdownOpen(false);
                          }}
                        >
                          <div class="transport-option-name">Local Process (stdio)</div>
                          <div class="transport-option-description">Run MCP servers as local processes</div>
                        </button>
                        <button
                          type="button"
                          class={`transport-dropdown-option ${editingServer.transport === 'http' ? 'selected' : ''}`}
                          onClick={() => {
                            handleTransportChange('http');
                            setIsTransportDropdownOpen(false);
                          }}
                        >
                          <div class="transport-option-name">Remote HTTP</div>
                          <div class="transport-option-description">Connect to remote HTTP servers (Streamable HTTP)</div>
                        </button>
                        <button
                          type="button"
                          class={`transport-dropdown-option ${editingServer.transport === 'sse' ? 'selected' : ''}`}
                          onClick={() => {
                            handleTransportChange('sse');
                            setIsTransportDropdownOpen(false);
                          }}
                        >
                          <div class="transport-option-name">Remote SSE</div>
                          <div class="transport-option-description">Connect to remote Server-Sent Events servers</div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stdio-specific fields */}
                {editingServer.transport === 'stdio' && (
                  <>
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
                      <label>Working Directory (optional):</label>
                      <input
                        type="text"
                        value={editingServer.cwd || ''}
                        onInput={(e) => handleServerChange('cwd', e.currentTarget.value || undefined)}
                        placeholder="e.g., /path/to/project"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellcheck={false}
                      />
                    </div>

                    <div class="form-group">
                      <label>Environment Variables:</label>
                      <EnvVarsTable
                        env={editingServer.env || {}}
                        onChange={env => handleServerChange('env', env)}
                      />
                    </div>
                  </>
                )}

                {/* HTTP-specific fields */}
                {editingServer.transport === 'http' && (
                  <>
                    <div class="form-group">
                      <label>URL:</label>
                      <input
                        type="text"
                        value={editingServer.url}
                        onInput={(e) => handleServerChange('url', e.currentTarget.value)}
                        placeholder="e.g., https://api.example.com/mcp"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellcheck={false}
                      />
                      <small>Uses Streamable HTTP transport for bidirectional communication.</small>
                    </div>

                    <div class="form-group">
                      <label>Headers (Key: Value format):</label>
                      <textarea
                        value={getHeadersText()}
                        onInput={(e) => handleHeadersChange(e.currentTarget.value)}
                        rows={3}
                        placeholder="e.g., Authorization: Bearer token"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellcheck={false}
                      />
                    </div>
                  </>
                )}

                {/* SSE-specific fields */}
                {editingServer.transport === 'sse' && (
                  <>
                    <div class="form-group">
                      <label>URL:</label>
                      <input
                        type="text"
                        value={editingServer.url}
                        onInput={(e) => handleServerChange('url', e.currentTarget.value)}
                        placeholder="e.g., https://api.githubcopilot.com/mcp/"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellcheck={false}
                      />
                      <small>Uses Server-Sent Events for receiving responses. Best for servers that only support SSE.</small>
                    </div>

                    <div class="form-group">
                      <label>Headers (Key: Value format):</label>
                      <textarea
                        value={getHeadersText()}
                        onInput={(e) => handleHeadersChange(e.currentTarget.value)}
                        rows={3}
                        placeholder="e.g., Authorization: Bearer token"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellcheck={false}
                      />
                    </div>
                  </>
                )}


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
          width: 220px;
          border: 1px solid #e0e0e0;
          border-radius: 0.375rem;
          display: flex;
          flex-direction: column;
        }

        .mcp-servers-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
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
          padding: 0.75rem;
          border-bottom: 1px solid #f0f0f0;
          transition: background-color 0.2s;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .mcp-server-item input[type="checkbox"] {
          margin: 0;
          flex-shrink: 0;
        }

        .mcp-server-item .server-name {
          cursor: pointer;
          flex: 1;
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

        .mcp-server-details small {
          color: #666;
          font-size: 0.75rem;
          margin-top: 0.25rem;
          display: block;
        }

        /* Transport Dropdown Styles */
        .transport-dropdown {
          position: relative;
          width: 100%;
        }

        .transport-dropdown-button {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #e0e0e0;
          border-radius: 0.375rem;
          background: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s;
          text-align: left;
        }

        .transport-dropdown-button:hover {
          border-color: #007bff;
          background: #f8f9fa;
        }

        .transport-dropdown-button:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }

        .transport-dropdown-text {
          flex: 1;
          color: #333;
        }

        .transport-dropdown-arrow {
          margin-left: 0.5rem;
          font-size: 0.625rem;
          color: #666;
          transition: transform 0.2s;
        }

        .transport-dropdown-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 0.375rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          overflow: hidden;
        }

        .transport-dropdown-option {
          width: 100%;
          padding: 0.75rem;
          border: none;
          background: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.2s;
          border-bottom: 1px solid #f0f0f0;
        }

        .transport-dropdown-option:last-child {
          border-bottom: none;
        }

        .transport-dropdown-option:hover {
          background: #f8f9fa;
        }

        .transport-dropdown-option.selected {
          background: #e3f2fd;
        }

        .transport-option-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: #333;
          margin-bottom: 0.25rem;
        }

        .transport-option-description {
          font-size: 0.75rem;
          color: #666;
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

          .mcp-server-item .server-name {
            color: #e0e0e0;
          }

          /* Dark mode transport dropdown styles */
          .transport-dropdown-button {
            background: #3a3a3a;
            border-color: #555;
            color: #e0e0e0;
          }

          .transport-dropdown-button:hover {
            background: #444;
            border-color: #007bff;
          }

          .transport-dropdown-text {
            color: #e0e0e0;
          }

          .transport-dropdown-arrow {
            color: #999;
          }

          .transport-dropdown-menu {
            background: #3a3a3a;
            border-color: #555;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          }

          .transport-dropdown-option {
            border-color: #444;
          }

          .transport-dropdown-option:hover {
            background: #444;
          }

          .transport-dropdown-option.selected {
            background: #1e3a5f;
          }

          .transport-option-name {
            color: #e0e0e0;
          }

          .transport-option-description {
            color: #999;
          }
        }
      `}</style>
    </>
  );
}