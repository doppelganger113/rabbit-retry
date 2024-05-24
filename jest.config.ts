import type { Config } from '@jest/types';

const isCI = !!process.env.CI;
const reporters = ['default'];

if (isCI) {
  reporters.push('jest-junit');
}

const config: Config.InitialOptions = {
  reporters,
  verbose: true,
  collectCoverage: isCI,
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/index.(t|j)s', '!**/*.dto.(t|j)s'],
  coverageDirectory: '../coverage',
  coverageReporters: isCI ? ['cobertura'] : ['html'],
  testEnvironment: 'node',
};

export default config;
