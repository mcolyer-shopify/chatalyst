import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
  length: 0,
  key: vi.fn()
};

global.localStorage = localStorageMock as any;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock Tauri APIs
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => Promise.resolve()),
  emit: vi.fn().mockResolvedValue(undefined),
  once: vi.fn().mockResolvedValue(() => Promise.resolve())
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    innerSize: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    outerSize: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    innerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
    outerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
    setSize: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    onResized: vi.fn().mockResolvedValue(() => Promise.resolve()),
    onMoved: vi.fn().mockResolvedValue(() => Promise.resolve()),
    isMaximized: vi.fn().mockResolvedValue(false),
    isMinimized: vi.fn().mockResolvedValue(false),
    isFullscreen: vi.fn().mockResolvedValue(false),
    isVisible: vi.fn().mockResolvedValue(true),
    isFocused: vi.fn().mockResolvedValue(true)
  })
}));

vi.mock('@tauri-apps/api/dpi', () => ({
  PhysicalSize: class {
    constructor(public width: number, public height: number) {}
  },
  PhysicalPosition: class {
    constructor(public x: number, public y: number) {}
  },
  LogicalSize: class {
    constructor(public width: number, public height: number) {}
  },
  LogicalPosition: class {
    constructor(public x: number, public y: number) {}
  }
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  transformCallback: vi.fn().mockImplementation((callback) => callback)
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: class {
    constructor() {}
    spawn() { return Promise.resolve(); }
    execute() { return Promise.resolve({ code: 0, stdout: '', stderr: '' }); }
  }
}));

// Note: __TAURI_INTERNALS__ is not defined by default in tests,
// so isTauri() will return false, which is correct for test environment

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});