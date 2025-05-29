import { render, screen } from '@testing-library/preact';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { signal } from '@preact/signals';
import { MCPSidebar } from './MCPSidebar';
import type { MCPServerStatus, Conversation } from '../types';

// Mock the CSS import
vi.mock('./MCPSidebar.css', () => ({}));

// Mock the store module
vi.mock('../store', () => {
  const mockMcpServers = signal<MCPServerStatus[]>([]);
  const mockSelectedConversation = signal<Conversation | null>(null);
  
  return {
    mcpServers: mockMcpServers,
    selectedConversation: mockSelectedConversation,
    toggleConversationTool: vi.fn(),
    enableAllServerTools: vi.fn(),
    disableAllServerTools: vi.fn(),
    enableAllToolsOnAllServers: vi.fn()
  };
});

// Import the mocked store
import { mcpServers, selectedConversation } from '../store';

// Helper function to set signal values in tests
function setMockSignalValue<T>(signal: { value: T }, newValue: T) {
  (signal as { value: T }).value = newValue;
}

describe('MCPSidebar', () => {
  beforeEach(() => {
    // Reset the signals
    setMockSignalValue(mcpServers, []);
    setMockSignalValue(selectedConversation, null);
  });

  it('shows server with unloaded status', () => {
    const unloadedServer: MCPServerStatus = {
      id: 'test-server',
      name: 'Test Server',
      description: 'A test server',
      status: 'unloaded',
      tools: []
    };

    const conversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabledTools: {}
    };

    setMockSignalValue(mcpServers, [unloadedServer]);
    setMockSignalValue(selectedConversation, conversation);

    render(<MCPSidebar />);

    expect(screen.getByText('Test Server')).toBeInTheDocument();
    expect(screen.getByText('A test server')).toBeInTheDocument();
    
    const statusIcon = screen.getByTitle('Server not loaded');
    expect(statusIcon).toBeInTheDocument();
  });

  it('shows different status tooltips for different states', () => {
    const servers: MCPServerStatus[] = [
      {
        id: 'unloaded-server',
        name: 'Unloaded Server',
        description: 'Unloaded',
        status: 'unloaded',
        tools: []
      },
      {
        id: 'running-server',
        name: 'Running Server',
        description: 'Running',
        status: 'running',
        tools: []
      },
      {
        id: 'error-server',
        name: 'Error Server',
        description: 'Error',
        status: 'error',
        error: 'Failed to start',
        tools: []
      }
    ];

    const conversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabledTools: {}
    };

    setMockSignalValue(mcpServers, servers);
    setMockSignalValue(selectedConversation, conversation);

    render(<MCPSidebar />);

    expect(screen.getByTitle('Server not loaded')).toBeInTheDocument();
    expect(screen.getByTitle('Server is running')).toBeInTheDocument();
    expect(screen.getByTitle('Server error')).toBeInTheDocument();
  });

  it('shows no MCP servers message when list is empty', () => {
    const conversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabledTools: {}
    };

    setMockSignalValue(mcpServers, []);
    setMockSignalValue(selectedConversation, conversation);

    render(<MCPSidebar />);

    expect(screen.getByText('No MCP servers configured')).toBeInTheDocument();
  });

  it('shows conversation selection message when no conversation is selected', () => {
    setMockSignalValue(mcpServers, []);
    setMockSignalValue(selectedConversation, null);

    render(<MCPSidebar />);

    expect(screen.getByText('Select a conversation to manage tools')).toBeInTheDocument();
  });
});