import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import oniguruma from "vscode-oniguruma";
import textmate from "vscode-textmate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const configuration = JSON.parse(
  await fs.readFile(path.join(root, "language-configuration.json"), "utf8"),
);
const grammarPath = path.join(root, "syntaxes", "silex.tmLanguage.json");
const grammarSource = await fs.readFile(grammarPath, "utf8");
const grammarDefinition = JSON.parse(grammarSource);

assert.equal(manifest.contributes.languages[0].id, "silex");
assert.deepEqual(manifest.contributes.languages[0].extensions, [".sx"]);
assert.equal(manifest.contributes.grammars[0].scopeName, "source.silex");
assert.equal(grammarDefinition.scopeName, "source.silex");
assert.equal(configuration.comments.lineComment, "//");

const wasmPath = path.join(
  root,
  "node_modules",
  "vscode-oniguruma",
  "release",
  "onig.wasm",
);
const wasm = await fs.readFile(wasmPath);
await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));

const registry = new textmate.Registry({
  onigLib: Promise.resolve({
    createOnigScanner: (sources) => new oniguruma.OnigScanner(sources),
    createOnigString: (value) => new oniguruma.OnigString(value),
  }),
  loadGrammar: async (scopeName) => {
    if (scopeName !== "source.silex") return null;
    return textmate.parseRawGrammar(grammarSource, grammarPath);
  },
});

const grammar = await registry.loadGrammar("source.silex");
assert.ok(grammar, "the Silex grammar must load");

const visibilityLine = "    module init(descriptor:int) {}";
const visibilityTokens = grammar.tokenizeLine(visibilityLine, textmate.INITIAL).tokens;
const moduleToken = visibilityTokens.find(
  (token) => visibilityLine.slice(token.startIndex, token.endIndex) === "module",
);
assert.ok(moduleToken, "module visibility must be tokenized");
assert.ok(
  moduleToken.scopes.includes("storage.modifier.access.silex"),
  "module visibility must use the access-modifier scope",
);

const removedVisibilityLine = "    internal func legacy() {}";
const removedVisibilityTokens = grammar.tokenizeLine(
  removedVisibilityLine,
  textmate.INITIAL,
).tokens;
const internalStart = removedVisibilityLine.indexOf("internal");
const internalToken = removedVisibilityTokens.find(
  (token) => token.startIndex <= internalStart && token.endIndex >= internalStart + "internal".length,
);
assert.ok(internalToken, "the removed spelling must remain ordinary tokenizable text");
assert.ok(
  !internalToken.scopes.includes("storage.modifier.access.silex"),
  "internal must not be highlighted as Silex visibility",
);

const staticStructLine = "public static struct Constants {";
const staticStructTokens = grammar.tokenizeLine(staticStructLine, textmate.INITIAL).tokens;
const constantsToken = staticStructTokens.find(
  (token) => staticStructLine.slice(token.startIndex, token.endIndex) === "Constants",
);
assert.ok(constantsToken?.scopes.includes("entity.name.type.silex"));

const contributionLine = "contribute GFX.Plugins {";
const contributionTokens = grammar.tokenizeLine(contributionLine, textmate.INITIAL).tokens;
const contributeToken = contributionTokens.find(
  (token) => contributionLine.slice(token.startIndex, token.endIndex) === "contribute",
);
const catalogToken = contributionTokens.find(
  (token) => contributionLine.slice(token.startIndex, token.endIndex) === "GFX.Plugins",
);
assert.ok(contributeToken?.scopes.includes("keyword.control.import.silex"));
assert.ok(catalogToken?.scopes.includes("entity.name.namespace.silex"));

let tryAlternativeStack = textmate.INITIAL;
const tryLine = "    var value = try read(path)";
tryAlternativeStack = grammar.tokenizeLine(tryLine, tryAlternativeStack).ruleStack;
const tryAlternativeLine = '        else error "cannot read"';
const tryAlternativeTokens = grammar.tokenizeLine(
  tryAlternativeLine,
  tryAlternativeStack,
).tokens;
const elseToken = tryAlternativeTokens.find(
  (token) => tryAlternativeLine.slice(token.startIndex, token.endIndex) === "else",
);
const errorToken = tryAlternativeTokens.find(
  (token) => tryAlternativeLine.slice(token.startIndex, token.endIndex) === "error",
);
assert.ok(elseToken, "multiline try alternative must tokenize else");
assert.ok(
  elseToken.scopes.includes("keyword.control.silex"),
  "multiline try alternative must highlight else as a keyword",
);
assert.ok(errorToken, "multiline try alternative must tokenize the error binding");
assert.ok(
  errorToken.scopes.includes("variable.other.silex"),
  "multiline try alternative must highlight error as a variable",
);

const fixture = await fs.readFile(path.join(root, "Tests", "Fixtures", "Language.sx"), "utf8");
const seenScopes = new Set();
let ruleStack = textmate.INITIAL;

for (const line of fixture.split("\n")) {
  const result = grammar.tokenizeLine(line, ruleStack);
  ruleStack = result.ruleStack;
  for (const token of result.tokens) {
    for (const scope of token.scopes) seenScopes.add(scope);
  }
}

for (const expected of [
  "comment.line.double-slash.silex",
  "entity.name.function.silex",
  "entity.name.type.silex",
  "keyword.control.silex",
  "storage.modifier.access.silex",
  "string.quoted.double.silex",
  "support.type.builtin.silex",
  "variable.other.property.silex",
]) {
  assert.ok(seenScopes.has(expected), `missing expected scope: ${expected}`);
}

console.log(`Validated Silex TextMate grammar (${seenScopes.size} scopes observed).`);
