import * as ts from "typescript";
import { CallSite } from "./get-positions";
import { EOL } from "os";
import { Option } from "./option";

export type CallHierarchyItemWithChildren = Pick<
  ts.CallHierarchyItem,
  "file" | "kind" | "kindModifiers" | "name" | "containerName"
> & {
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

/**
 * TypeScript language service API walk through each AST nodes recursively.
 * So when stack overflow happens, we'll just get as much call graphs as possible.
 */
export class CallHierarchy {
  constructor(
    private service: ts.LanguageService,
    private callSite: CallSite,
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

  private prepareCallHierarchy = (): ts.CallHierarchyItem | undefined => {
    try {
      const res = this.service.prepareCallHierarchy(
        this.callSite.fileName,
        this.callSite.realPosition.pos,
      );
      this.logOutIf(res, "prepareCallHierarchy", {
        fileName: this.callSite.fileName,
        pos: this.callSite.realPosition.pos,
      });
      return Array.isArray(res) ? res[0] : res;
    } catch (error) {
      console.error({
        callSite: this.callSite,
        error,
      });
      return undefined;
    }
  };

  private toCallHierarchyItemWithChildren = (
    item: ts.CallHierarchyItem,
    {
      range,
      selectionRange,
    }: { range: ts.LineAndCharacter; selectionRange: ts.LineAndCharacter },
    children: CallHierarchyItemWithChildren[],
  ): CallHierarchyItemWithChildren => ({
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

    const innerGetIncomingCalls = (
      item: ts.CallHierarchyItem,
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
        innerGetIncomingCalls(incomingCall.from),
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
      return innerGetIncomingCalls(item);
    } catch (error) {
      console.error({
        incomingCallsItem: item,
        error,
      });
      if (
        error instanceof RangeError &&
        error.message === "Maximum call stack size exceeded"
      ) {
        return result;
      }
      return undefined;
    }
  };
  public getIncomingCallHierarchy = ():
    | CallHierarchyItemWithChildren
    | undefined => {
    const item = this.prepareCallHierarchy();
    if (!item) return undefined;
    return this.getIncomingCalls(item);
  };

  private getOutgoingCalls = (
    item: ts.CallHierarchyItem,
  ): CallHierarchyItemWithChildren | undefined => {
    let result: CallHierarchyItemWithChildren | undefined = undefined;

    const innerGetOutgoingCalls = (
      item: ts.CallHierarchyItem,
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
        innerGetOutgoingCalls(outgoingCall.to),
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
      return innerGetOutgoingCalls(item);
    } catch (error) {
      console.error({
        outGoingCallsItem: item,
        error,
      });
      if (
        error instanceof RangeError &&
        error.message === "Maximum call stack size exceeded"
      ) {
        return result;
      }
      return undefined;
    }
  };
  public getOutgoingCallHierarchy = ():
    | CallHierarchyItemWithChildren
    | undefined => {
    const item = this.prepareCallHierarchy();
    if (!item) return undefined;
    return this.getOutgoingCalls(item);
  };
}
