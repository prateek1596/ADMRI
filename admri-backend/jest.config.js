// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch:       ['**/tests/**/*.test.js'],
  testTimeout:     15000,
  verbose:         true,
  forceExit:       true,
  clearMocks:      true,
};
