import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export interface RemoteHttpTransportOptions {
  url: string;
  headers?: Record<string, string>;
  timeout?: number; // in milliseconds, default 30s
}

/**
 * HTTP transport for remote MCP servers
 * Implements polling-based communication over HTTP
 */
export class RemoteHttpTransport implements Transport {
  private _url: string;
  private _headers: Record<string, string>;
  private _timeout: number;
  private _isRunning: boolean = false;
  private _pollInterval?: number;
  private _lastMessageId?: string | number;

  // Transport callbacks
  onclose?: (reason?: unknown) => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(options: RemoteHttpTransportOptions) {
    this._url = options.url;
    this._headers = options.headers || {};
    this._timeout = options.timeout || 30000;
  }

  async start(): Promise<void> {
    try {
      console.log(`[RemoteHttpTransport] Connecting to: ${this._url}`);
      
      // Test the connection with a health check or initial handshake
      const response = await fetch(`${this._url}/health`, {
        method: 'GET',
        headers: this._headers,
        signal: globalThis.AbortSignal.timeout(this._timeout)
      }).catch(() => null);

      if (!response || !response.ok) {
        console.warn('[RemoteHttpTransport] Health check failed, proceeding anyway');
      }

      this._isRunning = true;
      
      // Start polling for messages
      this._startPolling();
      
      console.log('[RemoteHttpTransport] Transport started');
    } catch (error) {
      console.error('[RemoteHttpTransport] Failed to start:', error);
      if (this.onerror) {
        this.onerror(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  private _startPolling(): void {
    if (!this._isRunning) return;

    // Poll every 100ms for new messages
    this._pollInterval = globalThis.setInterval(async () => {
      try {
        await this._pollMessages();
      } catch (error) {
        console.error('[RemoteHttpTransport] Polling error:', error);
        if (this.onerror) {
          this.onerror(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }, 100);
  }

  private async _pollMessages(): Promise<void> {
    if (!this._isRunning) return;

    try {
      const response = await fetch(`${this._url}/messages`, {
        method: 'GET',
        headers: {
          ...this._headers,
          'X-Last-Message-Id': String(this._lastMessageId || '')
        },
        signal: globalThis.AbortSignal.timeout(this._timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const messages = await response.json() as JSONRPCMessage[];
      
      for (const message of messages) {
        console.log('[RemoteHttpTransport] Received message:', message);
        
        // Update last message ID for next poll
        if ('id' in message && message.id) {
          this._lastMessageId = message.id;
        }
        
        if (this.onmessage) {
          this.onmessage(message);
        }
      }
    } catch (error) {
      // Ignore timeout errors during polling
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      throw error;
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._isRunning) {
      throw new Error('Transport not started');
    }

    console.log('[RemoteHttpTransport] Sending message:', message);

    try {
      const response = await fetch(`${this._url}/messages`, {
        method: 'POST',
        headers: {
          ...this._headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message),
        signal: globalThis.AbortSignal.timeout(this._timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if there's an immediate response
      const responseData = await response.json().catch(() => null);
      if (responseData && this.onmessage) {
        console.log('[RemoteHttpTransport] Immediate response:', responseData);
        this.onmessage(responseData as JSONRPCMessage);
      }
    } catch (error) {
      console.error('[RemoteHttpTransport] Failed to send message:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    console.log('[RemoteHttpTransport] Closing transport');
    
    this._isRunning = false;
    
    if (this._pollInterval) {
      globalThis.clearInterval(this._pollInterval);
      this._pollInterval = undefined;
    }
    
    // Send a disconnect message if possible
    try {
      await fetch(`${this._url}/disconnect`, {
        method: 'POST',
        headers: this._headers,
        signal: globalThis.AbortSignal.timeout(5000)
      });
    } catch (error) {
      console.error('[RemoteHttpTransport] Failed to send disconnect:', error);
    }
    
    this._lastMessageId = undefined;
    
    if (this.onclose) {
      this.onclose();
    }
  }
}