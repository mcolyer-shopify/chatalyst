import { mcpServers, toggleMCPTool, mcpToolSettings } from '../store';
import type { MCPServerStatus } from '../types';
import './MCPSidebar.css';

export function MCPSidebar() {
  const servers = mcpServers.value;
  const toolSettings = mcpToolSettings.value;

  const getStatusColor = (status: MCPServerStatus['status']) => {
    switch (status) {
      case 'running':
        return '#10b981'; // green
      case 'starting':
        return '#f59e0b'; // amber
      case 'error':
        return '#ef4444'; // red
      case 'stopped':
        return '#6b7280'; // gray
      default:
        return '#6b7280';
    }
  };

  const handleToolToggle = (serverId: string, toolName: string, enabled: boolean) => {
    toggleMCPTool(serverId, toolName, enabled);
  };

  const isToolEnabled = (serverId: string, toolName: string) => {
    return toolSettings[serverId]?.[toolName] !== false; // Default to enabled
  };

  return (
    <div class="mcp-sidebar">
      <div class="mcp-sidebar-header">
        <h3>MCP Servers</h3>
      </div>
      
      <div class="mcp-servers-list">
        {servers.length === 0 ? (
          <div class="mcp-empty-state">
            No MCP servers configured
          </div>
        ) : (
          servers.map(server => (
            <div key={server.id} class="mcp-server">
              <div class="mcp-server-header">
                <div class="mcp-server-info">
                  <div 
                    class="mcp-status-dot" 
                    style={{ backgroundColor: getStatusColor(server.status) }}
                    title={server.status}
                  />
                  <div class="mcp-server-details">
                    <div class="mcp-server-name">{server.name}</div>
                    {server.description && (
                      <div class="mcp-server-description">{server.description}</div>
                    )}
                    {server.error && (
                      <div class="mcp-server-error">{server.error}</div>
                    )}
                  </div>
                </div>
              </div>
              
              {server.tools.length > 0 && (
                <div class="mcp-tools-list">
                  {server.tools.map(tool => (
                    <div key={tool.name} class="mcp-tool">
                      <label class="mcp-tool-label">
                        <input
                          type="checkbox"
                          checked={isToolEnabled(server.id, tool.name)}
                          onChange={(e) => handleToolToggle(
                            server.id, 
                            tool.name, 
                            (e.target as HTMLInputElement).checked
                          )}
                          disabled={server.status !== 'running'}
                        />
                        <span class="mcp-tool-name">{tool.name}</span>
                      </label>
                      {tool.description && (
                        <div class="mcp-tool-description">{tool.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}