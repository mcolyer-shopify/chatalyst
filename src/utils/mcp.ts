import { jsonSchema } from 'ai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { TauriStdioTransport } from './TauriStdioTransport';
import type { MCPConfiguration, MCPServerConfig, MCPServerStatus, Conversation } from '../types';
import { showError, addMCPServer, updateMCPServerStatus, removeMCPServer, clearMCPServers, mcpServers } from '../store';

interface MCPConnection {
  serverId: string;
  config: MCPServerConfig;
  client: Client;
  transport: TauriStdioTransport;
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
    
    // Add server to store with starting status
    const serverStatus: MCPServerStatus = {
      id: serverId,
      name: config.name,
      description: config.description,
      status: 'starting',
      tools: []
    };
    addMCPServer(serverStatus);
    
    console.log(`MCP server ${serverId} starting...`);

    // Create MCP client and custom Tauri transport
    const transport = new TauriStdioTransport({
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      env: config.env
    });

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
    const currentServerIds = new Set(activeConnections.keys());
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
      const connection = activeConnections.get(serverId);
      const newServerConfig = newConfig[serverId];
      
      if (connection && hasServerConfigChanged(connection.config, newServerConfig)) {
        // Config changed, restart this server
        try {
          await connection.client.close();
          await connection.transport.close();
          activeConnections.delete(serverId);
          removeMCPServer(serverId);
          
          // Start with new config
          if (newServerConfig.enabled !== false) {
            await startMCPServer(serverId, newServerConfig);
          }
        } catch (error) {
          console.error(`Failed to restart MCP server ${serverId}:`, error);
        }
      }
    }
    
    // Add new servers
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
  return (
    oldConfig.name !== newConfig.name ||
    oldConfig.description !== newConfig.description ||
    oldConfig.command !== newConfig.command ||
    JSON.stringify(oldConfig.args) !== JSON.stringify(newConfig.args) ||
    JSON.stringify(oldConfig.env) !== JSON.stringify(newConfig.env) ||
    oldConfig.cwd !== newConfig.cwd ||
    oldConfig.enabled !== newConfig.enabled
  );
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
    parameters: unknown;
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
        const toolSchema = mcpTool.inputSchema || { type: 'object', properties: {} };
        
        activeTools.push({
          name: `${serverId}_${toolName}`,
          description: mcpTool.description || tool.description || `Tool ${toolName} from ${server.name}`,
          parameters: jsonSchema(toolSchema)
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