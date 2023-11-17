#!/usr/bin/env node
import { compile } from "./get-positions";
import { CallHierarchy } from "./call-hierarchy";
import { createLanguageService } from "./language-service";
import { callHierarchyToGraphviz } from "./gen/graphviz";
import { toOptions } from "./option";

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
  const p: Promise<void>[] = [];
  const callHierarchy = new CallHierarchy(languageService, option);
  for (const callSite of callSites) {
    const outgoingCallHierarchy =
      callHierarchy.getOutgoingCallHierarchy(callSite);
    if (!outgoingCallHierarchy) continue;
    p.push(callHierarchyToGraphviz(outgoingCallHierarchy, option));
  }
  await Promise.all(p);
};
main().catch(console.error);
