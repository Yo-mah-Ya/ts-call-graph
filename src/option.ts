import { existsSync, lstatSync, readFileSync, readdirSync } from "fs";
import path from "path";
import yargs from "yargs";
import * as t from "io-ts";
import { isRight } from "fp-ts/lib/Either";
import { PathReporter } from "io-ts/lib/PathReporter";

const withDefaultDir = (
  defaultValue: t.TypeOf<t.StringC>,
): t.Type<string, string, unknown> =>
  new t.Type<string, string, unknown>(
    "string",
    (input: unknown): input is string =>
      typeof input === "string" && existsSync(input),
    (input, context) => {
      if (typeof input === "string") {
        if (existsSync(input) && lstatSync(input).isDirectory()) {
          const p = path.resolve(input);
          return t.success(p.endsWith(path.sep) ? p : `${p}${path.sep}`);
        }
        return t.failure(input, context);
      } else {
        const p = path.resolve(defaultValue);
        return t.success(p.endsWith(path.sep) ? p : `${p}${path.sep}`);
      }
    },
    (v) => path.resolve(v),
  );

export const withDefault = <T extends t.Any>(
  type: T,
  defaultValue: t.TypeOf<T>,
): t.Type<t.TypeOf<T>, t.OutputOf<T>, t.InputOf<T>> =>
  new t.Type<t.TypeOf<T>, t.OutputOf<T>, t.InputOf<T>>(
    type.name,
    type.is,
    (input, context) => type.validate(input ?? defaultValue, context),
    t.identity,
  );

const commonConfig = t.intersection([
  t.type({
    entry: new t.Type<string, string, unknown>(
      "string",
      (input: unknown): input is string =>
        typeof input === "string" && existsSync(input),
      (input, context) => {
        if (typeof input === "string" && existsSync(input)) {
          const p = path.resolve(input);
          return t.success(p);
        }
        return t.failure(input, context);
      },
      (v) => path.resolve(v),
    ),
  }),
  t.partial({
    verbose: withDefault(t.boolean, false),
  }),
]);
type CommonConfig = t.TypeOf<typeof commonConfig>;

export const callGraphConfig = t.intersection([
  t.type({
    format: t.keyof({
      jpg: null, // JPEG
      jpeg: null,
      jpe: null,
      jp2: null, // JPEG 2000
      pdf: null, // PDF
      png: null, // PNG
      ps: null, // Adobe PostScript
      ps2: null, // PS/PDF
      psd: null, // Photoshop
      sgi: null, // Silicon Graphics Image
      svg: null, // SVG
      svgz: null,
      webp: null, // WebP
    }),
  }),
  t.partial({
    declaration: withDefault(t.boolean, false),
    outDir: withDefaultDir(
      [process.cwd(), "output", "call-graph"].join(path.sep),
    ),
    line: t.number,
  }),
]);
export type CallGraphConfig = t.TypeOf<typeof callGraphConfig>;

const config = t.intersection([
  commonConfig,
  t.partial({
    callGraph: callGraphConfig,
  }),
]);
export type Config = t.TypeOf<typeof config>;
const isConfig = (value: unknown): t.Validation<Config> => config.decode(value);

export const readConfig = (configPath: string): Record<string, unknown> =>
  JSON.parse(readFileSync(configPath, { encoding: "utf-8" })) as Record<
    string,
    unknown
  >;

const getRootFileNames = (directory: string): string[] =>
  readdirSync(directory, { recursive: true })
    .map((f) => path.join(directory, f.toString()))
    .filter((fileName) =>
      [".ts", ".tsx", ".js", ".jsx"].some((extension) =>
        fileName.toLowerCase().endsWith(extension),
      ),
    );

export type Option = {
  entry: string[];
  rootDir: string;
  verbose: boolean;
  callGraph?: CallGraphConfig;
};
export const toOptions = (): Option => {
  const { config } = yargs(process.argv.slice(2))
    .option("config", {
      coerce: (configPath) => {
        if (typeof configPath !== "string") return undefined;
        if (!existsSync(configPath)) {
          throw new Error(
            "existing config path should be passed to --config parameter",
          );
        }
        const absoluteConfigPath = path.resolve(configPath);
        if (path.extname(configPath) === ".json") {
          const result = isConfig(readConfig(absoluteConfigPath));
          if (isRight(result)) return result.right;
          throw new Error(JSON.stringify(PathReporter.report(result)));
        }
        throw new Error("Unsupported config file extension. It must be json");
      },
      demandOption: true,
      type: "string",
    })
    .help().argv as { config: Config & Required<CommonConfig> } & {
    _: string[];
  };
  const option: Option = {
    ...config,
    ...(lstatSync(config.entry).isDirectory()
      ? { entry: getRootFileNames(config.entry), rootDir: config.entry }
      : { entry: [config.entry], rootDir: path.dirname(config.entry) }),
  };
  if (option?.verbose) {
    console.log("passed option");
    console.log(option);
  }
  return option;
};
