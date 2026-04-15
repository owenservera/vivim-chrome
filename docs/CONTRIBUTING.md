# Contributing to VIVIM Extension

Thank you for your interest in contributing to VIVIM Extension! This document provides guidelines and information for contributors.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Code Guidelines](#code-guidelines)
4. [Pull Request Process](#pull-request-process)
5. [Testing](#testing)
6. [Documentation](#documentation)
7. [Issue Reporting](#issue-reporting)
8. [Community Guidelines](#community-guidelines)

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18+ (LTS recommended)
- **npm**: v8+ or **yarn**: v1.22+
- **Chrome**: v100+ for testing
- **Git**: For version control

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/vivim-extension.git
   cd vivim-extension
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/vivim-org/vivim-extension.git
   ```

### Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

4. Verify the setup:
   - The VIVIM icon should appear in your toolbar
   - Open the side panel to see the interface
   - Try sending a test message

---

## Development Workflow

### Branch Naming

Use descriptive branch names following this pattern:

```
feature/description-of-feature
fix/issue-number-description
docs/update-documentation
refactor/component-name-improvements
```

**Examples:**
- `feature/youtube-subtitle-extraction`
- `fix/chat-streaming-timeout-issue`
- `docs/update-api-reference`

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style/formatting
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance

**Scopes:**
- `ui`: User interface components
- `api`: API integrations
- `storage`: Data storage
- `streaming`: Stream processing
- `providers`: AI provider integrations
- `build`: Build system

**Examples:**
```
feat(ui): add dark mode toggle to settings
fix(streaming): resolve timeout issue in OpenAI provider
docs(api): update provider interface documentation
refactor(chat): simplify message rendering logic
test(providers): add unit tests for Anthropic integration
```

### Keeping Up to Date

Regularly sync with upstream:

```bash
# Fetch latest changes
git fetch upstream

# Merge main branch
git checkout main
git merge upstream/main

# Update your feature branch
git checkout your-feature-branch
git rebase main
```

---

## Code Guidelines

### TypeScript Standards

- Use strict type checking (`"strict": true`)
- Avoid `any` type - use proper type definitions
- Use interfaces for object shapes
- Use enums for fixed value sets
- Prefer `const` assertions for literals

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
} as const;

// ❌ Avoid
function processUser(user: any) {
  // ...
}
```

### React Best Practices

- Use functional components with hooks
- Implement proper error boundaries
- Use custom hooks for shared logic
- Follow component composition patterns
- Prefer controlled components

```typescript
// ✅ Good
function ChatInput({ onSend, disabled }) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSend(message);
    setMessage('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !message.trim()}>
        Send
      </button>
    </form>
  );
}

// ❌ Avoid
class ChatInput extends Component {
  constructor(props) {
    super(props);
    this.state = { message: '' };
  }

  handleSubmit(e) {
    // ...
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit.bind(this)}>
        {/* ... */}
      </form>
    );
  }
}
```

### Code Style

- Use Prettier for consistent formatting
- Follow ESLint rules
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

```typescript
/**
 * Sends a chat message to the AI provider
 * @param conversationId - The conversation ID
 * @param content - The message content
 * @param options - Additional options
 * @returns Promise resolving to the message result
 */
async function sendChatMessage(
  conversationId: string,
  content: string,
  options: SendOptions = {}
): Promise<MessageResult> {
  // Implementation
}
```

### File Organization

```
src/
├── background/          # Service worker
│   ├── providers/       # AI provider implementations
│   ├── services/        # Core services
│   └── index.ts         # Entry point
├── ui/                  # React components
│   ├── components/      # Reusable components
│   ├── pages/           # Page components
│   ├── hooks/           # Custom hooks
│   └── contexts/        # React contexts
├── content/             # Content scripts
├── lib/                 # Utilities
├── types/               # TypeScript definitions
└── utils/               # Helper functions
```

### Error Handling

- Use proper error types and messages
- Implement graceful degradation
- Log errors appropriately
- Provide user-friendly error messages

```typescript
try {
  const result = await apiCall();
  return result;
} catch (error) {
  if (error instanceof APIError) {
    // Handle API-specific errors
    showUserError('API request failed. Please check your connection.');
    return null;
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);
  showUserError('An unexpected error occurred. Please try again.');

  // Re-throw for higher-level handling
  throw error;
}
```

---

## Pull Request Process

### Before Submitting

1. **Test your changes** thoroughly
2. **Update documentation** if needed
3. **Add tests** for new functionality
4. **Run the linter**: `npm run lint`
5. **Run tests**: `npm test`
6. **Build successfully**: `npm run build`

### Creating a Pull Request

1. **Push your branch** to your fork
2. **Create PR** from your branch to `main`
3. **Fill out the PR template**:
   - Clear title and description
   - Reference related issues
   - List breaking changes
   - Screenshots for UI changes

### PR Review Process

1. **Automated checks** run (linting, tests, build)
2. **Code review** by maintainers
3. **Address feedback** and push updates
4. **Approval** and merge

### PR Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Fixes #123, Addresses #456

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Breaking changes documented
```

---

## Testing

### Unit Testing

Write unit tests for all new functionality:

```typescript
// src/background/services/__tests__/conversation-manager.test.ts
import { ConversationManager } from '../conversation-manager';

describe('ConversationManager', () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  it('should create a new conversation', async () => {
    const conversation = await manager.createConversation('Test Chat', 'gpt-4');

    expect(conversation.title).toBe('Test Chat');
    expect(conversation.model).toBe('gpt-4');
    expect(conversation.messages).toEqual([]);
  });

  it('should throw error for invalid conversation ID', async () => {
    await expect(manager.getConversation('invalid-id')).rejects.toThrow();
  });
});
```

### End-to-End Testing

Use Playwright for E2E tests:

```typescript
// e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test('should send and receive messages', async ({ page, extensionId }) => {
  // Load extension
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  // Send message
  await page.fill('[data-testid="message-input"]', 'Hello AI');
  await page.click('[data-testid="send-button"]');

  // Verify response
  await page.waitForSelector('[data-testid="ai-response"]');
  const response = await page.textContent('[data-testid="ai-response"]');
  expect(response.length).toBeGreaterThan(0);
});
```

### Testing Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run tests for specific file
npm test -- conversation-manager.test.ts
```

### Test Coverage Requirements

- **Minimum coverage**: 80% overall
- **Critical paths**: 90% coverage
- **New features**: 100% coverage for new code
- **UI components**: Include accessibility testing

---

## Documentation

### When to Update Documentation

- Adding new features
- Changing existing APIs
- Fixing user-facing behavior
- Adding new configuration options

### Documentation Files

- **README.md**: Main project documentation
- **USER_GUIDE.md**: User-facing documentation
- **DEVELOPER_GUIDE.md**: Technical documentation for developers
- **API_REFERENCE.md**: Complete API documentation
- **CHANGELOG.md**: Version history and changes

### Documentation Standards

- Use clear, concise language
- Include code examples
- Provide screenshots for UI changes
- Keep examples up-to-date
- Use consistent formatting

---

## Issue Reporting

### Bug Reports

When reporting bugs, please include:

1. **Clear title** describing the issue
2. **Steps to reproduce** the problem
3. **Expected behavior** vs. actual behavior
4. **Environment information**:
   - VIVIM version
   - Chrome version
   - Operating system
   - AI provider used
5. **Screenshots** or screen recordings
6. **Console logs** if applicable
7. **Additional context**

### Feature Requests

For feature requests, include:

1. **Clear description** of the proposed feature
2. **Use case** and problem it solves
3. **Proposed solution** or implementation approach
4. **Alternatives considered**
5. **Additional context** or mockups

### Issue Labels

- `bug`: Something isn't working
- `enhancement`: New feature or improvement
- `documentation`: Documentation issues
- `question`: Questions or discussions
- `help wanted`: Good for newcomers
- `good first issue`: Suitable for first-time contributors

---

## Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers learn and contribute
- Maintain professional communication
- Respect differing opinions

### Getting Help

- **Documentation**: Check existing docs first
- **GitHub Issues**: Search for similar issues
- **Discussions**: Ask questions in discussions
- **Discord**: Join our community chat

### Recognition

Contributors are recognized through:
- GitHub contributor statistics
- Mention in release notes
- Contributor spotlight in documentation
- Invitation to become a maintainer (for significant contributions)

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Discord**: Real-time community chat
- **Twitter**: Announcements and updates

---

Thank you for contributing to VIVIM Extension! Your contributions help make AI more accessible and private for everyone.

For questions or help getting started, please reach out through [GitHub Discussions](https://github.com/vivim-org/vivim-extension/discussions) or our [Discord community](https://discord.gg/vivim).</content>
<parameter name="filePath">CONTRIBUTING.md