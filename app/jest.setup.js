import '@testing-library/jest-dom';

if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = () => Promise.reject(new Error('fetch is not available in Jest'));
}

globalThis.Headers ??= class Headers {};
globalThis.Request ??= class Request {};
globalThis.Response ??= class Response {};
