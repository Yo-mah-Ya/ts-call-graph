import * as ts from "typescript";
import { CallSite } from "./get-positions";
import { EOL } from "os";
import { Option } from "./option";

type CallHierarchyItemWithId = ts.CallHierarchyItem & { id: number };

export type CallHierarchyItemWithChildren = Pick<
  ts.CallHierarchyItem,
  "file" | "kind" | "kindModifiers" | "name" | "containerName"
> & {
  id: number; // unique number for each nodes
  range: {
    line: number;
    character: number;
  };
  selectionRange: {
    line: number;
    character: number;
  };
  children: CallHierarchyItemWithChildren[];
};

const isStackOverflow = (error: unknown): boolean =>
  error instanceof RangeError &&
  error.message === "Maximum call stack size exceeded";

/**
 * TypeScript language service API walk through each AST nodes recursively.
 * So when stack overflow happens, we'll just get as much call graphs as possible.
 */
export class CallHierarchy {
  constructor(
    private service: ts.LanguageService,
    private option: Option,
  ) {}

  private logOutIf = (
    item:
      | ts.CallHierarchyItem
      | ts.CallHierarchyItem[]
      | ts.CallHierarchyIncomingCall[]
      | ts.CallHierarchyOutgoingCall[]
      | undefined,
    method: keyof ts.LanguageService,
    location: { fileName: string; pos: number },
  ): void => {
    if (this.option.verbose) {
      if (item == undefined) {
        console.info(
          `The return value of ${method} was undefined:${EOL}\t${location.fileName}, pos: ${location.pos}`,
        );
      }
      // When a program might jump to multiple locations, which are most likely declaration files.
      if (Array.isArray(item) && item.length !== 1) {
        console.log(
          `The return value of ${method} has ${item.length} element:${EOL}\t${location.fileName}, pos: ${location.pos}`,
        );
      }
    }
  };

  private getSourceFile = (file: string): ts.SourceFile => {
    const sourceFile = this.service.getProgram()?.getSourceFile(file);
    if (!sourceFile) {
      throw new Error("couldn't get sourceFile by language services");
    }
    return sourceFile;
  };

  private prepareCallHierarchy = (
    callSite: CallSite,
  ): ts.CallHierarchyItem | undefined => {
    try {
      const res = this.service.prepareCallHierarchy(
        callSite.fileName,
        callSite.realPosition.pos,
      );
      this.logOutIf(res, "prepareCallHierarchy", {
        fileName: callSite.fileName,
        pos: callSite.realPosition.pos,
      });
      return Array.isArray(res) ? res[0] : res;
    } catch (error) {
      console.error({
        callSite: callSite,
        error,
      });
      return undefined;
    }
  };

  private toCallHierarchyItemWithChildren = (
    item: CallHierarchyItemWithId,
    {
      range,
      selectionRange,
    }: { range: ts.LineAndCharacter; selectionRange: ts.LineAndCharacter },
    children: CallHierarchyItemWithChildren[],
  ): CallHierarchyItemWithChildren => ({
    id: item.id,
    file: item.file,
    kind: item.kind,
    kindModifiers: item.kindModifiers,
    name: item.name,
    containerName: item.containerName,
    range: {
      line: range.line + 1, // line starts with index 0 with TypeScript Language service API specification
      character: range.character,
    },
    selectionRange: {
      line: selectionRange.line + 1, // line starts with index 0 with TypeScript Language service API specification
      character: selectionRange.character,
    },
    children,
  });

  private getIncomingCalls = (
    item: ts.CallHierarchyItem,
  ): CallHierarchyItemWithChildren | undefined => {
    let result: CallHierarchyItemWithChildren | undefined = undefined;

    let id = 1;
    const innerGetIncomingCalls = (
      item: CallHierarchyItemWithId,
    ): CallHierarchyItemWithChildren => {
      const incomingCalls = this.service.provideCallHierarchyIncomingCalls(
        item.file,
        item.selectionSpan.start,
      );
      this.logOutIf(incomingCalls, "provideCallHierarchyIncomingCalls", {
        fileName: item.file,
        pos: item.selectionSpan.start,
      });
      const children = incomingCalls.map((incomingCall) =>
        innerGetIncomingCalls({ ...incomingCall.from, id: ++id }),
      );

      const sourceFile = this.getSourceFile(item.file);
      const selectionRange = sourceFile.getLineAndCharacterOfPosition(
        item.selectionSpan.start,
      );
      const range = sourceFile.getLineAndCharacterOfPosition(item.span.start);
      result = this.toCallHierarchyItemWithChildren(
        item,
        { range, selectionRange },
        children,
      );
      return result;
    };

    try {
      return innerGetIncomingCalls({ ...item, id });
    } catch (error) {
      console.error({
        incomingCallsItem: item,
        error,
      });
      if (isStackOverflow(error)) {
        return result;
      }
      return undefined;
    }
  };
  public getIncomingCallHierarchy = (
    callSite: CallSite,
  ): CallHierarchyItemWithChildren | undefined => {
    const item = this.prepareCallHierarchy(callSite);
    if (!item) return undefined;
    const ch = this.getIncomingCalls(item);
    if (!ch) return undefined;
    return {
      id: 0, // The original call site starts with index 0.
      name: callSite.calledFunction,
      kind: ts.ScriptElementKind.functionElement,
      file: callSite.fileName,
      selectionRange: callSite.realPosition,
      range: callSite.realPosition,
      children: [ch],
    };
  };

  private getOutgoingCalls = (
    item: ts.CallHierarchyItem,
  ): CallHierarchyItemWithChildren | undefined => {
    let result: CallHierarchyItemWithChildren | undefined = undefined;

    let id = 1;
    const innerGetOutgoingCalls = (
      item: CallHierarchyItemWithId,
    ): CallHierarchyItemWithChildren => {
      const outgoingCalls = this.service.provideCallHierarchyOutgoingCalls(
        item.file,
        item.selectionSpan.start,
      );
      this.logOutIf(outgoingCalls, "provideCallHierarchyOutgoingCalls", {
        fileName: item.file,
        pos: item.selectionSpan.start,
      });
      const children = outgoingCalls.map((outgoingCall) =>
        innerGetOutgoingCalls({ ...outgoingCall.to, id: ++id }),
      );

      const sourceFile = this.getSourceFile(item.file);
      const selectionRange = sourceFile.getLineAndCharacterOfPosition(
        item.selectionSpan.start,
      );
      const range = sourceFile.getLineAndCharacterOfPosition(item.span.start);
      result = this.toCallHierarchyItemWithChildren(
        item,
        { range, selectionRange },
        children,
      );
      return result;
    };

    try {
      return innerGetOutgoingCalls({ ...item, id });
    } catch (error) {
      console.error({
        outGoingCallsItem: item,
        error,
      });
      if (isStackOverflow(error)) {
        return result;
      }
      return undefined;
    }
  };
  public getOutgoingCallHierarchy = (
    callSite: CallSite,
  ): CallHierarchyItemWithChildren | undefined => {
    const item = this.prepareCallHierarchy(callSite);
    if (!item) return undefined;
    const ch = this.getOutgoingCalls(item);
    if (!ch) return undefined;
    return {
      id: 0, // The original call site starts with index 0.
      name: callSite.calledFunction,
      kind: ts.ScriptElementKind.functionElement,
      file: callSite.fileName,
      selectionRange: callSite.realPosition,
      range: callSite.realPosition,
      children: [ch],
    };
  };
}
