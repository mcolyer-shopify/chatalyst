import type { CoreMessage } from 'ai';

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  timestamp: number;
  isGenerating?: boolean;
  isError?: boolean; // For error messages
  toolName?: string; // For tool messages
  toolCall?: unknown; // Tool call parameters
  toolResult?: unknown; // Tool execution result
  toolCalls?: Array<{ // For assistant messages that call tools
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  imageIds?: number[]; // References to stored images
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  enabledTools?: { [serverId: string]: string[] }; // serverId -> array of enabled tool names
  sdkMessages?: CoreMessage[];
  archived?: boolean;
  archivedAt?: number;
}

export interface Model {
  id: string;
  name: string;
  description?: string;
}

// Base configuration shared by all MCP servers
interface BaseMCPServerConfig {
  enabled?: boolean;
  name: string;
  description: string;
}

// Configuration for stdio (local process) MCP servers
export interface StdioMCPServerConfig extends BaseMCPServerConfig {
  transport: 'stdio';
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

// Configuration for HTTP-based remote MCP servers (streamable HTTP)
export interface HttpMCPServerConfig extends BaseMCPServerConfig {
  transport: 'http';
  url: string;
  headers?: Record<string, string>;
}

// Configuration for SSE-based remote MCP servers
export interface SSEMCPServerConfig extends BaseMCPServerConfig {
  transport: 'sse';
  url: string;
  headers?: Record<string, string>;
}

// Union type for all MCP server configurations
export type MCPServerConfig = StdioMCPServerConfig | HttpMCPServerConfig | SSEMCPServerConfig;

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
  status: 'unloaded' | 'starting' | 'running' | 'error' | 'stopped';
  error?: string;
  tools: MCPTool[];
}

export type AIProvider = 'custom' | 'openrouter' | 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq' | 'perplexity';

export interface Settings {
  provider: AIProvider;
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  mcpConfiguration?: string; // JSON string of MCPConfiguration
}

// Image-related types
export interface StoredImage {
  id: number;
  hash: string;
  data: number[]; // Vec<u8> from Rust becomes number[] in TypeScript
  mime_type: string;
  size: number;
  created_at: string;
}

export interface ImageMetadata {
  id: number;
  hash: string;
  mime_type: string;
  size: number;
  created_at: string;
}

export interface ImageReference {
  id: number;
  image_id: number;
  conversation_id: string;
  created_at: string;
}

export interface PendingImage {
  id: string; // Temporary ID for UI
  file: File;
  preview: string; // Data URL for preview
}

export interface Prompt {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}