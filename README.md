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

# GitHub Actions
- Add a eslint action
- Add an action which runs all unit tests
- Add a release workflow to build a macos release and upload it to the releases page when a new tag is pushed.

## Model Selection
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

## Support for Ollama

## Support for MCP server
- Have a tab in settings for MCP
- On each tab, see the cmd, active, options, type.
  - Also see status, list of tools and log all output and a log of calls and responses.
  - Clear logs after last 1000 lines

