#!/usr/bin/env node
import { callGraph } from "./call-graph";
import { createLanguageService } from "./language-service";
import { toOptions } from "./option";

export const main = async (): Promise<void> => {
  const option = toOptions();
  const languageService = createLanguageService(option.entry, {
    allowJs: true,
    declaration: false,
    declarationMap: false,
    noEmit: true,
    noEmitOnError: true,
    sourceMap: false,
  });
  if (option.callGraph) {
    await callGraph(languageService, {
      ...option,
      callGraph: option.callGraph,
    });
  }
};
main().catch(console.error);
