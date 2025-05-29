import { useState } from 'preact/hooks';
import { mcpServers, selectedConversation, toggleConversationTool, enableAllServerTools, disableAllServerTools, enableAllToolsOnAllServers } from '../store';
import type { MCPServerStatus } from '../types';
import './MCPSidebar.css';

interface MCPSidebarProps {
  onSettingsClick?: () => void;
}

export function MCPSidebar({ onSettingsClick }: MCPSidebarProps) {
  const servers = mcpServers.value;
  const conversation = selectedConversation.value;
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());

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
    case 'unloaded':
      return '#9ca3af'; // light gray
    default:
      return '#6b7280';
    }
  };

  const getStatusTooltip = (status: MCPServerStatus['status']) => {
    switch (status) {
    case 'running':
      return 'Server is running';
    case 'starting':
      return 'Server is starting...';
    case 'error':
      return 'Server error';
    case 'stopped':
      return 'Server is stopped';
    case 'unloaded':
      return 'Server not loaded';
    default:
      return 'Unknown status';
    }
  };

  const getStatusShape = (status: MCPServerStatus['status']) => {
    // Return different SVG shapes for accessibility
    const color = getStatusColor(status);
    const size = 12;
    
    switch (status) {
    case 'running':
      // Circle for running
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" class="mcp-status-icon">
          <circle cx="6" cy="6" r="5" fill={color} />
        </svg>
      );
    case 'starting':
      // Diamond for starting
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" class="mcp-status-icon">
          <path d="M6 1 L11 6 L6 11 L1 6 Z" fill={color} />
        </svg>
      );
    case 'error':
      // Triangle for error
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" class="mcp-status-icon">
          <path d="M6 1 L11 10 L1 10 Z" fill={color} />
        </svg>
      );
    case 'stopped':
      // Square for stopped
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" class="mcp-status-icon">
          <rect x="1" y="1" width="10" height="10" fill={color} />
        </svg>
      );
    case 'unloaded':
      // Dashed circle for unloaded
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" class="mcp-status-icon">
          <circle cx="6" cy="6" r="5" fill="none" stroke={color} stroke-width="2" stroke-dasharray="2,2" />
        </svg>
      );
    default:
      // Default circle
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" class="mcp-status-icon">
          <circle cx="6" cy="6" r="5" fill={color} />
        </svg>
      );
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
  
  const handleToggleServerTools = (server: MCPServerStatus) => {
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
  
  const toggleServerExpanded = (serverId: string) => {
    const newExpanded = new Set(expandedServers);
    if (newExpanded.has(serverId)) {
      newExpanded.delete(serverId);
    } else {
      newExpanded.add(serverId);
    }
    setExpandedServers(newExpanded);
  };
  
  const isServerExpanded = (serverId: string) => expandedServers.has(serverId);
  
  const handleToggleAllTools = () => {
    if (!conversation) return;
    
    if (areAllToolsEnabled()) {
      // Disable all tools on all servers
      servers.forEach(server => {
        if (server.status === 'running') {
          disableAllServerTools(conversation.id, server.id);
        }
      });
    } else {
      // Enable all tools on all servers
      enableAllToolsOnAllServers(conversation.id);
    }
  };
  
  const hasRunningServersWithTools = () => {
    return servers.some(server => server.status === 'running' && server.tools.length > 0);
  };
  
  const areAllToolsEnabled = () => {
    if (!conversation) return false;
    
    return servers.every(server => {
      if (server.status !== 'running' || server.tools.length === 0) return true;
      
      const enabledTools = conversation.enabledTools?.[server.id] || [];
      const availableTools = server.tools.map(t => t.name);
      
      return availableTools.every(tool => enabledTools.includes(tool));
    });
  };

  return (
    <div class="mcp-sidebar">
      <div class="mcp-sidebar-header">
        <div class="mcp-sidebar-header-content">
          <h3>MCP Servers</h3>
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              class="mcp-settings-button"
              title="MCP Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          )}
        </div>
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
                    class="mcp-status-indicator" 
                    title={getStatusTooltip(server.status)}
                    aria-label={getStatusTooltip(server.status)}
                  >
                    {getStatusShape(server.status)}
                  </div>
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
                    <button
                      class="mcp-expand-button"
                      onClick={() => toggleServerExpanded(server.id)}
                      aria-expanded={isServerExpanded(server.id)}
                      aria-label={isServerExpanded(server.id) ? 'Collapse tools' : 'Expand tools'}
                    >
                      <svg 
                        class="mcp-expand-icon" 
                        width="12" 
                        height="12" 
                        viewBox="0 0 12 12"
                        style={{ transform: isServerExpanded(server.id) ? 'rotate(90deg)' : 'rotate(0)' }}
                      >
                        <path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                    <span class="mcp-tools-title">
                      Tools ({getEnabledToolCount(server.id)}/{server.tools.length})
                    </span>
                    <button 
                      class="mcp-toggle-all-button"
                      onClick={() => handleToggleServerTools(server)}
                      disabled={server.status !== 'running'}
                    >
                      {getEnabledToolCount(server.id) === 0 ? 'Enable All' : 'Disable All'}
                    </button>
                  </div>
                  {isServerExpanded(server.id) && (
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
              )}
            </div>
          ))
        )}
      </div>
      
      {conversation && hasRunningServersWithTools() && (
        <button
          onClick={handleToggleAllTools}
          class="mcp-toggle-all-tools-button"
          title={areAllToolsEnabled() ? 'Disable all tools on all servers' : 'Enable all tools on all servers'}
        >
          {areAllToolsEnabled() ? 'Disable All Tools' : 'Enable All Tools'}
        </button>
      )}
    </div>
  );
}