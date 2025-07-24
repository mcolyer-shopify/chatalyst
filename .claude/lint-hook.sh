#!/usr/bin/env bash

# Claude Code linting hook
# Runs after file Write/Edit operations to ensure code quality

set -e

# Read input data from stdin
input_data=$(cat)

# Extract file path from the tool input
file_path=$(echo "$input_data" | grep -o '"file_path":"[^"]*"' | sed 's/"file_path":"\([^"]*\)"/\1/' | head -1)

# Only lint TypeScript/JavaScript files
if [[ "$file_path" =~ \.(ts|tsx|js|jsx)$ ]]; then
    echo "Running ESLint on $file_path..." >&2
    
    # Change to project directory
    cd "$(dirname "$0")/.."
    
    # Run ESLint on the specific file
    if ! pnpm lint "$file_path" 2>&1; then
        echo "❌ Linting failed for $file_path" >&2
        echo "💡 Run 'pnpm lint:fix' to auto-fix issues, or fix manually before committing" >&2
        exit 2  # Exit code 2 blocks the operation
    fi
    
    echo "✅ Linting passed for $file_path" >&2
fi

exit 0