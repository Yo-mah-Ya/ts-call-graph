# ts-call-graph

Automatically generate call graphs using TypeScript language service.

### How to execute

- example

```sh
ts-call-graph ./path/to/entry-file.ts -f svg
```

- available options

```sh
Options:
      --version      Show version number                               [boolean]
  -r, --rootDir      root directory where we'll recursively walk through source
                     files. Default directory is current working directory.
                                                              [string] [default:
                                                          "/Users/xxxx/workdir"]
  -o, --outDir       output directory                         [string] [default:
                                                   "/Users/xxxx/workdir/output"]
  -f, --format       out put format
      [string] [choices: "jpg", "jpeg", "jpe", "jp2", "pdf", "png", "ps", "ps2",
                           "psd", "sgi", "svg", "svgz", "webp"] [default: "svg"]
  -d, --declaration  is include declaration           [boolean] [default: false]
  -v, --verbose      Use verbose output               [boolean] [default: false]
  -l, --line         The line number where call graph starts            [number]
      --help         Show help                                         [boolean]
```
