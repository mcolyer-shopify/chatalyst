import { jsonSchema } from 'ai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { TauriStdioTransport } from './TauriStdioTransport';
import { TauriStreamableHttpTransport } from './TauriStreamableHttpTransport';
import { TauriSSETransport } from './TauriSSETransport';
import { TauriPollingTransport } from './TauriPollingTransport';
import { TauriGitHubTransport } from './TauriGitHubTransport';
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
 * Check if an error is a connection-related error
 */
function isConnectionError(error: unknown): boolean {
  if (!error) return false;
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();
  
  // Check for common connection error patterns
  return (
    lowerMessage.includes('connection closed') ||
    lowerMessage.includes('connection lost') ||
    lowerMessage.includes('connection refused') ||
    lowerMessage.includes('network error') ||
    lowerMessage.includes('econnreset') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('disconnected') ||
    // JSON-RPC specific error codes
    errorMessage.includes('-32000') || // Connection closed
    errorMessage.includes('-32001') || // Server error
    errorMessage.includes('-32700')    // Parse error (could indicate connection issues)
  );
}

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
    
    // Then start enabled servers (continue even if some fail)
    const startPromises: Promise<void>[] = [];
    for (const [serverId, serverConfig] of Object.entries(config)) {
      if (serverConfig.enabled !== false) {
        // Start servers in parallel but catch individual failures
        startPromises.push(
          startMCPServer(serverId, serverConfig).catch(error => {
            console.error(`[MCP] Failed to start server ${serverId} during initialization:`, error);
            // Individual server failures are already handled in startMCPServer
          })
        );
      }
    }
    
    // Wait for all servers to attempt startup
    await Promise.allSettled(startPromises);
    
    const runningServers = Array.from(activeConnections.keys());
    const totalServers = Object.keys(config).filter(id => config[id].enabled !== false).length;
    
    console.log(`[MCP] Initialization complete: ${runningServers.length}/${totalServers} servers running`);
    
    if (runningServers.length === 0 && totalServers > 0) {
      showError('Failed to start any MCP servers. Please check your configuration.');
    } else if (runningServers.length < totalServers) {
      console.log(`[MCP] Some servers failed to start, but ${runningServers.length} are running successfully`);
    }
  } catch (error) {
    console.error('Failed to parse MCP configuration:', error);
    showError(`Failed to initialize MCP connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Connect to an HTTP MCP server with automatic transport fallback
 */
async function connectWithHttpTransport(serverId: string, httpConfig: HttpMCPServerConfig): Promise<{ client: Client, transport: Transport }> {
  const baseUrl = new URL(httpConfig.url);
  
  // Check if we should use Tauri transports (for remote servers that need CORS bypass)
  const useTauriTransport = baseUrl.hostname !== 'localhost' && baseUrl.hostname !== '127.0.0.1';
  
  if (useTauriTransport) {
    console.log(`[MCP] Using Tauri transports for ${serverId} to bypass CORS`);
    console.log(`[MCP] URL: ${baseUrl.toString()}`);
    console.log(`[MCP] Headers:`, httpConfig.headers);
    
    // Check if this is the GitHub MCP server
    const isGitHubMCP = baseUrl.hostname === 'api.githubcopilot.com' || 
                        baseUrl.hostname.includes('github') || 
                        baseUrl.href.includes('githubcopilot');
    
    if (isGitHubMCP) {
      console.log(`[MCP] Detected GitHub MCP server, using TauriGitHubTransport for ${serverId}`);
      const client = new Client({
        name: 'chatalyst',
        version: '0.1.0'
      }, {
        capabilities: {}
      });
      
      const transport = new TauriGitHubTransport(baseUrl, httpConfig.headers);
      await client.connect(transport);
      console.log(`[MCP] Connected to ${serverId} using Tauri GitHub transport`);
      return { client, transport };
    }
    
    // Try Tauri streamable HTTP first for non-GitHub servers
    try {
      console.log(`[MCP] Creating MCP Client for ${serverId}`);
      const client = new Client({
        name: 'chatalyst',
        version: '0.1.0'
      }, {
        capabilities: {}
      });
      
      console.log(`[MCP] Creating TauriStreamableHttpTransport for ${serverId}`);
      const transport = new TauriStreamableHttpTransport(baseUrl, {
        requestInit: {
          headers: httpConfig.headers
        }
      });
      
      console.log(`[MCP] Calling client.connect() for ${serverId}`);
      await client.connect(transport);
      console.log(`[MCP] Connected to ${serverId} using Tauri Streamable HTTP transport`);
      return { client, transport };
    } catch (streamableError) {
      console.error(`[MCP] Tauri Streamable HTTP failed for ${serverId}:`, streamableError);
      console.log(`[MCP] Error details:`, {
        message: streamableError instanceof Error ? streamableError.message : 'Unknown error',
        stack: streamableError instanceof Error ? streamableError.stack : undefined
      });
      console.log(`[MCP] Trying Tauri SSE transport for ${serverId}`);
      
      // Create a new client for SSE attempt
      const sseClient = new Client({
        name: 'chatalyst',
        version: '0.1.0'
      }, {
        capabilities: {}
      });
      
      console.log(`[MCP] Creating TauriSSETransport for ${serverId}`);
      const sseTransport = new TauriSSETransport(baseUrl, httpConfig.headers);
      console.log(`[MCP] Calling client.connect() with SSE for ${serverId}`);
      
      try {
        await sseClient.connect(sseTransport);
        console.log(`[MCP] Connected to ${serverId} using Tauri SSE transport`);
        return { client: sseClient, transport: sseTransport };
      } catch (sseError) {
        console.error(`[MCP] Tauri SSE failed for ${serverId}:`, sseError);
        console.log(`[MCP] Trying polling transport as last resort for ${serverId}`);
        
        // Last resort: try polling transport
        const pollingClient = new Client({
          name: 'chatalyst',
          version: '0.1.0'
        }, {
          capabilities: {}
        });
        
        const pollingTransport = new TauriPollingTransport(baseUrl, httpConfig.headers);
        await pollingClient.connect(pollingTransport);
        console.log(`[MCP] Connected to ${serverId} using Tauri Polling transport`);
        return { client: pollingClient, transport: pollingTransport };
      }
    }
  } else {
    // Use standard transports for local servers
    console.log(`Using standard transports for local server ${serverId}`);
    
    // Try streamable HTTP first
    try {
      const client = new Client({
        name: 'chatalyst',
        version: '0.1.0'
      }, {
        capabilities: {}
      });
      
      const transport = new StreamableHTTPClientTransport(baseUrl, {
        requestInit: {
          headers: httpConfig.headers
        }
      });
      
      await client.connect(transport);
      console.log(`Connected to ${serverId} using Streamable HTTP transport`);
      return { client, transport };
    } catch (streamableError) {
      console.log(`Streamable HTTP failed for ${serverId}, trying SSE:`, streamableError);
      
      // Create a new client for SSE attempt
      const sseClient = new Client({
        name: 'chatalyst',
        version: '0.1.0'
      }, {
        capabilities: {}
      });
      
      const sseTransport = new SSEClientTransport(baseUrl, httpConfig.headers);
      await sseClient.connect(sseTransport);
      console.log(`Connected to ${serverId} using SSE transport`);
      return { client: sseClient, transport: sseTransport };
    }
  }
}

/**
 * Setup connection error handlers for graceful failure handling
 */
function setupConnectionErrorHandlers(serverId: string, transport: Transport) {
  // For our custom TauriStdioTransport, we can set up error handlers
  // For other transports (HTTP, WebSocket), we'll rely on client-level error handling
  if ('_command' in transport) {
    // This is our TauriStdioTransport
    const stdioTransport = transport as Transport & {
      onclose?: (reason?: unknown) => void;
      onerror?: (error: Error) => void;
    };
    
    // Handle transport close events
    if (stdioTransport.onclose !== undefined) {
      const originalOnClose = stdioTransport.onclose;
      stdioTransport.onclose = (reason?: unknown) => {
        console.log(`[MCP] Transport closed for server ${serverId}:`, reason);
        handleConnectionLoss(serverId, reason);
        if (originalOnClose) originalOnClose(reason);
      };
    } else {
      stdioTransport.onclose = (reason?: unknown) => {
        console.log(`[MCP] Transport closed for server ${serverId}:`, reason);
        handleConnectionLoss(serverId, reason);
      };
    }

    // Handle transport error events
    if (stdioTransport.onerror !== undefined) {
      const originalOnError = stdioTransport.onerror;
      stdioTransport.onerror = (error: Error) => {
        console.error(`[MCP] Transport error for server ${serverId}:`, error);
        handleConnectionError(serverId, error);
        if (originalOnError) originalOnError(error);
      };
    } else {
      stdioTransport.onerror = (error: Error) => {
        console.error(`[MCP] Transport error for server ${serverId}:`, error);
        handleConnectionError(serverId, error);
      };
    }
  }
  
  // For other transport types, connection errors will be caught at the client operation level
  console.log(`[MCP] Error handlers set up for server ${serverId}`);
}

/**
 * Handle connection loss gracefully
 */
function handleConnectionLoss(serverId: string, reason?: unknown) {
  console.log(`[MCP] Handling connection loss for server ${serverId}:`, reason);
  
  // Clean up the connection
  activeConnections.delete(serverId);
  
  // Update server status to stopped
  updateMCPServerStatus(serverId, { 
    status: 'stopped',
    error: `Connection lost: ${reason || 'Unknown reason'}`
  });
}

/**
 * Handle connection errors gracefully
 */
function handleConnectionError(serverId: string, error: Error) {
  console.error(`[MCP] Handling connection error for server ${serverId}:`, error);
  
  // Clean up the connection
  activeConnections.delete(serverId);
  
  // Update server status to error
  updateMCPServerStatus(serverId, { 
    status: 'error',
    error: error.message || 'Connection error'
  });
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

    // Create appropriate transport and client based on config type
    let transport: Transport;
    let client: Client;
    
    if (!config.transport || config.transport === 'stdio') {
      const stdioConfig = config as StdioMCPServerConfig;
      transport = new TauriStdioTransport({
        command: stdioConfig.command,
        args: stdioConfig.args,
        cwd: stdioConfig.cwd,
        env: stdioConfig.env
      });
      
      client = new Client({
        name: 'chatalyst',
        version: '0.1.0'
      }, {
        capabilities: {}
      });
      
      await client.connect(transport);
      console.log(`MCP client connected for ${serverId}`);
    } else if (config.transport === 'http') {
      console.log(`[MCP] Starting HTTP transport for ${serverId}`);
      const httpConfig = config as HttpMCPServerConfig;
      console.log(`[MCP] HTTP config:`, {
        url: httpConfig.url,
        headers: httpConfig.headers,
        enabled: httpConfig.enabled
      });
      const result = await connectWithHttpTransport(serverId, httpConfig);
      client = result.client;
      transport = result.transport;
      console.log(`[MCP] HTTP transport connected for ${serverId}`);
    } else if (config.transport === 'websocket') {
      const wsConfig = config as WebSocketMCPServerConfig;
      const wsUrl = new URL(wsConfig.url);
      
      transport = new WebSocketClientTransport(wsUrl);
      
      client = new Client({
        name: 'chatalyst',
        version: '0.1.0'
      }, {
        capabilities: {}
      });
      
      await client.connect(transport);
      console.log(`MCP client connected for ${serverId}`);
    } else {
      throw new Error(`Unsupported transport type: ${(config as { transport?: string }).transport}`);
    }

    // Setup error handlers for graceful failure handling
    setupConnectionErrorHandlers(serverId, transport);

    console.log(`[MCP] Connection established for ${serverId}, now listing tools...`);
    
    // List available tools
    try {
      console.log(`[MCP] Calling client.listTools() for ${serverId}`);
      const toolsResponse = await client.listTools();
      console.log(`[MCP] Tools response for ${serverId}:`, toolsResponse);
      console.log(`[MCP] Number of tools found: ${toolsResponse.tools?.length || 0}`);
      
      // Convert MCP tools to our format
      const tools = toolsResponse.tools.map(mcpTool => ({
        name: mcpTool.name,
        description: mcpTool.description,
        enabled: false // Default to disabled
      }));
      
      console.log(`[MCP] Processed tools for ${serverId}:`, tools);
      
      // Store the connection with client
      activeConnections.set(serverId, {
        serverId,
        config,
        client,
        transport
      });

      console.log(`[MCP] Server ${serverId} started successfully with ${tools.length} tools`);
      
      // Update server status to running with discovered tools
      updateMCPServerStatus(serverId, { 
        status: 'running',
        tools
      });
      
      console.log(`[MCP] Updated server status for ${serverId} to running`);
    } catch (toolsError) {
      console.error(`[MCP] Failed to list tools for ${serverId}:`, toolsError);
      throw toolsError;
    }
  } catch (error) {
    console.error(`Failed to start MCP server ${serverId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    updateMCPServerStatus(serverId, { 
      status: 'error',
      error: errorMessage
    });
    
    // Don't show error for individual server failures to avoid disrupting other servers
    // showError(`Failed to start MCP server ${serverId}: ${errorMessage}`);
    console.log(`[MCP] Server ${serverId} failed to start, but continuing with other servers`);
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
      JSON.stringify(oldHttp.headers) !== JSON.stringify(newHttp.headers)
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
        
        // Check if this is a connection error and handle gracefully
        if (isConnectionError(error)) {
          console.log(`[MCP] Connection lost for server ${serverId}, marking as disconnected`);
          handleConnectionError(serverId, error instanceof Error ? error : new Error(String(error)));
        }
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
    
    // Check if this is a connection error and handle gracefully
    if (isConnectionError(error)) {
      console.log(`[MCP] Connection lost for server ${serverId}, marking as disconnected`);
      handleConnectionError(serverId, error instanceof Error ? error : new Error(String(error)));
      throw new Error(`MCP server ${serverId} is no longer available. Please check the server connection.`);
    }
    
    throw error;
  }
}
