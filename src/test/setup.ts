import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
  length: 0,
  key: vi.fn(),
};

global.localStorage = localStorageMock as any;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});