# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Retry button for user messages
  - Retry button with icon appears next to timestamp on user messages
  - Clicking retry removes all subsequent messages and regenerates the assistant response
  - Always visible for better discoverability
  - Includes hover and active state animations for better user feedback
- Copy button for assistant messages
  - Copy button with clipboard icon appears next to timestamp on assistant messages
  - Clicking copies the message content to system clipboard
  - Always visible for easy access to assistant responses
  - Includes hover and active state animations for better user feedback
- Delete button for user messages
  - Delete button with trash icon appears next to retry button on user messages
  - Clicking delete removes the selected message and all messages after it
  - Includes confirmation dialog to prevent accidental deletions
  - Uses neutral black and white styling to match existing UI design
- New SSE transport type for MCP servers
  - Added dedicated Server-Sent Events (SSE) transport option in MCP settings
  - SSE transport uses specialized TauriSSESimulatedTransport to handle EventSource authentication limitations
  - Simulates tool responses for SSE-only servers that can't receive auth headers via EventSource
  - Includes proper input schemas for GitHub MCP tools (can be adapted for other SSE servers)
  - Clear distinction between HTTP (Streamable) and SSE transports
  - GitHub MCP server should now be configured as SSE transport type
  - Removed WebSocket transport option (not part of MCP specification)

### Fixed
- MCP Headers input validation issue in settings dialog
  - Fixed Headers input field not allowing text input due to overly strict validation
  - Added separate storage for raw header text to preserve partial input while typing
  - Headers input now behaves normally while still parsing complete key-value pairs correctly
- MCP HTTP server connections now use custom Tauri transports for remote servers
  - Implemented custom Transport classes that use Tauri's HTTP plugin to bypass CORS
  - Automatic detection of remote vs local servers (local servers use standard transports)
  - TauriStreamableHttpTransport and TauriSSETransport for remote MCP servers
  - Fixes authentication and CORS issues when connecting to servers like GitHub Copilot
  - Maintains proper MCP protocol implementation with correct initialization handshake
  - Automatic fallback from StreamableHTTP to SSE transport for maximum compatibility
  - GitHub MCP server now works correctly despite SSE-only response pattern
- Retry functionality now properly regenerates responses
  - Fixed issue where retry would remove messages but not generate new response
  - Retry now correctly reconstructs conversation context from filtered messages
  - Ensures AI receives clean conversation history up to retry point only
- Improved stop generation functionality
  - Stop button now properly cancels AI responses with visual feedback
  - Shows "Stopping..." state while cancellation is in progress
  - Preserves partial content and appends "(Generation stopped)" when cancelled
  - Input remains enabled during generation so users can type their next message
  - Simplified state management for more predictable behavior

## [1.1.0] - 2025-06-16

### Added
- Automatic conversation title generation
  - New "Generate Title" option in conversation dropdown menu
  - AI-powered title generation based on conversation content
  - Shows loading indicator while title is being generated
  - Only available for conversations with at least one message
- Archive functionality for conversations
  - Conversations can now be archived instead of permanently deleted
  - New "Archive" tab in the conversation list to view archived conversations
  - Archived conversations can be unarchived to restore them to the active list
  - Search functionality in the archive tab to easily find archived conversations
  - Archive option added to conversation dropdown menu
  - Automatic migration: existing conversations are marked as active when loaded

### Changed
- User messages now use markdown rendering to preserve newlines and formatting
  - Multi-line messages display properly with line breaks preserved
  - User messages support markdown formatting like bold, italic, and code blocks
  - Added appropriate CSS styling for markdown elements in user messages

### Changed
- Enhanced dropdown menu with outline icons
  - Added Heroicons-style outline icons to all menu items
  - Icons automatically adapt to light/dark mode using currentColor
  - Improved visual hierarchy and clarity of menu actions

### Fixed
- Fixed dropdown menu styling to prevent text wrapping
  - Increased minimum width from 120px to 150px
  - Added white-space: nowrap to menu buttons
  - "Generate Title" option now displays on a single line
- Fixed race condition where auto-scroll to new user messages would sometimes fail
  - Messages now reliably scroll to top of viewport when sent
  - Added retry logic to handle DOM update timing issues
  - Uses requestAnimationFrame for proper DOM update synchronization
  - Added comprehensive test coverage for the scrolling behavior

## [1.0.0] - 2025-05-30

### Added
- Dark mode support for MCP sidebar
  - All MCP sidebar elements now follow system dark mode preference
  - Consistent dark theme styling matching the main application
  
### Changed
- Simplified transport handling for MCP remote servers
  - Now uses official MCP SDK transports for all connection types:
    - StreamableHTTPClientTransport and SSEClientTransport for HTTP
    - WebSocketClientTransport for WebSocket connections
  - Automatically tries Streamable HTTP first, then falls back to SSE if needed
  - Removed all custom transport implementations in favor of SDK-provided ones
  - Simplified configuration - no need to manually select transport type
- Improved tool message handling for better user experience
  - Tool messages now appear immediately when a tool is called with "Calling tool..." status
  - Tool results update the existing message instead of creating a new one
  - Uses AI SDK's onChunk handler for real-time tool execution feedback

### Fixed
- HTTP transport compatibility for MCP remote servers
  - Fixes 404 errors when connecting to SSE endpoints
  - Automatic fallback from Streamable HTTP to SSE transport
  - Better error handling and logging during transport selection
  - Uses Tauri HTTP client plugin for proper CORS handling and security
- TypeScript errors with AI SDK message types
  - Updated to use CoreMessage type from AI SDK for proper type safety
  - Fixed incompatible message type errors in streamText responses
- Environment variables input in MCP settings modal
  - Replaced error-prone KEY=value textarea with user-friendly table interface
  - Environment variables can now be added, edited, and removed individually
  - Clear visual separation between variable names and values
  - Input validation prevents adding empty keys or values
- MCP configuration disappearing when reopening settings modal
  - Fixed state initialization to properly restore configuration when modal is shown
  - Configuration now persists correctly between modal open/close cycles

## [0.4.0] - 2025-01-29

### Added
- Support for remote MCP servers via HTTP and WebSocket transports
  - New transport dropdown in MCP Settings modal to select between Local Process (stdio), Remote HTTP, or Remote WebSocket
  - HTTP transport configuration with URL, headers, and timeout settings
  - WebSocket transport configuration with URL, headers, reconnect attempts, and reconnect delay
  - Automatic transport selection based on server configuration
  - Backwards compatibility maintained for existing stdio configurations
- Show MCP servers in unloaded state when configured but not yet started
- Visual indicator (dashed circle) for unloaded MCP servers with "Server not loaded" tooltip
- Hide/show sidebars with chevron toggle buttons
  - Left sidebar (conversations) can be collapsed with chevron pointing left
  - Right sidebar (MCP servers) can be collapsed with chevron pointing right  
  - Consistent circular floating button design for both hide and show toggles
  - All buttons positioned at center vertically on left/right edges for consistency
  - Buttons appear in same locations whether showing or hiding sidebars
  - Full dark mode support for all toggle buttons
- Maximum content width of 860px for improved readability
  - Applies to conversation messages, input field, and header
  - Content is centered when viewport is wider than max-width
  - Optimizes line length for better reading experience
- Enable/disable functionality for MCP servers in settings modal
  - Checkbox column in server list for quick enable/disable
  - Individual server enable/disable toggle in server details
  - Servers start/stop automatically based on enabled state when configuration is saved

### Changed
- Improved MCP Settings modal layout with narrower left panel and wider right panel
- Update TypeScript configuration to ES2023 for modern JavaScript features

### Fixed
- Clear error messages when switching between conversations
- Clear error messages when saving or canceling MCP settings modal
- Fix MCP server enable/disable functionality to properly maintain enabled servers when others are disabled
- Remove duplicate enable/disable checkbox from server details in MCP settings modal
- Remove excessive padding from server list header in MCP settings modal
- Fix scroll functionality in test environment by adding fallback for missing scrollTo method

## [0.3.3] - 2025-01-29

### Fixed
- Minor maintenance release with dependency updates and build improvements

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

[Unreleased]: https://github.com/mcolyer-shopify/chatalyst/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/mcolyer-shopify/chatalyst/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.4.0...v1.0.0
[0.4.0]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.3.1...v0.3.3
[0.3.1]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mcolyer-shopify/chatalyst/releases/tag/v0.1.0