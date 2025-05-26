# Chatalyst

A native MCP llm client.

## Development

Use `claude` for development. Create PRs with feature branches and ensure they are rebased with the latest `main` branch before merging.

```
cd chatalyst
pnpm install
pnpm tauri dev
```

## TODO
- Structure app with conversations.
- Create a conversationlist component
- Create a convervsation component
- Create a message component, two types - user and assistant
- Conversations have many messages
- Conversation list has many conversations
- Conversations should each be persisted to local storage, model them as an object using typescript.
