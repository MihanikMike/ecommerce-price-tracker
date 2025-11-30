import { jest } from '@jest/globals';

export const mockPage = {
  goto: jest.fn().mockResolvedValue(undefined),
  content: jest.fn().mockResolvedValue('<html></html>'),
  evaluate: jest.fn().mockResolvedValue(null),
  waitForSelector: jest.fn().mockResolvedValue(null),
  waitForLoadState: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  $: jest.fn().mockResolvedValue(null),
  $$: jest.fn().mockResolvedValue([]),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('')),
};

export const mockContext = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined),
  setDefaultTimeout: jest.fn(),
};

export const mockBrowser = {
  newContext: jest.fn().mockResolvedValue(mockContext),
  close: jest.fn().mockResolvedValue(undefined),
  isConnected: jest.fn().mockReturnValue(true),
};

export const chromium = {
  launch: jest.fn().mockResolvedValue(mockBrowser),
};

export default {
  chromium,
  mockBrowser,
  mockContext,
  mockPage,
};
