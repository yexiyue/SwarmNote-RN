#!/usr/bin/env node
// Workaround for uniffi-bindgen-react-native generator bug:
// async primary constructors are emitted as `async static name(...)`
// instead of the valid `static async name(...)`.
// See node_modules/uniffi-bindgen-react-native/crates/ubrn_bindgen/src/bindings/gen_typescript/templates/macros.ts:89

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const generatedDir = join(__dirname, "..", "src", "generated");

const PATTERN = /\basync\s+static\b/g;

function walk(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (entry.endsWith(".ts")) fix(full);
  }
}

function fix(file) {
  const before = readFileSync(file, "utf8");
  if (!PATTERN.test(before)) return;
  const after = before.replace(PATTERN, "static async");
  writeFileSync(file, after);
  console.log(`[fix-ubrn] patched async-static in ${file}`);
}

walk(generatedDir);
