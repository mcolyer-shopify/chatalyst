# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a Tauri desktop application using:
- **Frontend**: Preact + TypeScript + Vite
- **Backend**: Rust (via Tauri)
- **Package Manager**: pnpm

## Development Commands

### Running the Application
```bash
pnpm tauri dev      # Run desktop app in development mode
pnpm dev           # Run Vite dev server only (frontend)
```

### Building
```bash
pnpm build         # Build frontend assets
pnpm tauri build   # Build complete desktop application
```

### Mobile Development
```bash
pnpm tauri android init    # Initialize Android support
pnpm tauri ios init        # Initialize iOS support
```

### Testing

#### Frontend Testing
The project uses Vitest for frontend testing with the following commands:
```bash
pnpm test              # Run tests once
pnpm test:watch        # Run tests in watch mode
pnpm test:ui           # Run tests with UI interface
pnpm test:coverage     # Run tests with coverage report
```

Frontend tests use:
- **Vitest** - Test runner and assertion library
- **@testing-library/preact** - Testing utilities for Preact components
- **@testing-library/jest-dom** - Additional DOM matchers
- **jsdom** - DOM implementation for Node.js

#### Backend Testing
Rust tests are run using Cargo:
```bash
cd src-tauri
cargo test             # Run all Rust tests
cargo test -- --nocapture  # Run tests with console output
```

### Code Quality

#### Linting
The project uses ESLint for frontend code quality:
```bash
pnpm lint              # Check for linting errors
pnpm lint:fix          # Automatically fix linting errors
```

ESLint is configured with:
- **TypeScript ESLint** - TypeScript-specific linting rules
- **Preact ESLint Plugin** - Preact-specific rules
- **Flat config** - Modern ESLint configuration format (eslint.config.js)

### Continuous Integration

The project uses GitHub Actions for automated testing and code quality checks:

#### Frontend CI (`.github/workflows/ci.yml`)
- **ESLint** - Code linting and style checks
- **TypeScript** - Type checking via build process
- **Vitest** - Unit tests with coverage reporting
- **Coverage** - Automatic upload to Codecov (if configured)

#### Backend CI (Rust)
- **rustfmt** - Code formatting checks
- **clippy** - Rust linting and suggestions
- **cargo test** - Unit tests

The CI pipeline runs on:
- All pushes to `main` branch
- All pull requests targeting `main`

## Architecture

### Directory Structure
- `/src/` - Frontend Preact components and TypeScript code
- `/src-tauri/` - Rust backend code and Tauri configuration
- `/public/` - Static assets served directly

### Communication Pattern
Frontend and backend communicate through Tauri's IPC system:
- Frontend calls Rust functions using `invoke()` from `@tauri-apps/api/core`
- Backend exposes functions with `#[tauri::command]` macro
- Commands are registered in `src-tauri/src/lib.rs`

### Key Configuration Files
- `vite.config.ts` - Vite configuration (dev server on port 1420)
- `src-tauri/tauri.conf.json` - Tauri app configuration (window settings, app metadata)
- `tsconfig.json` - TypeScript configuration (strict mode, Preact JSX)