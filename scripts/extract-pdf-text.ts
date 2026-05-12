/**
 * Extract plain text from a PDF (text-based PDFs, e.g. Google Docs export).
 * For scanned pages, use OCR tooling instead.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
// pdf-parse is CommonJS
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{
  text: string;
  numpages: number;
}>;

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: npx tsx scripts/extract-pdf-text.ts "<path-to.pdf>"');
    process.exit(1);
  }
  const abs = resolve(process.cwd(), input);
  const buf = readFileSync(abs);
  const data = await pdfParse(buf);
  process.stdout.write(data.text.trimEnd());
  process.stdout.write("\n");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
