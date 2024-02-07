import type { Config } from 'jest'

const config: Config = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  modulePathIgnorePatterns: ['<rootDir>/.homeybuild/'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/.homeybuild/', '<rootDir>/node_modules/'],
}

export default config
