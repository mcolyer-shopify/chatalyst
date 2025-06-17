## Development Workflow

### Feature Branch Development Flow

Follow this standard workflow for implementing new features or bug fixes:

#### 1. Create Feature Branch
```bash
# Start from main branch
git checkout main
git pull origin main

# Create and checkout feature branch
git checkout -b feature/your-feature-name
# or for bug fixes:
git checkout -b fix/bug-description
```

#### 2. Development Process
```bash
# Make your changes to the codebase
# Run development server for testing
pnpm tauri dev

# Run tests to ensure nothing breaks
pnpm test

# Check code quality before committing
pnpm lint
```

#### 3. Commit Changes
**Always update CHANGELOG.md first** before committing:

```bash
# 1. Update CHANGELOG.md with user-facing changes under [Unreleased]
# 2. Stage your changes
git add .

# 3. Check what will be committed
git status
git diff --staged

# 4. Create commit with descriptive message
git commit -m 'feat: Add retry button to user messages

- Add retry button with icon next to user message timestamps
- Remove subsequent messages and regenerate assistant response
- Include proper hover and active states for better UX

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>'
```

#### 4. Push and Create Pull Request
```bash
# Push feature branch to remote
git push -u origin feature/your-feature-name

# Create pull request using GitHub CLI
gh pr create --title "Add retry button to user messages" --body "$(cat <<'EOF'
## Summary
- Add retry button with icon next to user message timestamps
- Allow users to regenerate assistant responses from any point in conversation
- Remove all messages after selected user message and regenerate response

## Test plan
- [x] Verify retry button appears on user messages only
- [x] Test retry functionality removes subsequent messages
- [x] Confirm new assistant response generates correctly
- [x] Check button styling and hover states
- [x] Run full test suite and linting

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

#### 5. Code Review and Merge
```bash
# After PR approval and CI passes, merge via GitHub
# Or merge locally if preferred:
git checkout main
git pull origin main
git merge --no-ff feature/your-feature-name
git push origin main

# Clean up feature branch
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

### Git Commit Message Format

Follow this format for consistent commit messages:

```
<type>: <description>

<optional body with more details>

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Pre-Commit Checklist

Before every commit, ensure:
- [ ] CHANGELOG.md updated with user-facing changes
- [ ] Code follows project style guidelines
- [ ] All tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Application builds successfully (`pnpm build`)
- [ ] Manual testing completed for changed functionality

