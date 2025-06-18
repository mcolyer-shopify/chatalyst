import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js';
import { fetch } from '@tauri-apps/plugin-http';



/**
 * Polling-based transport for MCP servers that use HTTP but can't use SSE due to CORS.
 * This transport polls for responses after sending requests.
 */
export class TauriPollingTransport implements Transport {
  private _url: URL;
  private _headers: Record<string, string>;
  private _sessionId?: string;
  private _pendingRequests = new Map<string | number, {
    timestamp: number;
    attempts: number;
  }>();
  private _pollingInterval?: ReturnType<typeof setInterval>;
  private _isPolling = false;
  
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(url: URL, headers?: Record<string, string>) {
    this._url = url;
    this._headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(headers || {})
    };
    
    console.log('[TauriPollingTransport] Created with URL:', url.toString());
  }

  async start(): Promise<void> {
    console.log('[TauriPollingTransport] Starting transport');
    // Start polling mechanism
    this._startPolling();
  }

  private _startPolling(): void {
    if (this._isPolling) return;
    
    this._isPolling = true;
    console.log('[TauriPollingTransport] Starting polling mechanism');
    
    // Poll every 500ms for pending responses
    this._pollingInterval = globalThis.setInterval(() => {
      if (this._pendingRequests.size > 0) {
        this._pollForResponses();
      }
    }, 500);
  }

  private async _pollForResponses(): Promise<void> {
    console.log('[TauriPollingTransport] Polling for responses, pending requests:', this._pendingRequests.size);
    
    try {
      // For GitHub MCP, we might need to poll a different endpoint or use a special header
      const pollHeaders = {
        ...this._headers,
        ...(this._sessionId ? { 'Mcp-Session-Id': this._sessionId } : {}),
        'X-MCP-Poll': 'true' // Indicate we're polling for responses
      };
      
      const response = await fetch(this._url.toString(), {
        method: 'GET',
        headers: pollHeaders
      });
      
      if (response.ok) {
        const responseText = await response.text();
        if (responseText) {
          try {
            const messages = this._parseMessages(responseText);
            for (const message of messages) {
              if (this.onmessage) {
                this.onmessage(message);
              }
              
              // Remove from pending if this is a response to a request
              if ('id' in message && message.id !== null && message.id !== undefined) {
                this._pendingRequests.delete(message.id);
              }
            }
          } catch (error) {
            console.error('[TauriPollingTransport] Failed to parse poll response:', error);
          }
        }
      }
    } catch (error) {
      console.error('[TauriPollingTransport] Poll error:', error);
    }
    
    // Clean up old pending requests (timeout after 30 seconds)
    const now = Date.now();
    for (const [id, info] of this._pendingRequests.entries()) {
      if (now - info.timestamp > 30000) {
        console.warn(`[TauriPollingTransport] Request ${id} timed out`);
        this._pendingRequests.delete(id);
        
        if (this.onerror) {
          this.onerror(new Error(`Request ${id} timed out`));
        }
      }
    }
  }

  private _parseMessages(text: string): JSONRPCMessage[] {
    // Try to parse as single message first
    try {
      return [JSON.parse(text)];
    } catch {
      // Try to parse as newline-delimited JSON
      const messages: JSONRPCMessage[] = [];
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            messages.push(JSON.parse(line));
          } catch (error) {
            console.error('[TauriPollingTransport] Failed to parse line:', line, error);
          }
        }
      }
      
      return messages;
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    console.log('[TauriPollingTransport] Sending message:', message);
    
    const requestHeaders = {
      ...this._headers,
      ...(this._sessionId ? { 'Mcp-Session-Id': this._sessionId } : {})
    };
    
    try {
      const response = await fetch(this._url.toString(), {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(message)
      });

      console.log('[TauriPollingTransport] Response status:', response.status);

      // Check for session ID
      const sessionId = response.headers.get('Mcp-Session-Id') || response.headers.get('mcp-session-id');
      if (sessionId && sessionId !== this._sessionId) {
        console.log('[TauriPollingTransport] Got new session ID:', sessionId);
        this._sessionId = sessionId;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}. Body: ${errorText}`);
      }

      // Check if we got an immediate response
      const responseText = await response.text();
      if (responseText) {
        try {
          const responseData = JSON.parse(responseText) as JSONRPCResponse;
          console.log('[TauriPollingTransport] Got immediate response:', responseData);
          
          if (this.onmessage) {
            this.onmessage(responseData);
          }
          
          // Don't need to poll for this one
          return;
        } catch {
          console.log('[TauriPollingTransport] Response not JSON, might need polling');
        }
      }
      
      // If this is a request, add to pending
      if ('id' in message && message.id !== null && message.id !== undefined) {
        console.log(`[TauriPollingTransport] Adding request ${message.id} to pending`);
        this._pendingRequests.set(message.id, {
          timestamp: Date.now(),
          attempts: 0
        });
      }
    } catch (error) {
      console.error('[TauriPollingTransport] Send error:', error);
      
      if (this.onerror) {
        this.onerror(error instanceof Error ? error : new Error(String(error)));
      }
      
      throw error;
    }
  }

  async close(): Promise<void> {
    console.log('[TauriPollingTransport] Closing transport');
    
    // Stop polling
    if (this._pollingInterval) {
      globalThis.clearInterval(this._pollingInterval);
      this._pollingInterval = undefined;
    }
    
    this._isPolling = false;
    this._pendingRequests.clear();
    
    if (this.onclose) {
      this.onclose();
    }
  }
}