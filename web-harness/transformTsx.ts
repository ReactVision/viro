// @ts-expect-error -- @babel/standalone ships no first-party types
import * as Babel from "@babel/standalone";

/** Compiles scene TSX source to a CommonJS script that compileGeneratedScenes can run. */
export function transformTsx(code: string): string {
  return (
    Babel.transform(code, {
      filename: "GeneratedScene.tsx",
      presets: [
        ["typescript", { isTSX: true, allExtensions: true }],
        ["react", { runtime: "classic" }],
      ],
      plugins: ["transform-modules-commonjs"],
      sourceType: "module",
    }).code ?? ""
  );
}
