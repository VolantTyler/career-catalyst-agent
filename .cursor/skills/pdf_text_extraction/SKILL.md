---
name: pdf_text_extraction
description: >-
  Extract readable text from PDFs in this repo (résumés, CVs, cover letters,
  filings). Use when the user references a .pdf under context/ or elsewhere,
  or when quoted PDF content is needed and only the binary file is available.
---

# PDF text extraction (Career Catalyst)

## Why this skill exists

The **Read** tool on `.pdf` files returns **binary / compressed streams**, not usable prose. Do **not** infer résumé bullets from raw PDF bytes. Follow the workflow below.

## Workflow (in order)

1. **Sidecar plaintext (best)**  
   If `same-name.md`, `same-name.txt`, or a nearby `README.md` / `profile.md` exists next to the PDF, **read that file** and treat it as the source of truth.

2. **Project script (default for this repo)**  
   From the repo root:

   ```bash
   npm run pdf:text -- "context/Applied AI Resume.pdf"
   ```

   Writes extracted text to stdout. Use for summarization, scoring employers, or distilling facts into SQLite.

3. **System `pdftotext` (no Node deps)**  
   If Poppler is installed (`brew install poppler` on macOS):

   ```bash
   pdftotext -layout "path/to/file.pdf" -
   ```

4. **Scanned / image-only PDFs**  
   If output is empty or garbage, the PDF may be bitmap-only. Say so clearly. Options: OCR (e.g. `ocrmypdf`, cloud OCR), or ask the user for a text export / `.md` mirror.

## Output hygiene

- Preserve **structure hints** (headings, bullets) where `pdftotext -layout` or the script keeps line breaks.
- Strip repeated headers/footers when summarizing.
- Do not paste full résumés into public tickets; summarize or redact PII when context is shared.

## Related paths

- Persona PDFs: `context/*.pdf`
- Implementation: `scripts/extract-pdf-text.ts`, npm script `pdf:text`
