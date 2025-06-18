import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js';
import { fetch } from '@tauri-apps/plugin-http';

/* global EventSource, RequestInit */

/**
 * Custom Streamable HTTP transport that uses Tauri's fetch instead of standard fetch.
 * This implements the MCP Transport interface for HTTP-based communication.
 */
export class TauriStreamableHttpTransport implements Transport {
  private _url: URL;
  private _headers: Record<string, string>;
  private _sessionId?: string;
  private _abortController?: AbortController;
  private _sseAbortController?: AbortController;
  private _eventSource?: EventSource;
  
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(url: URL, options?: { requestInit?: RequestInit }) {
    this._url = url;
    this._headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options?.requestInit?.headers as Record<string, string> || {})
    };
    
    console.log('[TauriStreamableHttpTransport] Created with URL:', url.toString());
  }

  async start(): Promise<void> {
    console.log('[TauriStreamableHttpTransport] Starting transport');
    console.log('[TauriStreamableHttpTransport] URL:', this._url.toString());
    console.log('[TauriStreamableHttpTransport] Headers:', this._headers);
    
    // Start SSE connection for receiving messages
    this._startSSE();
    
    console.log('[TauriStreamableHttpTransport] Start method completed');
  }

  private _startSSE(): void {
    try {
      // For SSE, we need to use EventSource which might still have CORS issues
      // But let's try with a GET endpoint first
      const sseUrl = new URL(this._url.toString());
      
      // Add session ID if we have one
      if (this._sessionId) {
        sseUrl.searchParams.set('sessionId', this._sessionId);
      }
      
      console.log('[TauriStreamableHttpTransport] Starting SSE connection to:', sseUrl.toString());
      
      this._sseAbortController = new AbortController();
      
      // Try to establish SSE connection
      // Note: EventSource doesn't support custom headers, so auth needs to be in URL or cookies
      this._eventSource = new EventSource(sseUrl.toString());
      
      this._eventSource.onopen = () => {
        console.log('[TauriStreamableHttpTransport] SSE connection opened');
      };
      
      this._eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as JSONRPCMessage;
          console.log('[TauriStreamableHttpTransport] Received SSE message:', message);
          
          if (this.onmessage) {
            this.onmessage(message);
          }
        } catch (error) {
          console.error('[TauriStreamableHttpTransport] Failed to parse SSE message:', error);
        }
      };
      
      this._eventSource.onerror = (error) => {
        console.error('[TauriStreamableHttpTransport] SSE error:', error);
        
        // If SSE fails, we'll fall back to polling or handle it gracefully
        if (this.onerror) {
          this.onerror(new Error('SSE connection failed'));
        }
      };
    } catch (error) {
      console.error('[TauriStreamableHttpTransport] Failed to start SSE:', error);
      // Continue without SSE - we can still send messages
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    console.log('[TauriStreamableHttpTransport] Sending message:', JSON.stringify(message, null, 2));
    
    const requestHeaders = {
      ...this._headers,
      ...(this._sessionId ? { 'Mcp-Session-Id': this._sessionId } : {}),
      // Hint to the server that we prefer synchronous responses
      'X-Prefer-Sync-Response': 'true',
      'X-MCP-Transport': 'http'
    };
    
    console.log('[TauriStreamableHttpTransport] Request headers:', requestHeaders);
    
    try {
      console.log('[TauriStreamableHttpTransport] Fetching:', this._url.toString());
      const response = await fetch(this._url.toString(), {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(message),
        signal: this._abortController?.signal
      });

      console.log('[TauriStreamableHttpTransport] Response received');
      console.log('[TauriStreamableHttpTransport] Response status:', response.status);
      console.log('[TauriStreamableHttpTransport] Response statusText:', response.statusText);

      // Check for session ID in response headers
      const sessionId = response.headers.get('Mcp-Session-Id') || response.headers.get('mcp-session-id');
      if (sessionId && sessionId !== this._sessionId) {
        console.log('[TauriStreamableHttpTransport] Got new session ID:', sessionId);
        this._sessionId = sessionId;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}. Body: ${errorText}`);
      }

      // For Streamable HTTP, the response might be empty for notifications
      const contentLength = response.headers.get('Content-Length');
      if (contentLength === '0' || !contentLength) {
        console.log('[TauriStreamableHttpTransport] Empty response');
        
        // Check if this was a request (has an ID) vs a notification
        if ('id' in message && message.id !== null && message.id !== undefined) {
          console.warn(`[TauriStreamableHttpTransport] Empty response for request ${message.id}. Response might come via SSE.`);
          // For GitHub MCP, responses come through SSE, not in the HTTP response
          // The MCP client will wait for the response via onmessage callback
        } else {
          console.log('[TauriStreamableHttpTransport] Empty response for notification - this is expected');
        }
        return;
      }

      const responseText = await response.text();
      if (responseText) {
        try {
          const responseData = JSON.parse(responseText) as JSONRPCResponse;
          console.log('[TauriStreamableHttpTransport] Parsed response:', responseData);
          
          // Handle the response
          if (this.onmessage) {
            this.onmessage(responseData);
          }
        } catch (error) {
          console.error('[TauriStreamableHttpTransport] Failed to parse response:', error);
        }
      }
    } catch (error) {
      console.error('[TauriStreamableHttpTransport] Send error:', error);
      
      if (this.onerror) {
        this.onerror(error instanceof Error ? error : new Error(String(error)));
      }
      
      throw error;
    }
  }

  async close(): Promise<void> {
    console.log('[TauriStreamableHttpTransport] Closing transport');
    
    // Cancel any pending requests
    this._abortController?.abort();
    this._sseAbortController?.abort();
    
    // Close EventSource if it exists
    if (this._eventSource) {
      this._eventSource.close();
      this._eventSource = undefined;
    }
    
    // Send DELETE request to terminate session if we have a session ID
    if (this._sessionId) {
      try {
        await fetch(this._url.toString(), {
          method: 'DELETE',
          headers: {
            ...this._headers,
            'Mcp-Session-Id': this._sessionId
          }
        });
      } catch (error) {
        console.error('[TauriStreamableHttpTransport] Error terminating session:', error);
      }
    }
    
    if (this.onclose) {
      this.onclose();
    }
  }
}