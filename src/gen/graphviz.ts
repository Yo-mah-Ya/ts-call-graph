import { exec } from "child_process";
import { promisify } from "util";
import type { CallHierarchyItemWithChildren } from "../call-hierarchy";
import { EOL } from "os";
import type { CallSite } from "../get-positions";
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

const graphviz = async ({
  format,
  body,
  outputFile,
  outDir,
}: Option & { body: string; outputFile: string }): Promise<void> => {
  await mkdir(`${outDir}${path.dirname(outputFile)}`, { recursive: true });
  await writeFile(`${outDir}${outputFile}.dot`, body);
  await promisify(exec)(
    `${
      process.platform === "win32" ? "dot.exe" : "dot"
    } -T${format} "${outDir}${outputFile}.dot" -o "${outDir}${outputFile}.${format}"`,
  );
};

const callHierarchyToDotNodeName = (
  ch: CallHierarchyItemWithChildren | CallSite,
  option: Option,
): string =>
  "range" in ch
    ? `"${ch.file.replace(option.rootDir, "")}:${ch.name}:${
        ch.selectionRange.line
      }"`
    : `"${ch.fileName.replace(option.rootDir, "")}:${ch.calledFunction}:${
        ch.realPosition.line
      }"`;

const callHierarchyToDotNodeLabel = (
  ch: CallHierarchyItemWithChildren | CallSite,
): string =>
  "range" in ch
    ? `"${ch.containerName ? ch.containerName + "." : ""}${ch.name}:${
        ch.selectionRange.line
      }"`
    : `"${ch.calledFunction}:${ch.realPosition.line}"`;

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

function callsToString(
  callSite: CallSite,
  item: CallHierarchyItemWithChildren,
  option: Option,
): string {
  const subgraphGroupedByFiles: Map<string, string[]> = new Map();
  const callHierarchyRelations: string[] = [];

  // add entry call site
  const dotSubgraphName = callSite.fileName;
  if (!subgraphGroupedByFiles.has(dotSubgraphName)) {
    subgraphGroupedByFiles.set(dotSubgraphName, []);
  }

  const dotNodeName = callHierarchyToDotNodeName(callSite, option);
  if (isOutputTarget(item, option)) {
    subgraphGroupedByFiles
      .get(dotSubgraphName)
      ?.push(
        `${dotNodeName} [shape="oval", label=${callHierarchyToDotNodeLabel(
          callSite,
        )}]`,
      );
    callHierarchyRelations.push(
      `${dotNodeName} -> ${callHierarchyToDotNodeName(item, option)};`,
    );
  }

  // Walk through children with depth first search
  const stack: CallHierarchyItemWithChildren[] = [item];
  while (stack.length) {
    const parentNode = stack.pop() as CallHierarchyItemWithChildren;

    const dotSubgraphName = parentNode.file;
    if (!subgraphGroupedByFiles.has(dotSubgraphName)) {
      subgraphGroupedByFiles.set(dotSubgraphName, []);
    }

    const dotNodeName = callHierarchyToDotNodeName(parentNode, option);
    if (isOutputTarget(parentNode, option)) {
      subgraphGroupedByFiles
        .get(dotSubgraphName)
        ?.push(
          `${dotNodeName} [shape="oval", label=${callHierarchyToDotNodeLabel(
            parentNode,
          )}]`,
        );
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

  // Don't output a file if callSite doesn't have call given conditions' hierarchies
  if (!callHierarchyRelations.length) return "";

  // assemble each parts
  const subgraphs: string[] = [];
  for (const [absoluteFilePath, nodes] of subgraphGroupedByFiles.entries()) {
    subgraphs.push(`\tsubgraph "cluster_${absoluteFilePath}" {`);
    subgraphs.push(
      `\t\tlabel = "${absoluteFilePath.replace(option.rootDir, "")}"`,
      `\t\thref = "${absoluteFilePath}"`,
    );
    if (isStdLib(absoluteFilePath)) {
      subgraphs.push(`\t\tbgcolor = "#adedad"`);
    } else if (isNodeModules(absoluteFilePath)) {
      subgraphs.push(`\t\tbgcolor = "#e6ecfa"`);
    }
    if (nodes.length) subgraphs.push("\t\t" + nodes.join(EOL + "\t\t"));
    subgraphs.push("\t};");
  }
  return (
    subgraphs.join(EOL) + `${EOL}\t` + callHierarchyRelations.join(`${EOL}\t`)
  );
}

export const callHierarchyToGraphviz = async (
  callSite: CallSite,
  ch: CallHierarchyItemWithChildren,
  option: Option,
): Promise<void> => {
  const body = callsToString(callSite, ch, option);
  if (body === "") return;
  await graphviz({
    ...option,
    outputFile: `${callSite.fileName.replace(option.rootDir, "")}#${
      callSite.calledFunction
    }:${callSite.realPosition.line}`,
    body: baseGraphWith(body),
  });
};
