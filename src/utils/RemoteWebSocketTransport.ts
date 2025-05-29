import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export interface RemoteWebSocketTransportOptions {
  url: string;
  headers?: Record<string, string>;
  reconnectAttempts?: number;
  reconnectDelay?: number; // in milliseconds
}

/**
 * WebSocket transport for remote MCP servers
 * Implements real-time bidirectional communication
 */
export class RemoteWebSocketTransport implements Transport {
  private _url: string;
  private _headers: Record<string, string>;
  private _reconnectAttempts: number;
  private _reconnectDelay: number;
  private _ws?: globalThis.WebSocket;
  private _isRunning: boolean = false;
  private _reconnectCount: number = 0;
  private _reconnectTimer?: number;
  private _messageQueue: JSONRPCMessage[] = [];

  // Transport callbacks
  onclose?: (reason?: unknown) => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(options: RemoteWebSocketTransportOptions) {
    this._url = options.url;
    this._headers = options.headers || {};
    this._reconnectAttempts = options.reconnectAttempts ?? 5;
    this._reconnectDelay = options.reconnectDelay ?? 1000;
  }

  async start(): Promise<void> {
    console.log(`[RemoteWebSocketTransport] Connecting to: ${this._url}`);
    this._isRunning = true;
    await this._connect();
  }

  private async _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket with custom headers via URL params if needed
        const url = new globalThis.URL(this._url);
        
        // Add headers as query params for authentication if needed
        // Note: Real WebSocket implementations might handle auth differently
        if (this._headers['Authorization']) {
          url.searchParams.set('auth', this._headers['Authorization']);
        }

        this._ws = new globalThis.WebSocket(url.toString());
        
        this._ws.onopen = () => {
          console.log('[RemoteWebSocketTransport] Connected');
          this._reconnectCount = 0;
          
          // Send any queued messages
          while (this._messageQueue.length > 0) {
            const message = this._messageQueue.shift();
            if (message) {
              this._sendMessage(message);
            }
          }
          
          resolve();
        };

        this._ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as JSONRPCMessage;
            console.log('[RemoteWebSocketTransport] Received message:', message);
            
            if (this.onmessage) {
              this.onmessage(message);
            }
          } catch (error) {
            console.error('[RemoteWebSocketTransport] Failed to parse message:', event.data, error);
          }
        };

        this._ws.onerror = (event) => {
          console.error('[RemoteWebSocketTransport] WebSocket error:', event);
          const error = new Error('WebSocket error');
          
          if (!this._isRunning) {
            reject(error);
          } else if (this.onerror) {
            this.onerror(error);
          }
        };

        this._ws.onclose = (event) => {
          console.log(`[RemoteWebSocketTransport] WebSocket closed: ${event.code} ${event.reason}`);
          
          if (!this._isRunning) {
            if (this.onclose) {
              this.onclose(event.reason || event.code);
            }
            return;
          }

          // Attempt to reconnect
          if (this._reconnectCount < this._reconnectAttempts) {
            this._reconnectCount++;
            console.log(`[RemoteWebSocketTransport] Reconnecting... (${this._reconnectCount}/${this._reconnectAttempts})`);
            
            this._reconnectTimer = globalThis.setTimeout(() => {
              this._connect().catch((error) => {
                console.error('[RemoteWebSocketTransport] Reconnection failed:', error);
                if (this.onerror) {
                  this.onerror(error);
                }
              });
            }, this._reconnectDelay * this._reconnectCount);
          } else {
            console.error('[RemoteWebSocketTransport] Max reconnection attempts reached');
            this._isRunning = false;
            
            if (this.onclose) {
              this.onclose('Max reconnection attempts reached');
            }
          }
        };
      } catch (error) {
        console.error('[RemoteWebSocketTransport] Failed to create WebSocket:', error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private _sendMessage(message: JSONRPCMessage): void {
    if (this._ws && this._ws.readyState === globalThis.WebSocket.OPEN) {
      this._ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket not connected');
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._isRunning) {
      throw new Error('Transport not started');
    }

    console.log('[RemoteWebSocketTransport] Sending message:', message);

    try {
      if (this._ws && this._ws.readyState === globalThis.WebSocket.OPEN) {
        this._sendMessage(message);
      } else {
        // Queue message if not connected
        console.log('[RemoteWebSocketTransport] Queueing message (not connected)');
        this._messageQueue.push(message);
      }
    } catch (error) {
      console.error('[RemoteWebSocketTransport] Failed to send message:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    console.log('[RemoteWebSocketTransport] Closing transport');
    
    this._isRunning = false;
    
    if (this._reconnectTimer) {
      globalThis.clearTimeout(this._reconnectTimer);
      this._reconnectTimer = undefined;
    }
    
    if (this._ws) {
      // Close with normal closure code
      this._ws.close(1000, 'Transport closed');
      this._ws = undefined;
    }
    
    this._messageQueue = [];
    this._reconnectCount = 0;
  }
}