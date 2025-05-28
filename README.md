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

Update eslint config to allow console.log and console.error

### Support for multiple providers
- Update the model settings modal to include a dropdown for the type of provider.
    - See https://ai-sdk.dev/docs/foundations/providers-and-models for all the list of possible provicers
    - Only include Custom Open AI, OpenRouter or Ollama.
- Allow base url for custom ai provider, otherwise just allow setting the api key.
- Update the store as appropriate and related types.


We need to update how we fetch the list of models for different providers. 
Currently we support the OpenAI provider and openrouter, let's add support for ollama and switch between them based on the currently configured provider.


### API for ollama models
List models that are available locally.

GET /api/tags

Examples

Request:

curl http://localhost:11434/api/tags
Response:

A single JSON object will be returned.

{
  "models": [
    {
      "name": "codellama:13b",
      "modified_at": "2023-11-04T14:56:49.277302595-07:00",
      "size": 7365960935,
      "digest": "9f438cb9cd581fc025612d27f7c1a6669ff83a8bb0ed86c94fcf4c5440555697",
      "details": {
        "format": "gguf",
        "family": "llama",
        "families": null,
        "parameter_size": "13B",
        "quantization_level": "Q4_0"
      }
    },

### Improved MCP Settings interface
- Have a tab in settings for MCP
- On each tab, see the cmd, active, options, type.
  - Also see status, list of tools and log all output and a log of calls and responses.
  - Clear logs after last 1000 lines

### Future

- Support image input. Read https://ai-sdk.dev/docs/guides/multi-modal-chatbot, add the ability to paste images and attached them to the response.


