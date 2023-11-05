import ts from "typescript";
import { Option } from "./option";

type Position = {
  line: number;
  character: number;
  pos: number;
  end: number;
};

export type CallSite = {
  fileName: string;
  calledFunction: string;
  originalPosition: Position;
  realPosition: Position;
};

const getCallSiteFromExpression = (
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
):
  | Pick<CallSite, "calledFunction" | "realPosition" | "originalPosition">
  | undefined => {
  const text = sourceFile.text;

  function getRealPosition(
    targetString: string,
    functionName: string,
    textRange: ts.ReadonlyTextRange,
  ): number {
    return textRange.pos + targetString.lastIndexOf(functionName);
  }

  function getRealPositionWithoutCommentsAndEol(
    functionName: string,
    textRange: ts.ReadonlyTextRange,
  ): Pick<CallSite, "realPosition" | "originalPosition"> {
    const targetString = text.slice(textRange.pos, textRange.end);
    const originalPosAndLine = sourceFile.getLineAndCharacterOfPosition(
      textRange.pos,
    );
    const realPosition = getRealPosition(targetString, functionName, textRange);
    const realPosAndLine =
      sourceFile.getLineAndCharacterOfPosition(realPosition);
    return {
      originalPosition: {
        line: originalPosAndLine.line,
        character: originalPosAndLine.character,
        pos: textRange.pos,
        end: textRange.end,
      },
      realPosition: {
        line: realPosAndLine.line + 1, // line starts with index 0 with TypeScript Language service API specification
        character: realPosAndLine.character,
        pos: realPosition,
        end: textRange.end,
      },
    };
  }
  if (ts.isIdentifier(node.expression)) {
    const expression = node.expression;
    const { realPosition, originalPosition } =
      getRealPositionWithoutCommentsAndEol(expression.text, {
        pos: expression.pos,
        end: expression.end,
      });
    return {
      calledFunction: expression.text,
      originalPosition,
      realPosition,
    };
  } else if (ts.isPropertyAccessExpression(node.expression)) {
    const expression = node.expression;
    const { realPosition, originalPosition } =
      getRealPositionWithoutCommentsAndEol(expression.name.text, {
        pos: expression.name.pos,
        end: expression.name.end,
      });
    return {
      calledFunction: expression.name.text,
      originalPosition,
      realPosition,
    };
  } else {
    console.log(ts.SyntaxKind[node.expression.kind]);
    return undefined;
  }
};

function extractFunctionCalls(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  callSites: CallSite[],
  option: Option,
): void {
  if (ts.isCallExpression(node)) {
    const callSite = getCallSiteFromExpression(node, sourceFile);
    if (callSite) {
      if (
        option.line == undefined ||
        (typeof option.line === "number" &&
          option.line === callSite.realPosition.line)
      ) {
        callSites.push({
          fileName: sourceFile.fileName,
          calledFunction: callSite.calledFunction,
          originalPosition: callSite.originalPosition,
          realPosition: callSite.realPosition,
        });
      }
    }
  }

  node.forEachChild((child) =>
    extractFunctionCalls(child, sourceFile, callSites, option),
  );
}

export const compile = (
  rootFileNames: string[],
  compilerOptions: ts.CompilerOptions,
  option: Option,
): CallSite[] => {
  const sourceFiles = ts
    .createProgram(rootFileNames, compilerOptions)
    ?.getSourceFiles()
    .filter((f) => !f.isDeclarationFile);

  const callSites: CallSite[] = [];
  const rootNodes: ts.Node[] = [];

  for (const sourceFile of sourceFiles) {
    sourceFile.forEachChild((child: ts.Node) => {
      rootNodes.push(child);
    });
    rootNodes.forEach((node) => {
      extractFunctionCalls(node, sourceFile, callSites, option);
    });
  }

  return callSites;
};
