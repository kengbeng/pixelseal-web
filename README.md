# PixelSeal Web 0.3.1

PixelSeal Web is a local browser app for manual and search-assisted PDF redaction. All runtime dependencies are included. It runs without internet access after downloading and extracting this folder. It does not upload PDFs.

This is a separate web app, not a full migration of PixelSeal 0.8.1. The original Python source was unavailable in this workspace.

## Website

GitHub Pages address: https://kengbeng.github.io/pixelseal-web/

Open this address and select a PDF. No Python installation or local server is required for the hosted version. The browser downloads application assets from GitHub Pages; PDF bytes are processed locally and are not uploaded. An initial internet connection is required to cache the app and bundled English and simplified Chinese OCR assets (about 41 MB). Wait for **Ready offline**, then use **Install app** or your browser installation menu. PDF files and OCR results are held in memory and are not cached.

## Publish on GitHub Pages

1. Create the public repository `kengbeng/pixelseal-web`.
2. Upload the contents of this folder to the repository root, preserving `vendor/`. Do not upload test PDFs or personal documents.
3. Open Settings > Pages. Under Build and deployment, choose Deploy from a branch, then select main and /(root). Save.
4. Wait for the Pages deployment to finish and open the website address above. Test opening, marking and exporting a PDF.

The empty `.nojekyll` file disables Jekyll processing. Paths are relative so the app runs under `/pixelseal-web/`. The app licence and MuPDF licence remain in the deployed source.

## Start locally

1. Extract the complete folder. Keep `vendor/` beside `index.html`.
2. Install Python 3 if it is not already available.
3. On macOS, run `Start-PixelSeal.command`, or open Terminal in this folder and run `python3 serve.py`. On Windows, run `Start-PixelSeal.bat`, or run `py -3 serve.py` in this folder.
4. Open http://127.0.0.1:8765 if the browser does not open automatically.
5. Keep the launcher running while using the app. Press Ctrl+C in its terminal to stop.

The server binds only to this computer. It serves bundled assets and has no PDF upload endpoint. Browser worker modules and WebAssembly need a local HTTP server; double-clicking `index.html` is not the supported launch method. This is an HTML application folder, not a single HTML file. Python is only used to serve the files; all PDF processing runs in the browser.

## Use

1. Select **Open PDF** and choose a local document.
2. Drag a box around sensitive content. Include a small margin around text. Boxes must be at least 5 PDF points wide and tall.
3. Use **Find sensitive text** to search across all pages. Search is case-insensitive and normalises whitespace. Select **Show** to review a match on its page, tick the matches to redact, then select **Mark selected matches**. Nothing is selected automatically. Search results are limited to 500 highlight regions per page; an explicit message appears if that limit is reached. For English or simplified Chinese scans, run **Run OCR** first, then search and review recognised matches. OCR confidence is displayed; scan quality affects accuracy.
4. Drag an existing box to move it. Select a box and drag its corner handles to resize, or enter X, Y, Width and Height and select **Apply dimensions**. Coordinates are in PDF points.
5. Use **Undo** and **Redo** for drawing, batch marking, moving, resizing, removal and clearing. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z redoes. Focus the page overlay and use arrow keys to move the selected box; Shift moves ten points. Delete removes the selected box. Escape deselects it.
6. Select **Verify & preview PDF**. Review the actual exported pages and jump to marked areas, then select **Download redacted PDF**.
7. Open the downloaded copy and review it before sharing. The preview continues to show the source document with proposed marks.

The original file is never overwritten. Marks are held in browser memory and are lost when the page is refreshed or another PDF is opened.

## Export behaviour

The engine applies permanent redactions to text, covered image pixels, and graphics touched by a marked area. It builds a fresh PDF by grafting the processed pages, removes annotations and selected page-level auxiliary data, and saves with garbage collection and compression. Document-level metadata, attachments, bookmarks, and signatures are not copied. Searchable text outside the marked regions is retained.

After saving, the app reopens the resulting bytes. It checks each marked region for non-whitespace text and checks the interior rendered pixels for a black fill. It blocks download if these checks fail. These checks are limited to marked areas and do not constitute a complete PDF security audit. Shared resources, unusual PDF structures and unmarked sensitive content need further validation before a production release.

Interactive forms are rejected during export. Flatten forms before using PixelSeal. PDFs with signatures should be treated as unsigned output because the original document is rebuilt. Password-protected documents can be opened with their password; output is not encrypted.

## Current scope

Included: local file opening, manual redaction, document text search with reviewed match selection, editable boxes, undo/redo, page navigation, zoom, searchable export, export verification, a worker for PDF processing, bundled MuPDF.js, English and simplified Chinese OCR, offline caching and web app installation.

Not included: automatic detection, image-only export, persistent sessions, or full feature parity with the desktop version. Large PDFs may exceed browser memory. Chrome and Edge are intended targets; the initial UI workflow was checked in Codex's in-app browser. Safari, Firefox and mobile devices have not been validated.

## Checks completed

Run `npm test` (or `node tests.mjs` followed by `node features-tests.mjs` then `node verification-tests.mjs` and `node search-margin-tests.mjs`) with Node.js to repeat the engine checks. Tests create temporary fixtures in `work/qa/` relative to this project.

- Text removal and retention of unaffected searchable text.
- Pages rotated at 0, 90, 180 and 270 degrees.
- Rejection of unredacted text by the verifier.
- Rejection of missing marks and invalid page coordinates.
- Removal of test metadata, attachments and private comments.
- Actual embedded image pixel changes under a marked region.
- Browser workflow: file opening, dragging a box, page navigation and verified PDF download.
- Independent reopening of the browser download and visual inspection of the rendered engine output.

The app has regression checks; it has not been independently certified as a redaction system.

## Licensing and dependencies

MuPDF.js 1.28.1 is bundled in `vendor/`, downloaded from the npm `mupdf` package. Its licence is provided in `vendor/LICENSE`. The app source is provided under AGPL-3.0-or-later; see `LICENSE`.

MuPDF is available under AGPL or a commercial licence from Artifex. Distribution or organisational deployment must comply with the applicable terms. Do not remove licence files when sharing the application.

Official documentation: https://mupdf.readthedocs.io/en/latest/guide/using-with-javascript.html
Licensing: https://mupdf.readthedocs.io/en/latest/license.html

## Version 0.2.0 validation

Search-to-export tests cover all four page rotations and case-insensitive matching. State tests cover undo/redo of edits and clearing, redo invalidation after a new edit, independent history snapshots, movement clamping, and minimum-size resizing. Existing export regression checks remain in place.

## Version 0.2.1 verification fix

Verification uses character bounds calculated from glyph outlines rather than font ascent/descent boxes. This avoids false positives from neighbouring lines whose font boxes overlap a search redaction. ActualText replacements are ignored during this check. Remaining non-whitespace glyphs still fail verification, and black-fill verification is unchanged.

## Version 0.2.2 search-box correction

Search boxes use the matched text extent and avoid neighbouring glyph overhangs. A fixed two-point margin could overlap letters beside a match and cause a legitimate residual-text failure. Glyph-aware boundary adjustment covers horizontal and rotated text. The export verifier is unchanged. Validation against the supplied 45-page risk-management code of practice found 77 workplace matches and confirmed removal of all 693 matched characters while retaining adjacent text. The supplied PDF is not included in the repository.

## Version 0.3.0

English OCR runs locally using bundled Tesseract.js 7.0.0 and tessdata_fast. OCR matches are reviewed before marking; no searchable OCR layer is added to exports. The app includes a manifest, offline service worker, favicon and installation icons. Browser checks cover recognition and verified redaction of an image-only fixture. Third-party OCR licences are in `vendor/ocr/`.

## Version 0.3.1

Protected PDFs open through a masked password dialog with show/hide, retry and cancellation. Passwords stay in memory for the current document; exported copies are unencrypted. RC4-128, AES-128 and AES-256 user/owner-password tests verify text removal and retained public text.

Export now previews the saved PDF before download, with page navigation, jumps to marked areas and a verification summary. The review outline is not written into the PDF.

OCR offers English and simplified Chinese, plus 0/90/180/270-degree processing rotation. Rotation is mapped back to the original page for redaction; original page orientation is retained. Matches below 70% confidence carry an explicit review warning.

Keyboard users can add a centred area without dragging and edit its coordinates. Skip navigation, visible focus, larger touch targets, responsive dialogs and a pan/draw toggle improve accessibility and mobile use.
