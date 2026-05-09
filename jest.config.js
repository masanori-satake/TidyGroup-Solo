/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  transform: {},
  collectCoverageFrom: [
    'projects/extension/js/**/*.js'
  ],
  coverageReporters: ['text', 'lcov', 'json-summary']
};

export default config;
