const baseConfig = require('./jest.config.base');

module.exports = Object.assign({}, baseConfig, {
  // The dist tests resolve the package's own name through the root workspace link to the built files.
  moduleNameMapper: {},
  roots: ['<rootDir>/src/test/'],
  testMatch: ['**/treeshake.test.ts', '**/dist-behavior.test.js'],
  testEnvironment: 'node',
});
