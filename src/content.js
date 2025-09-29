// Drive Images → PDF (Local) — Content Script (MV3)

// No OAuth. Scrapes current Drive folder view thumbnails in on-screen order.
// Uses jsPDF UMD if available (packaged as lib/jspdf.umd.min.js).

(() => {
  const IMG_EXTS = ['jpg','jpeg','png','webp','bmp','tiff','tif','heic','heif','svg'];
  const EXCLUDE_EXTS = ['gif']; // user request: exclude GIFs

  // UI helpers
  function ensureFab() {
    if (document.getElementById('di2pdf-fab')) return;
    
    const btn = document.createElement('button');
    btn.id = 'di2pdf-fab';
    btn.title = 'Images → PDF';
    btn.textContent = 'PDF\nIMG';
    btn.style.cssText = `
      position: fixed !important;
      right: 24px !important;
      bottom: 24px !important;
      z-index: 2147483647 !important;
      background: #1a73e8 !important;
      color: #fff !important;
      border: none !important;
      width: 56px !important;
      height: 56px !important;
      border-radius: 50% !important;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2) !important;
      cursor: pointer !important;
      font-weight: 700 !important;
      font-size: 11px !important;
      line-height: 1.1 !important;
      padding: 6px !important;
      font-family: Arial, sans-serif !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    `;
    
    document.documentElement.appendChild(btn);
    btn.addEventListener('click', startRun);
    
    // Hover effect
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#155ec2 !important';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#1a73e8 !important';
    });
  }

  function toast(msg, ms=1800) {
    let el = document.getElementById('di2pdf-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'di2pdf-toast';
      el.style.cssText = `
        position: fixed !important;
        left: 50% !important;
        bottom: 96px !important;
        transform: translateX(-50%) !important;
        background: rgba(32,33,36,0.96) !important;
        color: #fff !important;
        padding: 10px 14px !important;
        border-radius: 8px !important;
        font-size: 12px !important;
        z-index: 2147483647 !important;
        display: none !important;
        font-family: Arial, sans-serif !important;
      `;
      document.documentElement.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, ms);
  }

  function showProgress(show, text='') {
    let el = document.getElementById('di2pdf-progress');
    if (!el) {
      el = document.createElement('div');
      el.id = 'di2pdf-progress';
      el.style.cssText = `
        position: fixed !important;
        left: 24px !important;
        bottom: 24px !important;
        z-index: 2147483647 !important;
        background: rgba(255,255,255,0.95) !important;
        border: 1px solid #dadce0 !important;
        border-radius: 10px !important;
        padding: 10px 12px !important;
        font-size: 12px !important;
        color: #202124 !important;
        display: none !important;
        font-family: Arial, sans-serif !important;
      `;
      document.documentElement.appendChild(el);
    }
    el.style.display = show ? 'block' : 'none';
    el.textContent = text;
  }


  // Get PDF name automatically from folder name - BULLET-PROOF version
  async function resolvePdfName() {
    let name = '';
    
    try {
      // Step 1: Try to get from document title
      const title = document.title || '';
      console.log('PDF NAME - Document title:', title);
      
      if (title) {
        // Remove any Google Drive related suffixes (multiple patterns)
        const cleanTitle = title
          .replace(/ - Google Drive.*$/i, '')
          .replace(/ - Drive.*$/i, '')
          .replace(/ - גוגל דרייב.*$/i, '') // Hebrew
          .replace(/ - Google.*$/i, '')
          .replace(/\s*-\s*$/, '') // trailing dash
          .trim();
        
        if (cleanTitle && cleanTitle !== 'Folder' && cleanTitle !== 'Drive' && cleanTitle.length > 0) {
          name = cleanTitle;
          console.log('PDF NAME - Extracted from title:', name);
        }
      }
      
      // Step 2: If title failed, try DOM elements
      if (!name || name === 'Folder' || name === 'Drive') {
        console.log('PDF NAME - Title failed, searching DOM...');
        
        // Try multiple selectors for folder name
        const selectors = [
          '[data-tooltip]',
          '[aria-label*="folder"]', 
          '.ahUTd',
          '[role="button"][aria-label]',
          'h1',
          '.Qrwjsc', // Google Drive specific class
          '[jsname]'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = (element.textContent || element.getAttribute('aria-label') || '').trim();
            
            // Check if this looks like a folder name
            if (text && 
                text.length > 2 && 
                text.length < 100 && // reasonable length
                text !== 'Folder' && 
                text !== 'Drive' && 
                text !== 'Google Drive' &&
                !text.includes('button') && 
                !text.includes('menu') &&
                !text.includes('icon') &&
                !text.includes('http') &&
                !/^\d+$/.test(text)) { // not just numbers
              
              name = text;
              console.log('PDF NAME - Found in DOM:', name, 'from selector:', selector);
              break;
            }
          }
          if (name) break;
        }
      }
      
      // Step 3: Final safety checks and fallback
      if (!name || name.length === 0) {
        name = 'Drive Images';
        console.log('PDF NAME - Using fallback name');
      }
      
      // Step 4: Sanitize for file system safety
      name = name
        .replace(/[\\/:*?"<>|]/g, '-') // Invalid filename chars
        .replace(/[^\w\s\-_.()]/g, '') // Keep only safe chars
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      
      // Final safety check
      if (!name || name.length === 0) {
        name = 'Images';
      }
      
      const finalPdfName = name + '.pdf';
      console.log('PDF NAME - Final result:', finalPdfName);
      return finalPdfName;
      
    } catch (error) {
      // Ultimate error handling
      console.error('PDF NAME - Error occurred:', error);
      return 'Drive-Images.pdf';
    }
  }

  // Smoothly autoscroll the main grid container to load all items
  async function autoscrollGrid(maxMs = 20000) {
    const start = Date.now();
    let prevCount = -1;
    let sameCountStreak = 0;

    function getGrid() {
      // Try the main scrollable grid/list (role="grid")
      return document.querySelector('[role="grid"]') || document.body;
    }
    const grid = getGrid();
    if (!grid) return;

    while (Date.now() - start < maxMs) {
      const items = collectAllFileItemNodes();
      const count = items.length;
      
      if (count === prevCount) {
        sameCountStreak++;
      } else {
        sameCountStreak = 0;
      }
      prevCount = count;

      grid.scrollTo({top: grid.scrollHeight, behavior: 'smooth'});
      await new Promise(r => setTimeout(r, 600));

      // If we've hit the end (no new items twice), stop
      if (sameCountStreak >= 2) break;
    }
  }

  // Heuristic to collect Drive file "item nodes" in visual order
  function collectAllFileItemNodes() {
    // Try list view rows
    let rows = Array.from(document.querySelectorAll('[role="row"][aria-label]'));
    if (rows.length) return rows;

    // Try grid view tiles
    const gridcells = Array.from(document.querySelectorAll('[role="gridcell"][aria-label]'));
    if (gridcells.length) return gridcells;

    // Fallback: clickable cards with aria-label
    const cards = Array.from(document.querySelectorAll('[aria-label][tabindex]'));
    return cards;
  }

  function extractFilenameFromAriaLabel(aria) {
    // Google Drive aria-labels can be:
    // "Clearance.png Image More info (Option + →)" or
    // "IMG_1234.JPG, Image, ..." (older format)
    if (!aria) return '';
    
    // Try comma-separated first (legacy format)
    if (aria.includes(',')) {
      return aria.split(',')[0].trim();
    }
    
    // New format: "filename.ext Image More info..."
    // Extract everything before " Image" or similar keywords
    const match = aria.match(/^(.+?)\s+(Image|Video|Audio|Document|Folder|More\s+info)/i);
    if (match) {
      return match[1].trim();
    }
    
    // Fallback: take first word if it looks like a filename
    const words = aria.split(' ');
    const firstWord = words[0];
    if (firstWord && firstWord.includes('.')) {
      return firstWord;
    }
    
    return '';
  }

  function getExtension(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name);
    return m ? m[1].toLowerCase() : '';
  }

  function isImageByName(name) {
    const ext = getExtension(name);
    if (!ext) return false;
    if (EXCLUDE_EXTS.includes(ext)) return false;
    return IMG_EXTS.includes(ext);
  }

  function findThumbnailImg(node) {
    // Look for child <img> elements that look like thumbnails
    // Prefer highest-res src if multiple.
    const imgs = Array.from(node.querySelectorAll('img[src],img[data-src]'));
    // Filter obvious icons (tiny sizes) by width/height attributes if present
    const candidates = imgs.filter(img => {
      const w = img.naturalWidth || parseInt(img.getAttribute('width') || '0', 10);
      const h = img.naturalHeight || parseInt(img.getAttribute('height') || '0', 10);
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      // Must look like a googleusercontent thumbnail OR a data URL
      const looksLikeThumb = /googleusercontent\.com|=s\d+/.test(src) || src.startsWith('data:');
      return looksLikeThumb || (w >= 64 && h >= 64);
    });
    // Choose the largest by area if dimensions known
    let best = null, bestArea = -1;
    for (const img of candidates) {
      const w = img.naturalWidth || parseInt(img.getAttribute('width') || '0', 10);
      const h = img.naturalHeight || parseInt(img.getAttribute('height') || '0', 10);
      const area = (w && h) ? (w*h) : 0;
      if (area > bestArea) { bestArea = area; best = img; }
    }
    return best || candidates[0] || null;
  }

  // Convert thumbnail URL to full resolution URL
  function thumbnailToFullResolution(thumbnailUrl) {
    if (!thumbnailUrl) return thumbnailUrl;
    
    // Google Drive thumbnail URLs usually have size parameters like =s220, =w220-h220, etc.
    // Remove these to get the full resolution image
    let fullUrl = thumbnailUrl;
    
    // Remove size parameters (=s###, =w###-h###, etc.)
    fullUrl = fullUrl.replace(/=s\d+(-[^&]*)?/, '');
    fullUrl = fullUrl.replace(/=w\d+-h\d+(-[^&]*)?/, '');
    fullUrl = fullUrl.replace(/=w\d+(-[^&]*)?/, '');
    fullUrl = fullUrl.replace(/=h\d+(-[^&]*)?/, '');
    
    // Remove trailing & or ? if they exist due to parameter removal
    fullUrl = fullUrl.replace(/[&?]$/, '');
    
    // For Google Drive, we can also try to add =s0 which often gives full resolution
    if (fullUrl.includes('googleusercontent.com') && !fullUrl.includes('=s')) {
      fullUrl += fullUrl.includes('?') ? '&s=0' : '?s=0';
    }
    
    console.log('Thumbnail to full resolution:', thumbnailUrl, '→', fullUrl);
    return fullUrl;
  }

  async function blobFromImageURL(url) {
    // Fetch as blob; rely on CORS headers from googleusercontent
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch image: ' + res.status);
    return await res.blob();
  }

  async function imageToCanvas(blob) {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return {canvas, width: bitmap.width, height: bitmap.height};
  }

  async function collectImagesData() {
    await autoscrollGrid();
    const nodes = collectAllFileItemNodes();
    const entries = [];
    
    for (const n of nodes) {
      const aria = n.getAttribute('aria-label') || '';
      const filename = extractFilenameFromAriaLabel(aria);
      if (!filename || !isImageByName(filename)) continue;
      
      const img = findThumbnailImg(n);
      if (!img) continue;
      const thumbnailSrc = img.getAttribute('src') || img.getAttribute('data-src');
      if (!thumbnailSrc) continue;
      
      // Convert thumbnail URL to full resolution
      const fullResolutionSrc = thumbnailToFullResolution(thumbnailSrc);
      entries.push({ filename, src: fullResolutionSrc });
    }
    return entries;
  }

  async function buildPdfWithPrint(entries, pdfName) {
    console.log('Using built-in print API for PDF generation');
    showProgress(true, `Preparing PDF… (0 / ${entries.length})`);

    // CRITICAL: Change the main document title to clean PDF name
    const originalTitle = document.title;
    const cleanPdfName = pdfName.replace('.pdf', ''); // Remove .pdf for title
    console.log('Original title:', originalTitle);
    console.log('PDF name received:', pdfName);
    console.log('Clean PDF name for title:', cleanPdfName);
    document.title = cleanPdfName;

    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.width = '8.5in';
    iframe.style.height = '11in';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    // Create HTML document for printing
    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>${cleanPdfName}</title>
  <style>
    @page {
      margin: 0;
      size: A4;
      /* Hide all headers and footers */
      @top-left { content: ""; }
      @top-center { content: ""; }
      @top-right { content: ""; }
      @bottom-left { content: ""; }
      @bottom-center { content: ""; }
      @bottom-right { content: ""; }
    }
    
    * {
      -webkit-print-color-adjust: exact !important;
      color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      background: white !important;
      /* Hide metadata completely */
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
    }
    
    .page {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
      padding: 20px;
      box-sizing: border-box;
      background: white !important;
    }
    
    .page:last-child {
      page-break-after: avoid;
    }
    
    .image-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 85%;
    }
    
    .image {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      object-fit: contain;
      /* Remove border for cleaner look */
      border: none;
    }
    
    .caption {
      height: 15%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 16px;
      font-weight: bold;
      color: #333;
      padding: 0 20px;
      word-break: break-word;
      background: white !important;
    }
    
    @media print {
      html, body { 
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
      
      /* Hide browser headers/footers more aggressively */
      @page {
        margin: 0 !important;
        padding: 0 !important;
      }
      
      body * {
        visibility: visible !important;
      }
      
      .page {
        page-break-after: always;
        width: 100% !important;
        height: 100vh !important;
        margin: 0 !important;
        padding: 20px !important;
        background: white !important;
      }
      
      .image {
        max-width: 100% !important;
        max-height: 100% !important;
        background: white !important;
      }
      
      .caption {
        background: white !important;
        color: #333 !important;
      }
    }
  </style>
</head>
<body>`;

    // Add each image as a page
    for (let i = 0; i < entries.length; i++) {
      const { filename, src } = entries[i];
      showProgress(true, `Processing ${i+1} / ${entries.length}\n${filename}`);
      
      try {
        // Convert image to data URL
        const blob = await blobFromImageURL(src);
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });

        htmlContent += `
  <div class="page">
    <div class="image-container">
      <img class="image" src="${dataUrl}" alt="${filename}">
    </div>
    <div class="caption">${filename}</div>
  </div>`;
      } catch (e) {
        console.warn('Skipping image due to error:', e);
      }
    }

    htmlContent += '</body></html>';

    // Write content to iframe and trigger print
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Wait for images to load
    await new Promise((resolve) => {
      const images = iframeDoc.querySelectorAll('img');
      let loadedCount = 0;
      
      if (images.length === 0) {
        resolve();
        return;
      }
      
      images.forEach(img => {
        if (img.complete) {
          loadedCount++;
          if (loadedCount === images.length) resolve();
        } else {
          img.onload = () => {
            loadedCount++;
            if (loadedCount === images.length) resolve();
          };
        }
      });
    });

    showProgress(true, 'Opening print dialog…');

    // Focus iframe and trigger print
    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    // Clean up after a delay and restore original title
    setTimeout(() => {
      document.body.removeChild(iframe);
      document.title = originalTitle; // Restore original title
      showProgress(false);
      toast(`Print dialog opened for "${pdfName}"`);
    }, 1000);
  }

  async function startRun() {
    try {
      toast('Scanning images…');
      const pdfName = await resolvePdfName();
      const entries = await collectImagesData();
      if (!entries.length) {
        toast('No images detected in this view.');
        return;
      }

      // Use built-in print API - works reliably in all browsers
      await buildPdfWithPrint(entries, pdfName);
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    }
  }

  // Insert FAB once Drive UI is ready
  const readyObs = new MutationObserver(() => {
    if (location.hostname.includes('drive.google.com')) {
      const grid = document.querySelector('[role="grid"]');
      const fileList = document.querySelector('[data-target="file"]');
      const driveContent = document.querySelector('[data-testid], [jscontroller], [data-ved]');
      
      if (grid || fileList || driveContent || document.body.children.length > 3) {
        ensureFab();
      }
    }
  });
  readyObs.observe(document.documentElement, { childList: true, subtree: true });
  
  // Also try to show FAB immediately if page is already loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
      if (location.hostname.includes('drive.google.com')) {
        ensureFab();
      }
    }, 1000);
  }

  // Force FAB creation after 3 seconds regardless
  setTimeout(() => {
    if (location.hostname.includes('drive.google.com')) {
      ensureFab();
    }
  }, 3000);
})();