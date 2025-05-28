import { mcpServers, selectedConversation, toggleConversationTool, enableAllServerTools, disableAllServerTools } from '../store';
import type { MCPServerStatus } from '../types';
import './MCPSidebar.css';

export function MCPSidebar() {
  const servers = mcpServers.value;
  const conversation = selectedConversation.value;

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
    if (!conversation) return;
    toggleConversationTool(conversation.id, serverId, toolName, enabled);
  };

  const isToolEnabled = (serverId: string, toolName: string) => {
    if (!conversation) return false;
    const enabledTools = conversation.enabledTools?.[serverId] || [];
    return enabledTools.includes(toolName);
  };
  
  const getEnabledToolCount = (serverId: string): number => {
    if (!conversation) return 0;
    return conversation.enabledTools?.[serverId]?.length || 0;
  };
  
  const handleToggleAllTools = (server: MCPServerStatus) => {
    if (!conversation) return;
    
    const enabledCount = getEnabledToolCount(server.id);
    const availableTools = server.tools.map(t => t.name);
    
    if (enabledCount === 0) {
      // Enable all tools
      enableAllServerTools(conversation.id, server.id, availableTools);
    } else {
      // Disable all tools
      disableAllServerTools(conversation.id, server.id);
    }
  };

  return (
    <div class="mcp-sidebar">
      <div class="mcp-sidebar-header">
        <h3>MCP Servers</h3>
      </div>
      
      <div class="mcp-servers-list">
        {!conversation ? (
          <div class="mcp-empty-state">
            Select a conversation to manage tools
          </div>
        ) : servers.length === 0 ? (
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
                <div class="mcp-tools-section">
                  <div class="mcp-tools-header">
                    <span class="mcp-tools-title">
                      Tools ({getEnabledToolCount(server.id)}/{server.tools.length})
                    </span>
                    <button 
                      class="mcp-toggle-all-button"
                      onClick={() => handleToggleAllTools(server)}
                      disabled={server.status !== 'running'}
                    >
                      {getEnabledToolCount(server.id) === 0 ? 'Enable All' : 'Disable All'}
                    </button>
                  </div>
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
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}