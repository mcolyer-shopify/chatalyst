# Chatalyst

A native MCP llm client.

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
- Create a conversationlist component which goes on the left side to allow users to pick between conversations or create new conversations.
  - Conversations can be clicked to select them.
  - Conversations have titles which can be renamed with a dropdown menu.
  - Conversations can be deleted with a dropdown menu.
- Create a convervsation component which encapsulates all of the messages and the messsage input component.
- Create a message component, two types - user and assistant. Align user messages to the right and assistant messages to the left.
- Create an messageinput component which allows users to type messages and send them.
- Conversations have many messages
- Conversation list has many conversations
- Conversations should each be persisted to local storage, model them as an object using typescript.

- Add unit tests.

## M1
- Add a model attribute to a conversation object.
- Create a model selection component which allows users to select a model from a dropdown.
    - Populate the models via the API.
- Create a default model selection in the sidebar.
- Add a model selection dropdown to the conversation component.
- Conversations should start with the default model.
- Add unit tests.

## M2
- Add a mcp configuration textarea to the settings page and persist it.
    - Validate that mcp configuration is valid JSON. If there's an error, show an error message.
    - Validate when the user unfocuses the textarea or presses configuration save.
    - Do not allow the user to save invalid JSON.
    - When it is successfuan mcp configuration is changed, shutdown any existing mcp connections and create a new one with the new configuration.

- Initialize any mcp connections with the configuration from the settings page at app startup.
- Close any existing mcp connections when the app is closed.

# GitHub Actions
- Add a eslint action
- Add an action which runs all unit tests
- Add a release workflow to build a macos release and upload it to the releases page when a new tag is pushed.
