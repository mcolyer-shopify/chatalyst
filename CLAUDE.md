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