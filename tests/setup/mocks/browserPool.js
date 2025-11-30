import { jest } from '@jest/globals';

export const mockBrowserPool = {
  initialize: jest.fn().mockResolvedValue(undefined),
  acquire: jest.fn().mockResolvedValue({
    newContext: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        goto: jest.fn(),
        content: jest.fn(),
        close: jest.fn()
      }),
      close: jest.fn()
    })
  }),
  release: jest.fn(),
  closeAll: jest.fn(),
  getStats: jest.fn().mockReturnValue({
    size: 3,
    currentInUse: 0
  })
};