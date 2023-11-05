import * as fs from "fs";
import * as ts from "typescript";

export const createLanguageService = (
  rootFileNames: string[],
  options: ts.CompilerOptions,
): ts.LanguageService => {
  const files: ts.MapLike<{ version: number }> = {};

  // initialize the list of files
  rootFileNames.forEach((fileName) => {
    files[fileName] = { version: 0 };
  });

  // Create the language service host to allow the LS to communicate with the host
  const servicesHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => rootFileNames,
    getScriptVersion: (fileName) => files[fileName]?.version.toString(),
    getScriptSnapshot: (fileName) => {
      if (!fs.existsSync(fileName)) {
        return undefined;
      }

      return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
    },
    getCurrentDirectory: () => process.cwd(),
    getCompilationSettings: () => options,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: (path: string) => ts.sys.fileExists(path),
    readFile: (path: string, encoding?: string) =>
      ts.sys.readFile(path, encoding),
    readDirectory: (
      path: string,
      extensions?: readonly string[],
      exclude?: readonly string[],
      include?: readonly string[],
      depth?: number,
    ) => ts.sys.readDirectory(path, extensions, exclude, include, depth),
    directoryExists: (directoryName: string) =>
      ts.sys.directoryExists(directoryName),
    getDirectories: (directoryName: string) =>
      ts.sys.getDirectories(directoryName),
  };

  // Create the language service files
  return ts.createLanguageService(servicesHost, ts.createDocumentRegistry());
};
