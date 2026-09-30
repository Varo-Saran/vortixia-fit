import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

// Execute the actual local TS modules in memory. No generated files, network,
// Next server, or database connection; tests may explicitly stub IO imports.
export function localTypeScriptLoader(overrides = {}) {
  const root = process.cwd();
  const cache = new Map();
  const nodeRequire = createRequire(import.meta.url);
  function load(filename) {
    const absolute = path.resolve(root, filename);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const source = readFileSync(absolute, "utf8");
    if (absolute.endsWith(".json")) return JSON.parse(source);
    const loadedModule = { exports: {} };
    cache.set(absolute, loadedModule);
    const compiled = ts.transpileModule(source, {
      fileName: absolute,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    function requireLocal(specifier) {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return nodeRequire(specifier);
      const target = specifier.startsWith("@/")
        ? path.join(root, "src", specifier.slice(2))
        : path.resolve(path.dirname(absolute), specifier);
      const filename = path.extname(target) ? target : ['.ts', '.tsx', '.json'].map(extension => `${target}${extension}`).find(existsSync);
      if (!filename) throw new Error(`Cannot resolve local test module: ${specifier}`);
      return load(filename);
    }
    new Function("require", "module", "exports", compiled)(requireLocal, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}
