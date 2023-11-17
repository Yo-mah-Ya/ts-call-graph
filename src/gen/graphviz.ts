import { exec } from "child_process";
import { promisify } from "util";
import type { CallHierarchyItemWithChildren } from "../call-hierarchy";
import { EOL } from "os";
import { mkdir, writeFile } from "fs/promises";
import ts from "typescript";
import { Option } from "../option";
import path from "path";

const baseGraphWith = (body: string): string => `
digraph {
    graph [
        charset = "UTF-8",
        rankdir = LR,
        compound = true
    ];
  ${body}
}
`;

const graphviz = async (
  ch: CallHierarchyItemWithChildren,
  option: Option,
  body: string,
): Promise<void> => {
  const outputFile = buildOutPutFilePathWithoutExtension(ch, option);

  await mkdir(`${option.outDir}${path.dirname(outputFile)}`, {
    recursive: true,
  });
  await writeFile(`${option.outDir}${outputFile}.dot`, body);
  await promisify(exec)(
    `${process.platform === "win32" ? "dot.exe" : "dot"} -T${option.format} "${
      option.outDir
    }${outputFile}.dot" -o "${option.outDir}${outputFile}.${option.format}"`,
  );
};

export const buildOutPutFilePathWithoutExtension = (
  ch: CallHierarchyItemWithChildren,
  option: Option,
): string => {
  return `${ch.file.replace(option.rootDir, "")}#${ch.name}:${
    ch.selectionRange.line
  }`;
};

const callHierarchyToDotNodeName = (
  ch: CallHierarchyItemWithChildren,
  option: Option,
): string =>
  `"${ch.file.replace(option.rootDir, "")}:${ch.name}:${
    ch.selectionRange.line
  }"`;

const callHierarchyToDotNodeLabel = (
  ch: CallHierarchyItemWithChildren,
): string =>
  `"${ch.containerName ? ch.containerName + "." : ""}${ch.name}:${
    ch.selectionRange.line
  }"`;

const isNodeModules = (file: string): boolean => file.includes("node_modules");

const isStdLib = (file: string): boolean =>
  ["node_modules/@types/node", "node_modules/typescript/lib"].some((dir) =>
    file.includes(dir),
  );

const isOutputTarget = (
  node: CallHierarchyItemWithChildren,
  option: Option,
): boolean => {
  switch (node.kind) {
    case ts.ScriptElementKind.memberFunctionElement:
    case ts.ScriptElementKind.functionElement:
    case ts.ScriptElementKind.localFunctionElement:
      if (!node.kindModifiers) return true;
      /** ScriptElementKindModifier separated by commas, e.g. "public,abstract" */
      return node.kindModifiers
        .split(",")
        .every(
          (km) =>
            (km as ts.ScriptElementKindModifier) !==
              ts.ScriptElementKindModifier.ambientModifier ||
            ((km as ts.ScriptElementKindModifier) ===
              ts.ScriptElementKindModifier.ambientModifier &&
              option.declaration),
        );
  }
  return false;
};

export const createBaseUrlPath = (
  ch: CallHierarchyItemWithChildren,
  option: Option,
): string =>
  encodeURI(
    `/${ch.file.replace(option.rootDir, "")}/${ch.name}/${
      ch.selectionRange.line
    }`,
  );

export function callsToDotString(
  ch: CallHierarchyItemWithChildren,
  option: Option,
): string {
  const subgraphGroupedByFiles: Map<string, string[]> = new Map();
  const callHierarchyRelations: string[] = [];

  const baseUrlPath = createBaseUrlPath(ch, option);

  // Walk through children with depth first search
  const stack: CallHierarchyItemWithChildren[] = [ch];
  while (stack.length) {
    const parentNode = stack.pop() as CallHierarchyItemWithChildren;

    const dotSubgraphName = parentNode.file;
    if (!subgraphGroupedByFiles.has(dotSubgraphName)) {
      subgraphGroupedByFiles.set(dotSubgraphName, []);
    }

    const dotNodeName = callHierarchyToDotNodeName(parentNode, option);
    if (isOutputTarget(parentNode, option)) {
      const attributes: string[] = [
        `shape="oval"`,
        `label=${callHierarchyToDotNodeLabel(parentNode)}`,
        `${
          parentNode.hasChildren && !parentNode.children.length
            ? `color="#3b82f6", penwidth=2.0`
            : `color="black", penwidth=1.0`
        }`,
      ];
      // Don't dare to try to reach to children, if it doesn't have them.
      if (option.server && parentNode.hasChildren) {
        attributes.push(`href="${baseUrlPath}?id=${parentNode.id}"`);
      }

      subgraphGroupedByFiles
        .get(dotSubgraphName)
        ?.push(`${dotNodeName} [${attributes.join(", ")}]`);
    }

    // draw the relationship between call site and callee.
    if (parentNode?.children) {
      for (const child of parentNode.children) {
        const childNodeName = callHierarchyToDotNodeName(child, option);
        if (isOutputTarget(child, option)) {
          callHierarchyRelations.push(`${dotNodeName} -> ${childNodeName};`);
        }
      }
      for (let i = parentNode.children.length - 1; i >= 0; i--) {
        stack.push(parentNode.children[i]);
      }
    }
  }

  // assemble each parts
  const subgraphs: string[] = [];
  for (const [absoluteFilePath, nodes] of subgraphGroupedByFiles.entries()) {
    subgraphs.push(`\tsubgraph "cluster_${absoluteFilePath}" {`);
    subgraphs.push(
      `\t\tlabel = "${absoluteFilePath.replace(option.rootDir, "")}"`,
      option.server
        ? `\t\thref = "${baseUrlPath}?file=${encodeURI(absoluteFilePath)}"`
        : `\t\thref = "${absoluteFilePath}"`,
    );
    if (isStdLib(absoluteFilePath)) {
      subgraphs.push(`\t\tbgcolor = "#adedad"`);
    } else if (isNodeModules(absoluteFilePath)) {
      subgraphs.push(`\t\tbgcolor = "#e6ecfa"`);
    }
    if (nodes.length) subgraphs.push("\t\t" + nodes.join(EOL + "\t\t"));
    subgraphs.push("\t};");
  }
  return baseGraphWith(
    subgraphs.join(EOL) + `${EOL}\t` + callHierarchyRelations.join(`${EOL}\t`),
  );
}

export const callHierarchyToGraphviz = async (
  ch: CallHierarchyItemWithChildren,
  option: Option,
): Promise<void> => {
  const body = callsToDotString(ch, option);
  if (body === undefined) return;
  await graphviz(ch, option, body);
};
