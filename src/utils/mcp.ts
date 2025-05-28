import { Child, Command } from '@tauri-apps/plugin-shell';
import type { MCPConfiguration, MCPServerConfig, MCPServerStatus } from '../types';
import { showError, addMCPServer, updateMCPServerStatus, removeMCPServer } from '../store';

interface MCPConnection {
  serverId: string;
  config: MCPServerConfig;
  process: Child;
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
    
    // Build the full command string
    let fullCommand = config.command;
    if (config.args && config.args.length > 0) {
      // Properly escape arguments
      const escapedArgs = config.args.map(arg => {
        // If arg contains spaces or special characters, wrap in quotes
        if (/[\s"'\\$`]/.test(arg)) {
          return `"${arg.replace(/["\\$`]/g, '\\$&')}"`;
        }
        return arg;
      });
      fullCommand = `${config.command} ${escapedArgs.join(' ')}`;
    }
    
    // Create command using sh -c
    const command = Command.create('sh', ['-c', fullCommand], {
      cwd: config.cwd
    });

    // Spawn the process
    const child = await command.spawn();

    // Store the connection
    activeConnections.set(serverId, {
      serverId,
      config,
      process: child
    });

    console.log(`MCP server ${serverId} started successfully`);
    
    // Update server status to running
    updateMCPServerStatus(serverId, { 
      status: 'running',
      // TODO: In a real implementation, we would discover tools here
      // For now, just show some example tools
      tools: getExampleTools(serverId)
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

// Temporary function to provide example tools
function getExampleTools(serverId: string): MCPServerStatus['tools'] {
  const toolsMap: { [key: string]: MCPServerStatus['tools'] } = {
    'time': [
      { name: 'get_current_time', description: 'Get the current time in a specific timezone', enabled: true }
    ],
    'webfetch': [
      { name: 'fetch_url', description: 'Fetch and process web content', enabled: true }
    ],
    'sequential-thinking': [
      { name: 'think_step_by_step', description: 'Break down problems into steps', enabled: true }
    ],
    'prompt': [
      { name: 'get_custom_prompt', description: 'Get a customized prompt', enabled: true }
    ],
    'iMCP': [
      { name: 'get_local_info', description: 'Access local system information', enabled: true },
      { name: 'run_command', description: 'Execute system commands', enabled: true }
    ]
  };
  
  return toolsMap[serverId] || [
    { name: 'default_tool', description: 'Default tool for ' + serverId, enabled: true }
  ];
}

/**
 * Shutdown all MCP connections
 */
export async function shutdownMCPConnections() {
  console.log('Shutting down all MCP connections...');
  
  for (const [serverId, connection] of activeConnections.entries()) {
    try {
      console.log(`Killing MCP server: ${serverId}`);
      await connection.process.kill();
      activeConnections.delete(serverId);
      removeMCPServer(serverId);
    } catch (error) {
      console.error(`Failed to kill MCP server ${serverId}:`, error);
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