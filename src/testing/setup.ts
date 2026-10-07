import '@testing-library/jest-dom';

// Mock localStorage for tests
const localStorageMock = (() => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key]);
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
