import { Child, Command } from '@tauri-apps/plugin-shell';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPConfiguration, MCPServerConfig, MCPServerStatus, Conversation } from '../types';
import { showError, addMCPServer, updateMCPServerStatus, removeMCPServer, mcpServers } from '../store';

interface MCPConnection {
  serverId: string;
  config: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport;
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

    // Create MCP client and transport
    // The transport will handle spawning the process
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      cwd: config.cwd
    });

    const client = new Client({
      name: 'chatalyst',
      version: '0.1.0'
    }, {
      capabilities: {}
    });

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
  await shutdownMCPConnections();
  await initializeMCPConnections(newConfigString);
}

/**
 * Convert MCP JSON Schema to Zod schema
 */
function jsonSchemaToZod(schema: any): z.ZodType<any> {
  if (!schema || typeof schema !== 'object') {
    return z.any();
  }

  switch (schema.type) {
    case 'string':
      let stringSchema = z.string();
      if (schema.description) stringSchema = stringSchema.describe(schema.description);
      return stringSchema;
    
    case 'number':
      let numberSchema = z.number();
      if (schema.description) numberSchema = numberSchema.describe(schema.description);
      return numberSchema;
    
    case 'boolean':
      let booleanSchema = z.boolean();
      if (schema.description) booleanSchema = booleanSchema.describe(schema.description);
      return booleanSchema;
    
    case 'array':
      const itemSchema = schema.items ? jsonSchemaToZod(schema.items) : z.any();
      let arraySchema = z.array(itemSchema);
      if (schema.description) arraySchema = arraySchema.describe(schema.description);
      return arraySchema;
    
    case 'object':
      if (schema.properties) {
        const shape: Record<string, z.ZodType<any>> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          shape[key] = jsonSchemaToZod(propSchema);
        }
        let objectSchema = z.object(shape);
        if (schema.required && Array.isArray(schema.required)) {
          // Mark non-required fields as optional
          for (const key of Object.keys(shape)) {
            if (!schema.required.includes(key)) {
              shape[key] = shape[key].optional();
            }
          }
          objectSchema = z.object(shape);
        }
        if (schema.description) objectSchema = objectSchema.describe(schema.description);
        return objectSchema;
      }
      return z.record(z.any());
    
    default:
      return z.any();
  }
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

  const activeTools: any[] = [];
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
        
        // Convert JSON Schema to Zod schema
        const zodSchema = mcpTool.inputSchema ? jsonSchemaToZod(mcpTool.inputSchema) : z.object({});
        
        // Create a tool definition that the AI SDK can use
        activeTools.push({
          name: `${serverId}_${toolName}`,
          description: mcpTool.description || tool.description || `Tool ${toolName} from ${server.name}`,
          parameters: zodSchema
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
export async function executeMCPTool(toolName: string, args: any) {
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
      arguments: args
    });
    
    console.log(`[MCP] Tool ${toolName} result:`, result);
    
    // Return the result content
    if (result.content && result.content.length > 0) {
      // MCP returns content as an array, we'll join text content
      const textContent = result.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
      return textContent || result.content;
    }
    
    return result;
  } catch (error) {
    console.error(`[MCP] Failed to execute tool ${toolName}:`, error);
    throw error;
  }
}