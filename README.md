# ts-call-graph

Automatically generate graphs from source code written in TypeScript/JavaScript using TypeScript language service and its AST.

Sample images are in `example` directory.

## example image

When executing below command, the following image will be output.

```sh
ts-call-graph test/ -d true -f png
```

![test](example/test/call-hierarchy/one.png)

And other example output images of well-known libraries are under example folders.

[nest](./example/nest/README.md)
[react-dom](./example/react-dom/README.md)
[ts-node](./example/ts-node/README.md)

## install

```sh
npm install ts-call-graph --save-dev
yarn add --dev ts-call-graph
```

## How to generate call graph

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
                                                          "current working directory"]
  -o, --outDir       output directory                         [string] [default:
                                                   "current working directory/output"]
  -f, --format       out put format
      [string] [choices: "jpg", "jpeg", "jpe", "jp2", "pdf", "png", "ps", "ps2",
                           "psd", "sgi", "svg", "svgz", "webp"] [default: "svg"]
  -d, --declaration  is include declaration           [boolean] [default: false]
  -v, --verbose      Use verbose output               [boolean] [default: false]
  -l, --line         The line number where call graph starts            [number]
      --help         Show help                                         [boolean]
```

- ./path/to/entry-file.ts
  First command line arg, as in entry file or directory where we'll walk through to generate call graph.
  If this is a directory, We'll all files in the directory, and if a file, just output the only call graphs about the file.
- rootDir
  When we output graphviz, this directory will be the base directory. Default value is current working directory.
  **`<rootDir>`/path/to/entry-file.ts**

  **example**)
  `rootDir` parameter will remove the output files' directory names.

```sh
~ $ pwd
/Users/xxxx
~ $ ls
test     package.json
~ $ ls test/call-hierarchy
one.ts          three.ts        two.ts
~ $ npm run ts-call-graph ./test/call-hierarchy/
~ $ ls output/test/call-hierarchy/
one.ts#callThreeTwice:4.dot     three.ts#log:8.svg              two.ts#tada:7.dot               two.ts#tada:8.svg
one.ts#callThreeTwice:4.svg     three.ts#print:4.dot            two.ts#tada:7.svg
three.ts#log:8.dot              three.ts#print:4.svg            two.ts#tada:8.do
```
