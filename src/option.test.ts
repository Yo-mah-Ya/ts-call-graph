import path from "path";
import * as option from "./option";

describe("call-graph", () => {
  beforeEach(() => {
    process.argv = [
      "node",
      "path/to/file.js",
      "--config",
      "ts-source-visualizer.json",
    ];
  });

  describe("entry", () => {
    test("file", () => {
      jest.spyOn(option, "readConfig").mockImplementationOnce(() => ({
        entry: `${__dirname}${path.sep}option.ts`,
      }));
      expect(option.toOptions()).toStrictEqual({
        entry: [`${__dirname}${path.sep}option.ts`],
        rootDir: __dirname,
        verbose: false,
      });
    });
    test("directory", () => {
      jest.spyOn(option, "readConfig").mockImplementationOnce(() => ({
        entry: __dirname,
      }));
      expect(option.toOptions().entry.length).toBeGreaterThan(1);
    });
  });

  test("verbose", () => {
    jest.spyOn(option, "readConfig").mockImplementationOnce(() => ({
      entry: __dirname,
      verbose: true,
    }));
    expect(option.toOptions()).toHaveProperty("verbose", true);
  });
});
