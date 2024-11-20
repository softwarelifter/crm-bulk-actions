// jest.config.js
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/scripts/**",
    "!src/workers/**",
    "!src/config/**",
    "!src/**/*.d.ts",
  ],
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  testMatch: ["**/test/**/*.test.ts"],
  moduleDirectories: ["node_modules", "src"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  silent: false,
  verbose: true,
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
};
