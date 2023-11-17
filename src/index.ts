#!/usr/bin/env node
import { compile } from "./get-positions";
import { CallHierarchy, CallHierarchyItemWithChildren } from "./call-hierarchy";
import { createLanguageService } from "./language-service";
import { callHierarchyToGraphviz } from "./gen/graphviz";
import { toOptions } from "./option";
import { startServer } from "./server";

export const main = async (): Promise<void> => {
  const option = toOptions();
  const callSites = compile(
    option.entry,
    option.compilerOptions ?? {
      allowJs: true,
      declaration: false,
      declarationMap: false,
      noEmit: true,
      noEmitOnError: true,
      sourceMap: false,
    },
    option,
  );
  if (!callSites.length) {
    console.log("Not found callSites");
    return;
  }

  const languageService = createLanguageService(
    option.entry,
    option.compilerOptions ?? {
      allowJs: true,
      declaration: false,
      declarationMap: false,
      noEmit: true,
      noEmitOnError: true,
      sourceMap: false,
    },
  );
  const chs: CallHierarchyItemWithChildren[] = [];
  const callHierarchy = new CallHierarchy(languageService, option);
  for (const callSite of callSites) {
    const outgoingCallHierarchy =
      callHierarchy.getOutgoingCallHierarchy(callSite);
    if (!outgoingCallHierarchy) continue;
    chs.push(outgoingCallHierarchy);
  }

  if (option.server) {
    startServer(chs, option);
  } else {
    await Promise.all(chs.map((ch) => callHierarchyToGraphviz(ch, option)));
  }
};
main().catch(console.error);
