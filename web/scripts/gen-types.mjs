// Generate src/types/timeline.ts from ../schema/timeline.schema.json.
// Run: pnpm gen:types   (CI checks the output is up to date)
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { compileFromFile } from 'json-schema-to-typescript'

const schema = fileURLToPath(new URL('../../schema/timeline.schema.json', import.meta.url))
const out = fileURLToPath(new URL('../src/types/timeline.ts', import.meta.url))

const ts = await compileFromFile(schema, {
  bannerComment:
    '/* GENERATED from schema/timeline.schema.json by scripts/gen-types.mjs — do not edit. */',
  additionalProperties: false,
  style: { singleQuote: true, semi: false },
})
await writeFile(out, ts)
console.log(`wrote ${out}`)
