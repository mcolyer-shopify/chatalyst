# Chatalyst

A native MCP llm client.

![Screenshot v0.2.1](https://github.com/user-attachments/assets/7eec8c4a-150f-44dd-8d7a-99b06854ad17)

## Development

Use `claude` for development. Create PRs with feature branches and ensure they are rebased with the latest `main` branch before merging.

```
cd chatalyst
pnpm install
pnpm tauri dev
```

## Testing

```
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

## TODO

## MCP MVP
- Create a feature branch, and logical commits as you work.

- Add a mcp configuration textarea to the settings page and persist it.

Here's a valid example:

```json
{
  "iMCP": {
    "enabled": false,
    "name": "iMCP",
    "description": "Provides access to local information",
    "transport": "stdio",
    "command": "/Applications/iMCP.app/Contents/MacOS/imcp-server"
  },
  "sequential-thinking": {
    "name": "sequential-thinking",
    "description": "Fetches urls",
    "transport": "stdio",
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-sequential-thinking"
    ]
  },
  "webfetch": {
    "name": "webfetch",
    "description": "Fetches urls",
    "transport": "stdio",
    "command": "uvx",
    "args": [
      "mcp-server-fetch"
    ]
  },
  "time": {
    "name": "Time",
    "description": "Provides current time",
    "transport": "stdio",
    "command": "uvx",
    "args": [
      "mcp-server-time",
      "--local-timezone=America/Los_Angeles"
    ]
  },
  "prompt": {
    "name": "Prompt",
    "description": "Provides a customized prompt",
    "transport": "stdio",
    "command": "uv",
    "args": [
      "run",
      "mcp",
      "run",
      "server.py"
    ],
    "cwd": "/Users/mcolyer/src/github.com/mcolyer-shopify/mcp-server"
  }
}
```

    - Validate that mcp configuration is valid JSON. If there's an error, show an error message.
    - Validate when the user unfocuses the textarea or presses configuration save.
    - Do not allow the user to save invalid JSON.
    - When it is successfuan mcp configuration is changed, shutdown any existing mcp connections and create a new one with the new configuration.

- Initialize any mcp connections with the configuration from the settings page at app startup.
- Close any existing mcp connections when the app is closed or reloaded.

## Support for MCP server
- Have a tab in settings for MCP
- On each tab, see the cmd, active, options, type.
  - Also see status, list of tools and log all output and a log of calls and responses.
  - Clear logs after last 1000 lines

### Future

- Support image input. Read https://ai-sdk.dev/docs/guides/multi-modal-chatbot, add the ability to paste images and attached them to the response.
- Support for Ollama


