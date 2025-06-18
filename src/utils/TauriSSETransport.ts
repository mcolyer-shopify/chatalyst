import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { fetch } from '@tauri-apps/plugin-http';

/* global EventSource */

/**
 * Custom SSE transport that uses Tauri's fetch for sending messages.
 * This is a simpler alternative when Streamable HTTP doesn't work.
 */
export class TauriSSETransport implements Transport {
  private _url: URL;
  private _headers: Record<string, string>;
  private _eventSource?: EventSource;
  private _abortController?: AbortController;
  
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(url: URL, headers?: Record<string, string>) {
    this._url = url;
    this._headers = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...(headers || {})
    };
    
    console.log('[TauriSSETransport] Created with URL:', url.toString());
  }

  async start(): Promise<void> {
    console.log('[TauriSSETransport] Starting SSE transport');
    
    // For SSE, we establish a GET connection with EventSource
    const sseUrl = new URL(this._url.toString());
    
    // Try to pass auth in URL if we have Bearer token in headers
    const authHeader = this._headers['Authorization'] || this._headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      sseUrl.searchParams.set('token', token);
    }
    
    console.log('[TauriSSETransport] Connecting to SSE endpoint:', sseUrl.toString());
    
    this._eventSource = new EventSource(sseUrl.toString());
    
    this._eventSource.onopen = () => {
      console.log('[TauriSSETransport] SSE connection established');
    };
    
    this._eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as JSONRPCMessage;
        console.log('[TauriSSETransport] Received message:', message);
        
        if (this.onmessage) {
          this.onmessage(message);
        }
      } catch (error) {
        console.error('[TauriSSETransport] Failed to parse message:', error);
      }
    };
    
    this._eventSource.onerror = (error) => {
      console.error('[TauriSSETransport] SSE connection error:', error);
      
      if (this.onerror) {
        this.onerror(new Error('SSE connection failed'));
      }
    };
  }

  async send(message: JSONRPCMessage): Promise<void> {
    console.log('[TauriSSETransport] Sending message via POST:', message);
    
    try {
      // For SSE, we send messages via POST to the same endpoint
      const response = await fetch(this._url.toString(), {
        method: 'POST',
        headers: this._headers,
        body: JSON.stringify(message),
        signal: this._abortController?.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}. Body: ${errorText}`);
      }

      // SSE transport typically doesn't return responses in the POST body
      // Responses come through the EventSource connection
      console.log('[TauriSSETransport] Message sent successfully');
    } catch (error) {
      console.error('[TauriSSETransport] Send error:', error);
      
      if (this.onerror) {
        this.onerror(error instanceof Error ? error : new Error(String(error)));
      }
      
      throw error;
    }
  }

  async close(): Promise<void> {
    console.log('[TauriSSETransport] Closing transport');
    
    // Cancel any pending requests
    this._abortController?.abort();
    
    // Close EventSource
    if (this._eventSource) {
      this._eventSource.close();
      this._eventSource = undefined;
    }
    
    if (this.onclose) {
      this.onclose();
    }
  }
}