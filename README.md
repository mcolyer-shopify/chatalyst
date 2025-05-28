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

- Scope the tool enablement to a conversation. 
- Save the tool enablement state in the conversation.
- By default, tools should be disabled.
- Allow enabling all tools under a server with one click.
- Graceful handle if a tool was previously enabled but the server no longer provides that tool.

- Remove jsonSchemaToZod function and use https://ai-sdk.dev/docs/reference/ai-sdk-core/json-schema.



## Support for MCP server
- Have a tab in settings for MCP
- On each tab, see the cmd, active, options, type.
  - Also see status, list of tools and log all output and a log of calls and responses.
  - Clear logs after last 1000 lines

### Future

- Support image input. Read https://ai-sdk.dev/docs/guides/multi-modal-chatbot, add the ability to paste images and attached them to the response.
- Support for Ollama


