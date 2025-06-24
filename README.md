# Chatalyst

A native MCP llm client.

![Screenshot v0.2.1](https://github.com/user-attachments/assets/f05122c6-f8b8-4eb8-8976-b43cdeb9cd8a)

## Keyboard Shortcuts

Chatalyst supports the following keyboard shortcuts for efficient conversation management:

- **Ctrl/Cmd + N**: Create a new conversation
- **E**: Archive the current conversation
- **T**: Generate a title for the current conversation
- **X**: Delete the current conversation
- **Escape**: Defocus input field to enable keyboard shortcuts

**Note:** Letter shortcuts (E, T, X) only work when no input field is focused. Use Escape to defocus inputs if needed.

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

- Refactor messages to be array of message parts rather than strings.
- Support image input. Read https://ai-sdk.dev/docs/guides/multi-modal-chatbot, add the ability to paste images and attached them to the response.
