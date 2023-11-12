import { existsSync, lstatSync, readFileSync, readdirSync } from "fs";
import { EOL } from "os";
import path from "path";
import ts from "typescript";
import yargs from "yargs";

export type Option = {
  entry: string[];
  format: string;
  outDir: string;
  rootDir: string;
  declaration: boolean;
  verbose: boolean;
  line?: number;
  compilerOptions?: ts.CompilerOptions;
};

export const jsonToCompilerOptions = (tsconfig: string): ts.CompilerOptions => {
  const res = ts.parseJsonConfigFileContent(
    JSON.parse(readFileSync(tsconfig, { encoding: "utf-8" })) as unknown,
    ts.sys,
    path.dirname(tsconfig),
  );
  if (res.errors.length) {
    throw new Error(res.errors.join(EOL));
  }
  return res.options;
};

const getRootFileNames = (directory: string): string[] =>
  readdirSync(directory, { recursive: true })
    .map((f) => path.join(directory, f.toString()))
    .filter((fileName) =>
      [".ts", ".tsx", ".js", ".jsx"].some((extension) =>
        fileName.toLowerCase().endsWith(extension),
      ),
    );

export const toOptions = (): Option => {
  const argv = yargs(process.argv.slice(2))
    .coerce("_", (argv) => {
      const p = argv as string[];
      if (!p.length || typeof p[0] !== "string" || !existsSync(p[0])) {
        throw new Error("should be passed entry file or directory path");
      }

      return [path.resolve(p[0])];
    })
    .check((argv) => {
      const entry = argv._[0];
      const typedArgv = argv as unknown as Option;

      if (!entry.includes(typedArgv.rootDir)) {
        throw new Error(
          "Entry file or directory is supposed to be a descendant of given directory specified with rootDir",
        );
      }
      return true;
    })
    .options("rootDir", {
      alias: "r",
      describe:
        "root directory where we'll recursively walk through source files. Default directory is current working directory.",
      default: process.cwd(),
      type: "string",
    })
    .option("outDir", {
      alias: "o",
      describe: "output directory",
      default: `${process.cwd()}/output`,
      type: "string",
    })
    .option("tsconfig", {
      describe: "path to tsconfig.json which is TypeScript transpile config",
      coerce: (tsconfig) => {
        if (typeof tsconfig !== "string") return undefined;
        if (!lstatSync(tsconfig).isFile() || !tsconfig.endsWith(".json")) {
          throw new Error(
            "Existing tsconfig json file path should be passed to --tsconfig",
          );
        }

        return {
          compilerOptions: jsonToCompilerOptions(path.resolve(tsconfig)),
        };
      },
      type: "string",
    })
    .option("format", {
      alias: "f",
      describe: "out put format",
      default: "svg",
      // https://graphviz.org/docs/outputs/
      choices: [
        "jpg", // JPEG
        "jpeg",
        "jpe",
        "jp2", // JPEG 2000
        "pdf", // PDF
        "png", // PNG
        "ps", // Adobe PostScript
        "ps2", // PS/PDF
        "psd", // Photoshop
        "sgi", // Silicon Graphics Image
        "svg", // SVG
        "svgz",
        "webp", // WebP
      ],
      type: "string",
    })
    .option("declaration", {
      alias: "d",
      describe: "is include declaration",
      default: false,
      type: "boolean",
    })
    .option("verbose", {
      alias: "v",
      describe: "Use verbose output",
      default: false,
      type: "boolean",
    })
    .option("line", {
      alias: "l",
      describe: "The line number where call graph starts",
      default: undefined,
      coerce: (line) => {
        if (line == undefined) return undefined;
        if (Number.isNaN(Number(line))) {
          throw new Error("--line parameter should be typeof number");
        }
        return line as number;
      },
      type: "number",
    })
    .help().argv as Omit<Option, "entry"> & {
    _: string[];
    tsconfig: { compilerOptions: ts.CompilerOptions };
  };

  const option: Option = {
    format: argv.format,
    outDir: argv.outDir.endsWith(path.sep)
      ? argv.outDir
      : `${argv.outDir}${path.sep}`,
    rootDir: argv.rootDir.endsWith(path.sep)
      ? argv.rootDir
      : `${argv.rootDir}${path.sep}`,
    entry: lstatSync(argv._[0]).isDirectory()
      ? getRootFileNames(argv._[0])
      : [argv._[0]],
    declaration: argv.declaration,
    verbose: argv.verbose,
    line: argv.line,
    compilerOptions: argv.tsconfig.compilerOptions,
  };
  if (option.verbose) {
    console.log("passed option");
    console.log(option);
  }
  return option;
};
