module.exports = {
  clearMocks: true,
  collectCoverage: !!process.env.PULL_REQUEST,
  fakeTimers: {
    legacyFakeTimers: true,
  },
  // The package's own subpaths resolve to source; the dist tests clear this (jest.config.build.js).
  moduleNameMapper: {
    '^styled-components$': '<rootDir>/src/index.ts',
    '^styled-components/server-styles$': '<rootDir>/src/server-styles.ts',
  },
  restoreMocks: true,
  rootDir: '.',
  snapshotSerializers: ['jest-serializer-html'],
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/', '/\\.rollup\\.cache/'],
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],
};
