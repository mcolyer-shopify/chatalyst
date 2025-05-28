export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'tool';
  timestamp: number;
  isGenerating?: boolean;
  toolName?: string; // For tool messages
  toolCall?: any; // Tool call parameters
  toolResult?: any; // Tool execution result
  toolCalls?: Array<{ // For assistant messages that call tools
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  enabledTools?: { [serverId: string]: string[] }; // serverId -> array of enabled tool names
}

export interface Model {
  id: string;
  name: string;
  description?: string;
}

export interface MCPServerConfig {
  enabled?: boolean;
  name: string;
  description: string;
  transport: 'stdio';
  command: string;
  args?: string[];
  cwd?: string;
}

export interface MCPConfiguration {
  [key: string]: MCPServerConfig;
}

export interface MCPTool {
  name: string;
  description?: string;
  enabled: boolean;
}

export interface MCPServerStatus {
  id: string;
  name: string;
  description: string;
  status: 'starting' | 'running' | 'error' | 'stopped';
  error?: string;
  tools: MCPTool[];
}

export interface Settings {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  mcpConfiguration?: string; // JSON string of MCPConfiguration
}