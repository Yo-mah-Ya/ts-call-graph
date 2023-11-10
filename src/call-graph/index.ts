import { compile } from "./call-sites";
import { CallHierarchy } from "./call-hierarchy";
import { callHierarchyToGraphviz } from "./gen/graphviz";
import type { Option } from "../option";
import type { CallGraphConfig } from "../option";
import ts from "typescript";

export const callGraph = async (
  languageService: ts.LanguageService,
  option: Option & { callGraph: CallGraphConfig },
): Promise<void> => {
  const callSites = compile(
    option.entry,
    {
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

  const p: Promise<void>[] = [];
  for (const callSite of callSites) {
    const callHierarchy = new CallHierarchy(
      languageService,
      callSite,
      option,
    ).getOutgoingCallHierarchy();
    if (!callHierarchy) continue;
    p.push(callHierarchyToGraphviz(callSite, callHierarchy, option));
  }
  await Promise.all(p);
};
