# Drive Images → PDF (Local)

Chrome Extension (Manifest V3) that adds a floating button on Google Drive folder pages.
When clicked, it:
- Auto-scrolls to load all items in the current view.
- Detects image files (all common formats except GIF) **in the exact on-screen order**.
- Captures the visible thumbnails (no OAuth, no Drive API).
- Builds a PDF with **one image per page** and a filename **caption**.
- Names the PDF after the current folder (from the page title), falling back to a prompt if not found.
- Saves locally. If the PDF library isn't available, it falls back to a system print-to-PDF dialog.

## Install
1. Download **jsPDF UMD** and place it at `lib/jspdf.umd.min.js` (exact path/filename):
   - From https://github.com/parallax/jsPDF/releases (download the UMD asset) or CDN and save as that filename.
2. Go to `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

## Use
- Navigate to a Google Drive *folder view*.
- Click the **PDF IMG** floating button (bottom-right).
- The extension will scroll through the folder, collect images in the current sort order, and save a PDF named after the folder.

## Notes
- Works from the **visible folder view thumbnails** (fast, no API). It may not be full-resolution.
- Host permissions include `*.googleusercontent.com` to fetch thumbnail blobs for PDF embedding.
- If jsPDF fails to load (e.g., file missing), the extension will open a printable gallery as a fallback.
- Subfolders are ignored by design.
- GIFs are excluded by request.