import { jsonSchema } from 'ai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { TauriStdioTransport } from './TauriStdioTransport';
import { RemoteHttpTransport } from './RemoteHttpTransport';
import { RemoteWebSocketTransport } from './RemoteWebSocketTransport';
import type { MCPConfiguration, MCPServerConfig, MCPServerStatus, Conversation, StdioMCPServerConfig, HttpMCPServerConfig, WebSocketMCPServerConfig } from '../types';
import { showError, addMCPServer, updateMCPServerStatus, removeMCPServer, clearMCPServers, mcpServers } from '../store';

interface MCPConnection {
  serverId: string;
  config: MCPServerConfig;
  client: Client;
  transport: Transport;
}

// Store active MCP connections
const activeConnections = new Map<string, MCPConnection>();

/**
 * Initialize MCP connections based on configuration
 */
export async function initializeMCPConnections(configString: string | undefined) {
  if (!configString?.trim()) {
    return;
  }

  try {
    const config: MCPConfiguration = JSON.parse(configString);
    
    // First, add all configured servers in unloaded state
    for (const [serverId, serverConfig] of Object.entries(config)) {
      const serverStatus: MCPServerStatus = {
        id: serverId,
        name: serverConfig.name,
        description: serverConfig.description,
        status: 'unloaded',
        tools: []
      };
      addMCPServer(serverStatus);
    }
    
    // Then start enabled servers
    for (const [serverId, serverConfig] of Object.entries(config)) {
      if (serverConfig.enabled !== false) {
        await startMCPServer(serverId, serverConfig);
      }
    }
  } catch (error) {
    showError(`Failed to initialize MCP connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Start a single MCP server
 */
async function startMCPServer(serverId: string, config: MCPServerConfig) {
  try {
    // Check if already running
    if (activeConnections.has(serverId)) {
      console.log(`MCP server ${serverId} is already running`);
      return;
    }

    console.log(`Starting MCP server: ${serverId}`);
    
    // Update server status to starting
    updateMCPServerStatus(serverId, { status: 'starting' });
    
    console.log(`MCP server ${serverId} starting...`);

    // Create appropriate transport based on config type
    let transport: Transport;
    
    if (!config.transport || config.transport === 'stdio') {
      const stdioConfig = config as StdioMCPServerConfig;
      transport = new TauriStdioTransport({
        command: stdioConfig.command,
        args: stdioConfig.args,
        cwd: stdioConfig.cwd,
        env: stdioConfig.env
      });
    } else if (config.transport === 'http') {
      const httpConfig = config as HttpMCPServerConfig;
      transport = new RemoteHttpTransport({
        url: httpConfig.url,
        headers: httpConfig.headers,
        timeout: httpConfig.timeout
      });
    } else if (config.transport === 'websocket') {
      const wsConfig = config as WebSocketMCPServerConfig;
      transport = new RemoteWebSocketTransport({
        url: wsConfig.url,
        headers: wsConfig.headers,
        reconnectAttempts: wsConfig.reconnectAttempts,
        reconnectDelay: wsConfig.reconnectDelay
      });
    } else {
      throw new Error(`Unsupported transport type: ${(config as { transport?: string }).transport}`);
    }

    const client = new Client({
      name: 'chatalyst',
      version: '0.1.0'
    }, {
      capabilities: {}
    });

    // Start the transport first
    await transport.start();
    console.log(`MCP transport started for ${serverId}`);

    // Connect the client to the transport
    await client.connect(transport);
    console.log(`MCP client connected for ${serverId}`);

    // List available tools
    const toolsResponse = await client.listTools();
    console.log(`MCP server ${serverId} tools:`, toolsResponse.tools);

    // Convert MCP tools to our format
    const tools = toolsResponse.tools.map(mcpTool => ({
      name: mcpTool.name,
      description: mcpTool.description,
      enabled: false // Default to disabled
    }));

    // Store the connection with client
    activeConnections.set(serverId, {
      serverId,
      config,
      client,
      transport
    });

    console.log(`MCP server ${serverId} started successfully with ${tools.length} tools`);
    
    // Update server status to running with discovered tools
    updateMCPServerStatus(serverId, { 
      status: 'running',
      tools
    });
  } catch (error) {
    console.error(`Failed to start MCP server ${serverId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    updateMCPServerStatus(serverId, { 
      status: 'error',
      error: errorMessage
    });
    showError(`Failed to start MCP server ${serverId}: ${errorMessage}`);
  }
}


/**
 * Shutdown all MCP connections
 */
export async function shutdownMCPConnections() {
  console.log('Shutting down all MCP connections...');
  
  for (const [serverId, connection] of activeConnections.entries()) {
    try {
      console.log(`Shutting down MCP server: ${serverId}`);
      
      // Close MCP client connection
      await connection.client.close();
      await connection.transport.close();
      
      activeConnections.delete(serverId);
      removeMCPServer(serverId);
    } catch (error) {
      console.error(`Failed to shutdown MCP server ${serverId}:`, error);
    }
  }
}

/**
 * Restart MCP connections with new configuration
 */
export async function restartMCPConnections(newConfigString: string | undefined) {
  if (!newConfigString?.trim()) {
    // If new config is empty, just shutdown all connections
    await shutdownMCPConnections();
    clearMCPServers();
    return;
  }

  try {
    const newConfig: MCPConfiguration = JSON.parse(newConfigString);
    const currentServerIds = new Set(mcpServers.value.map(s => s.id));
    const newServerIds = new Set(Object.keys(newConfig));
    
    // Find servers to remove (in current but not in new)
    const serversToRemove = Array.from(currentServerIds).filter(id => !newServerIds.has(id));
    
    // Find servers to add (in new but not in current)
    const serversToAdd = Array.from(newServerIds).filter(id => !currentServerIds.has(id));
    
    // Find servers that might need updating (in both)
    const serversToCheck = Array.from(newServerIds).filter(id => currentServerIds.has(id));
    
    // Remove servers that are no longer in config
    for (const serverId of serversToRemove) {
      const connection = activeConnections.get(serverId);
      if (connection) {
        try {
          await connection.client.close();
          await connection.transport.close();
          activeConnections.delete(serverId);
          removeMCPServer(serverId);
        } catch (error) {
          console.error(`Failed to shutdown MCP server ${serverId}:`, error);
        }
      }
    }
    
    // Check if existing servers need to be restarted due to config changes
    for (const serverId of serversToCheck) {
      const newServerConfig = newConfig[serverId];
      const connection = activeConnections.get(serverId);
      const shouldBeRunning = newServerConfig.enabled !== false;
      const isCurrentlyRunning = !!connection;
      
      if (isCurrentlyRunning && !shouldBeRunning) {
        // Stop server that should be disabled
        try {
          await connection.client.close();
          await connection.transport.close();
          activeConnections.delete(serverId);
          
          // Update server status to unloaded
          updateMCPServerStatus(serverId, { 
            status: 'unloaded',
            tools: []
          });
        } catch (error) {
          console.error(`Failed to stop MCP server ${serverId}:`, error);
        }
      } else if (isCurrentlyRunning && shouldBeRunning && hasServerConfigChanged(connection.config, newServerConfig)) {
        // Restart server with changed config
        try {
          await connection.client.close();
          await connection.transport.close();
          activeConnections.delete(serverId);
          
          // Update server status to unloaded, then start with new config
          updateMCPServerStatus(serverId, { 
            status: 'unloaded',
            tools: []
          });
          
          await startMCPServer(serverId, newServerConfig);
        } catch (error) {
          console.error(`Failed to restart MCP server ${serverId}:`, error);
        }
      } else if (!isCurrentlyRunning && shouldBeRunning) {
        // Start server that should be enabled
        await startMCPServer(serverId, newServerConfig);
      }
    }
    
    // Add new servers in unloaded state first
    for (const serverId of serversToAdd) {
      const serverConfig = newConfig[serverId];
      const serverStatus: MCPServerStatus = {
        id: serverId,
        name: serverConfig.name,
        description: serverConfig.description,
        status: 'unloaded',
        tools: []
      };
      addMCPServer(serverStatus);
    }
    
    // Then start enabled new servers
    for (const serverId of serversToAdd) {
      const serverConfig = newConfig[serverId];
      if (serverConfig.enabled !== false) {
        await startMCPServer(serverId, serverConfig);
      }
    }
  } catch (error) {
    console.error('Failed to restart MCP connections:', error);
    // On error, do a full restart
    await shutdownMCPConnections();
    clearMCPServers();
    await initializeMCPConnections(newConfigString);
  }
}

/**
 * Check if server configuration has changed
 */
function hasServerConfigChanged(oldConfig: MCPServerConfig, newConfig: MCPServerConfig): boolean {
  // Basic fields that all configs have
  if (oldConfig.name !== newConfig.name ||
      oldConfig.description !== newConfig.description ||
      oldConfig.enabled !== newConfig.enabled ||
      oldConfig.transport !== newConfig.transport) {
    return true;
  }
  
  // Transport-specific field comparisons
  if (oldConfig.transport === 'stdio' && newConfig.transport === 'stdio') {
    const oldStdio = oldConfig as StdioMCPServerConfig;
    const newStdio = newConfig as StdioMCPServerConfig;
    return (
      oldStdio.command !== newStdio.command ||
      JSON.stringify(oldStdio.args) !== JSON.stringify(newStdio.args) ||
      JSON.stringify(oldStdio.env) !== JSON.stringify(newStdio.env) ||
      oldStdio.cwd !== newStdio.cwd
    );
  } else if (oldConfig.transport === 'http' && newConfig.transport === 'http') {
    const oldHttp = oldConfig as HttpMCPServerConfig;
    const newHttp = newConfig as HttpMCPServerConfig;
    return (
      oldHttp.url !== newHttp.url ||
      JSON.stringify(oldHttp.headers) !== JSON.stringify(newHttp.headers) ||
      oldHttp.timeout !== newHttp.timeout
    );
  } else if (oldConfig.transport === 'websocket' && newConfig.transport === 'websocket') {
    const oldWs = oldConfig as WebSocketMCPServerConfig;
    const newWs = newConfig as WebSocketMCPServerConfig;
    return (
      oldWs.url !== newWs.url ||
      JSON.stringify(oldWs.headers) !== JSON.stringify(newWs.headers) ||
      oldWs.reconnectAttempts !== newWs.reconnectAttempts ||
      oldWs.reconnectDelay !== newWs.reconnectDelay
    );
  }
  
  // Different transport types means config has changed
  return true;
}


/**
 * Get active tools for a conversation
 */
export async function getActiveToolsForConversation(conversation: Conversation | null) {
  if (!conversation || !conversation.enabledTools) {
    console.log('[MCP] No conversation or enabledTools');
    return [];
  }

  console.log('[MCP] Getting active tools for conversation:', conversation.id);
  console.log('[MCP] Enabled tools:', conversation.enabledTools);

  const activeTools: Array<{
    name: string;
    description?: string;
    parameters: ReturnType<typeof jsonSchema>;
  }> = [];
  const servers = mcpServers.value;
  console.log('[MCP] Available servers:', servers.map(s => ({ id: s.id, status: s.status })));

  for (const [serverId, enabledToolNames] of Object.entries(conversation.enabledTools)) {
    if (!enabledToolNames || enabledToolNames.length === 0) {
      console.log(`[MCP] No enabled tools for server ${serverId}`);
      continue;
    }

    console.log(`[MCP] Server ${serverId} has ${enabledToolNames.length} enabled tools:`, enabledToolNames);

    const server = servers.find(s => s.id === serverId);
    if (!server) {
      console.log(`[MCP] Server ${serverId} not found`);
      continue;
    }
    if (server.status !== 'running') {
      console.log(`[MCP] Server ${serverId} is not running (status: ${server.status})`);
      continue;
    }

    // Get the MCP connection
    const connection = activeConnections.get(serverId);
    if (!connection) {
      console.log(`[MCP] No active connection for server ${serverId}`);
      continue;
    }

    // For each enabled tool, create a tool definition with real schema
    for (const toolName of enabledToolNames) {
      const tool = server.tools.find(t => t.name === toolName);
      if (!tool) {
        console.log(`[MCP] Tool ${toolName} not found in server ${serverId}`);
        continue;
      }
      
      console.log(`[MCP] Getting schema for tool: ${toolName}`);
      
      try {
        // Get the tool info from MCP server
        const toolsResponse = await connection.client.listTools();
        const mcpTool = toolsResponse.tools.find(t => t.name === toolName);
        
        if (!mcpTool) {
          console.log(`[MCP] Tool ${toolName} not found in MCP server response`);
          continue;
        }
        
        console.log(`[MCP] Tool ${toolName} schema:`, mcpTool.inputSchema);
        
        // Create a tool definition that the AI SDK can use with JSON schema
        const toolSchema = mcpTool.inputSchema;
        
        activeTools.push({
          name: `${serverId}_${toolName}`,
          description: mcpTool.description || tool.description || `Tool ${toolName} from ${server.name}`,
          parameters: jsonSchema(toolSchema as import('json-schema').JSONSchema7)
        });
        
        console.log(`[MCP] Added tool: ${serverId}_${toolName}`);
      } catch (error) {
        console.error(`[MCP] Failed to get schema for tool ${toolName}:`, error);
      }
    }
  }

  console.log(`[MCP] Total active tools: ${activeTools.length}`);
  return activeTools;
}

/**
 * Execute an MCP tool
 */
export async function executeMCPTool(toolName: string, args: unknown) {
  console.log(`[MCP] Executing tool ${toolName} with args:`, args);
  
  // Parse the tool name to get serverId and actual tool name
  const parts = toolName.split('_');
  const serverId = parts[0];
  const actualToolName = parts.slice(1).join('_');
  
  const connection = activeConnections.get(serverId);
  if (!connection) {
    throw new Error(`No active connection for server ${serverId}`);
  }
  
  try {
    // Call the tool through MCP
    const result = await connection.client.callTool({
      name: actualToolName,
      arguments: args as Record<string, unknown>
    });
    
    console.log(`[MCP] Tool ${toolName} result:`, result);
    
    // Type guard to check if result has content property
    if (result && typeof result === 'object' && 'content' in result) {
      const contentResult = result as { content: Array<{ type: string; text?: string }> };
      
      if (Array.isArray(contentResult.content) && contentResult.content.length > 0) {
        // MCP returns content as an array, we'll join text content
        const textContent = contentResult.content
          .filter((c): c is { type: string; text: string } => c.type === 'text' && typeof c.text === 'string')
          .map(c => c.text)
          .join('\n');
        return textContent || contentResult.content;
      }
    }
    
    return result;
  } catch (error) {
    console.error(`[MCP] Failed to execute tool ${toolName}:`, error);
    throw error;
  }
}
