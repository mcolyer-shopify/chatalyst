import { Child, Command } from '@tauri-apps/plugin-shell';
import type { MCPConfiguration, MCPServerConfig } from '../types';
import { showError } from '../store';

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
  } catch (error) {
    console.error(`Failed to start MCP server ${serverId}:`, error);
    showError(`Failed to start MCP server ${serverId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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