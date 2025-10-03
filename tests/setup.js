// Test setup file for Jest
// This file runs before all tests

// Mock Firebase for testing
global.mockFirebase = {
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn(() => Promise.resolve()),
        get: jest.fn(() => Promise.resolve({ exists: true, data: () => ({}) })),
        update: jest.fn(() => Promise.resolve()),
        delete: jest.fn(() => Promise.resolve())
      })),
      add: jest.fn(() => Promise.resolve({ id: 'test-id' })),
      where: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ 
          docs: [], 
          forEach: jest.fn(),
          empty: true 
        }))
      }))
    }))
  },
  auth: {
    currentUser: { uid: 'test-user', email: 'test@example.com' },
    signInWithEmailAndPassword: jest.fn(() => Promise.resolve()),
    signOut: jest.fn(() => Promise.resolve())
  }
};

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock DOM methods commonly used in the app
Object.defineProperty(window, 'location', {
  value: { href: 'http://localhost/' },
  writable: true
});

// Mock local storage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  })
);

// Setup fake timers for tests that use setTimeout/setInterval
jest.useFakeTimers();