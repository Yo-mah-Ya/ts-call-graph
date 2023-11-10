# ts-source-visualizer

Automatically generate graphs from source code written in TypeScript/JavaScript using TypeScript language service and its AST.

Sample images are in `example` directory.

## How to generate call graph

- command

```sh
ts-call-graph --config ./path/to/config.json
```

- JSON config file example

```json
{
  "entry": "./test",
  "verbose": true,
  "callGraph": {
    "format": "svg"
  }
}
```

available config represented by typescript types

```ts
type Config = {
  entry: string;
  verbose?: boolean;
  callGraph?: {
    format: // The output format when executing graphviz with dot
    | "jpg" // JPEG
      | "jpeg"
      | "jpe"
      | "jp2" // JPEG 2000
      | "pdf" // PDF
      | "png" // PNG
      | "ps" // Adobe PostScript
      | "ps2" // PS/PDF
      | "psd" // Photoshop
      | "sgi" // Silicon Graphics Image
      | "svg" // SVG
      | "svgz"
      | "webp"; // WebP
    declaration?: boolean; // if true, include declaration files in output
    outDir?: string; // output directory
    /*
     The line number in a file where call graph starts.
     If we can't find call expression, bot outgoing and incoming, the we won't output.
     We typically specify this, when we need particular call graphs
     */
    line?: number;
  };
};
```

- CLI option

```sh
Options:
  --version  Show version number                                       [boolean]
  --config                                                   [string] [required]
  --help     Show help                                                 [boolean]
```
