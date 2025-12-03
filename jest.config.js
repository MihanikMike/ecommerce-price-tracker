export default {
  // Use ES modules
  transform: {},
  
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['./tests/setup/jest.setup.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/cli/**',
    '!src/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 15,
      lines: 15,
      statements: 15
    }
  },
  
  // Timeout for async tests
  testTimeout: 10000,
  
  // Run tests serially to avoid database conflicts
  maxWorkers: 1,
  
  // Force exit after tests complete (handles open handles)
  forceExit: true
};