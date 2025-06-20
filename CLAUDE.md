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

**Note:** Only run linting directly before committing code. During development and iterative changes, focus on functionality first and address linting issues as a final step before commit.

**IMPORTANT:** When committing changes, always update CHANGELOG.md first by adding user-facing changes under the `## [Unreleased]` section before creating the commit.

ESLint is configured with:
- **TypeScript ESLint** - TypeScript-specific linting rules
- **Preact ESLint Plugin** - Preact-specific rules
- **Flat config** - Modern ESLint configuration format (eslint.config.js)

#### Code Style Guidelines
When writing code, follow these ESLint-enforced style rules:

**TypeScript & JavaScript:**
- Use **single quotes** for strings: `'hello'` not `"hello"`
- Use **semicolons** to end statements: `const x = 1;`
- Use **2-space indentation** consistently
- **No trailing commas** in objects/arrays: `{ a: 1, b: 2 }` not `{ a: 1, b: 2, }`
- Avoid `any` type - use specific types or `unknown` with type guards
- Prefer `console.error()` over `console.log()` for error logging, but avoid console statements in production code

**Testing:**
- Use `global.fetch` instead of `fetch` in tests when mocking
- Type mocked functions properly: `(global.fetch as ReturnType<typeof vi.fn>)`
- Avoid `any` in test code - use proper typing for mocks

**Browser APIs:**
- `fetch`, `localStorage`, `window`, `document`, `requestAnimationFrame` are available as globals
- No need to import or declare these browser APIs

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

#### Release Workflow (`.github/workflows/release.yml`)
Automated release builds for macOS:
- **Triggers**: On git tag pushes (format: `v*`)
- **Platforms**: macOS (both Intel and Apple Silicon)
- **Artifacts**: DMG and .app.tar.gz files
- **Distribution**: Automatically uploaded to GitHub Releases

To create a release:
```bash
git tag v1.0.0
git push origin v1.0.0
```

**Create the GitHub release with changelog content:**
1. Extract the relevant changelog section from `CHANGELOG.md` for the version
2. Create the GitHub release with the changelog content:
```bash
# Example for v1.0.0 - replace with actual changelog content
gh release create v1.0.0 --title "v1.0.0" --notes "$(cat <<'EOF'
## What's New in v1.0.0

### Added
- Feature descriptions from changelog

### Changed
- Changes from changelog

### Fixed
- Bug fixes from changelog
EOF
)"
```

**Note:** The automated release workflow may create binaries and attach them to the release, or you can manually build and upload them if needed.

### Documentation Maintenance

#### Changelog (`CHANGELOG.md`)
The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format:

**When making changes, always update the changelog:**
1. Add new entries under `## [Unreleased]` section for user-facing changes only
2. Use appropriate categories: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`
3. Write clear, user-focused descriptions of changes
4. **Exclude chores** like CI updates, documentation changes, or development tooling
5. When releasing, move unreleased changes to a new version section
6. Update version links at the bottom of the file

**Example entry format:**
```markdown
## [Unreleased]

### Added
- New feature description

### Changed  
- Modified feature description

### Fixed
- Bug fix description
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

