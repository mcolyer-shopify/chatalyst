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

### Future

- Make sure to clear errors when switching conversations.
- Make sure to clear the error state on the MCP Settings modal after saving or canceling.
- Add support for remote sse MCP servers.
- Refactor messages to be array of message parts rather than strings.
- Support image input. Read https://ai-sdk.dev/docs/guides/multi-modal-chatbot, add the ability to paste images and attached them to the response.
