# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2025-01-28

### Added
- Toggle button at bottom of MCP sidebar to quickly enable/disable all tools on all running servers
  - Shows "Enable All Tools" when some tools are disabled
  - Shows "Disable All Tools" when all tools are enabled
  - Only appears when there's an active conversation and running servers with tools
  - Button styled to match "New Conversation" button

### Fixed
- Auto-focus for MessageInput when creating new conversations or switching between conversations
  - Textarea now automatically receives focus when creating a new conversation
  - Focus also triggers when switching between existing conversations
  - Improves user experience by eliminating need to manually click input field

## [0.3.0] - 2025-01-28

### Added
- Error message display in conversation when models don't support tools
  - Shows warning-styled message explaining the issue
  - Provides guidance to disable tools or switch models
  - Prevents silent failures with clear user feedback
- Message history navigation with arrow keys in input field
  - Press up arrow to recall previous user messages
  - Press down arrow to navigate forward through history
  - Only activates when cursor is at position 0 for multi-line support
  - Preserves current message when navigating history
- Support for multiple AI providers (Custom OpenAI, OpenRouter, Ollama)
  - Provider selection dropdown in settings modal
  - Conditional display of base URL field (only for Custom OpenAI)
  - Conditional display of API key field (not needed for Ollama)
  - Provider-specific default base URLs (OpenRouter and Ollama)
  - Provider-aware model caching using provider and base URL as cache key
  - Ollama-specific model list parsing with support for different response format
  - Automatic API key handling for OpenRouter when not provided
  - Default provider set to OpenRouter for easier onboarding
- Stop generation button to halt AI responses mid-stream with immediate response control
- Conversation selection persistence that remembers the last selected conversation between application restarts
- Animated loading indicator for assistant message generation with spinning Braille pattern animation
- Window position and size persistence that remembers and restores window geometry between application restarts
- MCP settings gear icon in the MCP Servers sidebar for quick access to MCP configuration
- MCP (Model Context Protocol) configuration support in settings
  - Add textarea for JSON-based MCP server configuration
  - Real-time JSON validation with error messages
  - Persist MCP configuration across sessions
  - Automatic MCP server process management (start/stop/restart)
  - Initialize MCP connections on app startup
  - Graceful shutdown of MCP servers on app close
- MCP servers sidebar showing active servers and their tools
  - Real-time server status indicators (starting, running, error, stopped)
  - List of available tools for each server
  - Toggle individual tools on/off per conversation
  - Enable/disable all tools for a server with one click
  - Tools disabled by default for security
  - Tool enablement state saved with conversation
  - Visual feedback for server errors
  - Graceful handling of removed tools
  - Collapsible tool lists with expand/collapse arrow indicator
- Integration of MCP tools with AI message generation
  - Active tools passed to AI based on conversation settings
  - Tool calls displayed as separate messages in conversation
  - Tool message type with distinct styling (lighter background)
  - Shows tool name, call parameters, and results
  - Mock tool execution for demonstration

### Changed
- Refactored MCP tool integration to use AI SDK's built-in maxSteps feature
- Simplified tool handling by leveraging SDK's automatic tool execution
- Tool messages are now excluded from conversation history sent to AI (SDK handles internally)
- Limited tool calls to maximum 10 per turn using maxSteps parameter
- Message input now uses a textarea for multi-line message support
  - Enter key sends the message
  - Shift+Enter creates a new line
  - Auto-resizes based on content
- Moved settings gear icon next to the default model picker to clarify it configures model settings
- Extracted settings modal from App.tsx into separate SettingsModal component
- Separated MCP configuration into dedicated MCPSettingsModal component
- Removed "Conversations" title from the left sidebar for cleaner interface
- Updated settings to support multiple AI providers with provider dropdown
- Model fetching now uses provider-aware caching and base URLs

### Fixed
- TypeScript errors in MCP tool execution with proper type guards for tool results
- Type assertion for MCP tool arguments to match expected Record<string, unknown> type
- Switch to using `sh -c` for all MCP server commands instead of individual command permissions
- Simplify shell permissions to only allow `sh` with proper argument escaping
- Assistant responses not appearing after tool calls due to missing handling of 'text' stream events
- Tool results not being properly passed to follow-up AI calls for generating final responses
- Excessive model fetching requests by implementing failed fetch caching
- Model fetching errors with better error messages and retry functionality

## [0.2.1] - 2025-01-26

### Fixed
- TypeScript compilation errors preventing successful builds

## [0.2.0] - 2025-01-26

### Added
- Model selection functionality with dropdown components in sidebar and conversation headers
- Typeahead search for models with real-time filtering by name and description
- Global models cache with localStorage for improved performance (1-hour expiration)
- Keyboard navigation support in model selector (arrow keys, Enter, Escape)
- Auto-selection of first available model when no default is set
- Comprehensive test suite for model selection with 13+ test cases
- Cmd+N keyboard shortcut to create new conversations instantly
- Auto-focus functionality for message input when conversations are selected
- Markdown rendering support for assistant messages with full GitHub Flavored Markdown (GFM)
- Scroll-to-bottom button that appears when new content is below viewport

### Changed
- Streamlined UI by removing app header and moving settings to sidebar footer
- Repositioned New Conversation and Settings buttons to bottom of sidebar
- Updated New Conversation button styling to match Send button design
- Changed New Conversation button to secondary color for less visual prominence
- Removed border separator above footer buttons for cleaner appearance
- Moved default model selector to sidebar header next to "Conversations" title
- Model selector in sidebar shows "Default model (selected)" with ellipsis for overflow
- Conversation model selector width increased to 300px minimum for better visibility
- Cache invalidation when API base URL changes for proper model fetching
- Refactored state management to use Preact Signals for improved performance and simpler code
- Eliminated props drilling by allowing components to directly access shared state
- Simplified complex state updates with direct mutations instead of immutable patterns
- Replaced multiple useState hooks with centralized signal-based store
- Improved model caching with signal-based reactive cache management

### Fixed
- Model search filtering now works correctly with onInput event handler
- Models are sorted alphabetically for improved user experience
- Dropdown menu interaction bug where only the last conversation could be renamed or deleted
- Conversation scrolling no longer auto-scrolls when users are reading older messages
- Fixed localStorage persistence issue where settings and conversations were being overwritten with default values on app reload
- Fixed conversation model updates not properly triggering localStorage saves

## [0.1.0] - 2025-01-26

### Added
- Initial Tauri desktop application with Preact frontend
- AI chat interface with configurable OpenAI-compatible providers
- Settings modal for API configuration (base URL and API key)
- Local storage persistence for user settings
- Multiple conversation support with create, rename, and delete functionality
- Message streaming with real-time response display
- Dark mode UI with Tailwind CSS 4.1 styling
- Model Context Protocol (MCP) SDK integration
- Comprehensive test suite with Vitest (68+ passing tests)
- ESLint configuration with TypeScript and Preact plugins
- GitHub Actions CI/CD pipeline for automated testing
- GPL v3 license
- Project documentation in CLAUDE.md and README.md

### Changed
- Project renamed from "microchat" to "chatalyst"
- Migrated from custom CSS to Tailwind CSS 4.1 utility classes
- Updated to AI SDK 5.0 alpha architecture

### Developer Experience
- **Frontend**: Preact + TypeScript + Vite development setup
- **Backend**: Rust with Tauri framework
- **Package Management**: pnpm with locked dependencies
- **Testing**: Vitest with @testing-library/preact and jsdom
- **Linting**: ESLint with flat config format
- **CI/CD**: GitHub Actions for automated linting, testing, and type checking
- **Code Quality**: Rust formatting (rustfmt) and linting (clippy)

### Technical Details
- Frontend-backend communication via Tauri IPC system
- Responsive design with mobile and desktop support
- Error handling and loading states
- Conversation persistence across app restarts
- Type-safe interfaces for all data models

[Unreleased]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mcolyer-shopify/chatalyst/releases/tag/v0.1.0