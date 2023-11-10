import ts from "typescript";
import { Option } from "../option";

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
  }
  return undefined;
};

function extractFunctionCalls(
  sourceFile: ts.SourceFile,
  callSites: CallSite[],
  option: Option,
): void {
  if (!sourceFile.getChildCount()) return;

  const stacks: ts.Node[] = sourceFile.getChildren();

  while (stacks.length) {
    const node = stacks.pop() as ts.Node;

    if (ts.isCallExpression(node)) {
      const callSite = getCallSiteFromExpression(node, sourceFile);
      if (callSite) {
        if (
          option?.callGraph?.line == undefined ||
          (typeof option?.callGraph?.line === "number" &&
            option?.callGraph?.line === callSite.realPosition.line)
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

    const children = node.getChildren(sourceFile);
    for (let i = children.length - 1; i >= 0; i--) {
      stacks.push(children[i]);
    }
  }
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

  for (const sourceFile of sourceFiles) {
    extractFunctionCalls(sourceFile, callSites, option);
  }

  return callSites;
};
