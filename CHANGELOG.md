# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Streamlined UI by removing app header and moving settings to sidebar footer
- Repositioned New Conversation and Settings buttons to bottom of sidebar
- Updated New Conversation button styling to match Send button design
- Changed New Conversation button to secondary color for less visual prominence
- Removed border separator above footer buttons for cleaner appearance

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

[Unreleased]: https://github.com/mcolyer-shopify/chatalyst/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mcolyer-shopify/chatalyst/releases/tag/v0.1.0