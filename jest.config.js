/**
 * @type {import("ts-jest").JestConfigWithTsJest}
 */
module.exports = {
  collectCoverage: true,
  coverageDirectory: "coverage",
  testRegex: "test.ts$",
  transform: {
    ".ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  transformIgnorePatterns: ["build", "coverage"],
  verbose: true,
};
