# MediaSite Testing Guide 🧪

## Overview

MediaSite now has a comprehensive testing framework using **Jest** and **React Testing Library**. Tests ensure your code works correctly and catch bugs before they reach production.

---

## Running Tests

### Watch Mode (Development)
```bash
npm test
```
Runs tests in watch mode. Tests re-run automatically when you save files.

### Single Run (CI/CD)
```bash
npm run test:ci
```
Runs all tests once. Perfect for CI/CD pipelines.

### Coverage Report
```bash
npm run test:coverage
```
Generates a test coverage report showing which code is tested.

---

## Test Structure

```
__tests__/
├── test-utils.ts          # Mock data and test helpers
├── lib/
│   ├── auth.test.ts       # Password hashing tests
│   ├── file-validation.test.ts  # File upload security tests
│   └── safe-auth.test.ts  # Auth wrapper tests
└── components/
    └── VideoCard.test.tsx # Component tests
```

---

## Writing Your First Test

### Example: Testing a Utility Function

```typescript
// lib/utils.ts
export function formatViews(views: number): string {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}

// __tests__/lib/utils.test.ts
import { formatViews } from '@/lib/utils';

describe('formatViews', () => {
  it('formats views under 1000', () => {
    expect(formatViews(500)).toBe('500');
  });

  it('formats views in thousands', () => {
    expect(formatViews(1500)).toBe('1.5K');
  });

  it('formats views in millions', () => {
    expect(formatViews(2500000)).toBe('2.5M');
  });
});
```

### Example: Testing an API Route

```typescript
// __tests__/api/media/like.test.ts
import { POST } from '@/app/api/media/[id]/like/route';
import { mockSession, createMockRequest } from '@/__tests__/test-utils';

jest.mock('@/lib/safe-auth', () => ({
  safeAuth: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  prisma: mockPrisma,
}));

describe('POST /api/media/[id]/like', () => {
  it('likes a video when authenticated', async () => {
    safeAuth.mockResolvedValue(mockSession);
    mockPrisma.like.create.mockResolvedValue({ id: 'like-123' });

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/media/video-123/like',
    });

    const response = await POST(request, { params: { id: 'video-123' } });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.liked).toBe(true);
  });

  it('requires authentication', async () => {
    safeAuth.mockResolvedValue(null);

    const request = createMockRequest({ method: 'POST' });
    const response = await POST(request, { params: { id: 'video-123' } });

    expect(response.status).toBe(401);
  });
});
```

---

## Test Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| **Critical Paths** | 90% | Setup |
| **API Routes** | 80% | Setup |
| **Utilities** | 90% | Setup |
| **Components** | 70% | Setup |
| **Overall** | 75% | Setup |

---

## What to Test

### ✅ DO Test

1. **Critical User Flows**
   - Sign up / Login
   - Upload video
   - Like / Comment
   - Watch history

2. **Security Functions**
   - File validation
   - Password hashing
   - Auth checks
   - Input sanitization

3. **Business Logic**
   - Recommendation algorithm
   - View count formatting
   - Duration calculations

4. **Error Handling**
   - Invalid inputs
   - Database errors
   - Network failures

### ❌ DON'T Test

1. **Third-party Libraries**
   - Next.js internals
   - Prisma queries
   - React itself

2. **Trivial Code**
   - Simple getters/setters
   - Constant exports

3. **Implementation Details**
   - Internal component state
   - CSS styles

---

## Best Practices

### 1. Test Behavior, Not Implementation

**❌ Bad:**
```typescript
it('sets state to loading', () => {
  expect(component.state.loading).toBe(true);
});
```

**✅ Good:**
```typescript
it('shows loading spinner', () => {
  render(<Component />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});
```

### 2. Use Descriptive Test Names

**❌ Bad:**
```typescript
it('works', () => { /* ... */ });
```

**✅ Good:**
```typescript
it('displays error message when password is too short', () => { /* ... */ });
```

### 3. Arrange-Act-Assert Pattern

```typescript
it('likes a video', async () => {
  // Arrange: Set up test data
  const video = createMockVideo();
  const user = createMockUser();

  // Act: Perform the action
  const result = await likeVideo(video.id, user.id);

  // Assert: Check the result
  expect(result.liked).toBe(true);
});
```

### 4. Keep Tests Independent

Each test should run in isolation. Don't rely on other tests' side effects.

```typescript
beforeEach(() => {
  // Reset mocks and database state
  jest.clearAllMocks();
  resetDatabase();
});
```

---

## Common Testing Patterns

### Mocking Prisma

```typescript
const mockPrisma = {
  media: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@/lib/database', () => ({
  prisma: mockPrisma,
}));
```

### Mocking Authentication

```typescript
jest.mock('@/lib/safe-auth', () => ({
  safeAuth: jest.fn(() => Promise.resolve(mockSession)),
}));
```

### Testing Async Functions

```typescript
it('fetches recommendations', async () => {
  const data = await fetchRecommendations();
  
  expect(data).toHaveLength(20);
  expect(data[0]).toHaveProperty('title');
});
```

### Testing Error Cases

```typescript
it('handles database errors gracefully', async () => {
  mockPrisma.media.findMany.mockRejectedValue(new Error('DB Error'));

  const result = await getMedia();

  expect(result.error).toBe('Failed to fetch media');
});
```

---

## Debugging Tests

### Run a Single Test File
```bash
npm test -- file-validation.test.ts
```

### Run Tests Matching a Pattern
```bash
npm test -- --testNamePattern="authentication"
```

### Show Console Logs
```bash
npm test -- --verbose
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal"
}
```

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run test:ci
      - run: npm run test:coverage
```

---

## Next Steps

1. **Write tests for new features** before implementing them (TDD)
2. **Achieve 50% coverage** in the next sprint
3. **Add integration tests** for critical user flows
4. **Set up CI/CD** to run tests automatically
5. **Add E2E tests** with Playwright for full user scenarios

---

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)

---

## Questions?

Run into issues? Check:
1. Is the mock data correct in `test-utils.ts`?
2. Are all imports using `@/` alias?
3. Is Jest properly configured in `jest.config.js`?
4. Are you mocking external dependencies (Prisma, NextAuth)?

Happy testing! 🎉
