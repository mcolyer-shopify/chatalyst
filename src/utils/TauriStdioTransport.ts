import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Child, Command } from '@tauri-apps/plugin-shell';

export interface TauriStdioTransportOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * Custom stdio transport for Tauri that uses the shell plugin
 * instead of Node.js child_process
 */
export class TauriStdioTransport implements Transport {
  private _command: string;
  private _args?: string[];
  private _env?: Record<string, string>;
  private _cwd?: string;
  private _process?: Child;
  private _readBuffer: string = '';

  // Transport callbacks
  onclose?: (reason?: any) => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(options: TauriStdioTransportOptions) {
    this._command = options.command;
    this._args = options.args;
    this._env = options.env;
    this._cwd = options.cwd;
  }

  async start(): Promise<void> {
    try {
      console.log(`[TauriStdioTransport] Starting command: ${this._command} ${this._args?.join(' ')}`);

      // Create the command using sh -c to handle command + args
      let fullCommand = this._command;
      if (this._args && this._args.length > 0) {
        const escapedArgs = this._args.map(arg => {
          if (/[\s"'\\$`]/.test(arg)) {
            return `"${arg.replace(/["\\$`]/g, '\\$&')}"`;
          }
          return arg;
        });
        fullCommand = `${this._command} ${escapedArgs.join(' ')}`;
      }

      const command = Command.create('sh', ['-c', fullCommand], {
        cwd: this._cwd,
        env: this._env
      });

      // Set up event handlers before spawning
      command.on('close', (data) => {
        console.log(`[TauriStdioTransport] Process closed with code: ${data.code}`);
        if (this.onclose) {
          this.onclose(data.code);
        }
      });

      command.on('error', (error) => {
        console.error(`[TauriStdioTransport] Process error:`, error);
        if (this.onerror) {
          this.onerror(new Error(error));
        }
      });

      // Set up stdout handler to read messages
      command.stdout.on('data', (data: string | Uint8Array) => {
        // Handle both string and binary data
        const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
        this._readBuffer += text;
        this._processMessages();
      });

      // Set up stderr handler for debugging
      command.stderr.on('data', (data: string | Uint8Array) => {
        const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
        console.error(`[TauriStdioTransport] stderr:`, text);
      });

      // Spawn the process
      this._process = await command.spawn();
      console.log(`[TauriStdioTransport] Process spawned with PID: ${this._process.pid}`);

    } catch (error) {
      console.error(`[TauriStdioTransport] Failed to start:`, error);
      if (this.onerror) {
        this.onerror(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  private _processMessages(): void {
    const lines = this._readBuffer.split('\n');
    
    // Keep the last incomplete line in the buffer
    this._readBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as JSONRPCMessage;
        console.log(`[TauriStdioTransport] Received message:`, message);
        
        if (this.onmessage) {
          this.onmessage(message);
        }
      } catch (error) {
        console.error(`[TauriStdioTransport] Failed to parse message:`, line, error);
      }
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._process) {
      throw new Error('Transport not started');
    }

    const messageStr = JSON.stringify(message) + '\n';
    console.log(`[TauriStdioTransport] Sending message:`, message);

    try {
      // Convert string to Uint8Array for write
      const encoder = new TextEncoder();
      const data = encoder.encode(messageStr);
      await this._process.write(data);
    } catch (error) {
      console.error(`[TauriStdioTransport] Failed to send message:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    console.log(`[TauriStdioTransport] Closing transport`);
    
    if (this._process) {
      try {
        await this._process.kill();
      } catch (error) {
        console.error(`[TauriStdioTransport] Failed to kill process:`, error);
      }
      this._process = undefined;
    }

    this._readBuffer = '';
  }
}