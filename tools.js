/* =========================================================
   H🌸PE PDF — Tools
   Each tool is registered through window.HopeWS.register(name, config)

   Config shape:
   {
     title:       string  shown in workspace header
     subtitle:    string  shown under header
     cardCategory:'organize'|'optimize'|'convert'|'edit'|'security'|'intelligence'|'workflow'
     cardDesc:    string  description on tool grid card
     icon:        string  HTML/SVG/emoji for tool grid card
     tag:         string? optional ribbon ("New", "AI", "Beta")
     format:      'pdf'|'word'|'image'|'excel'|'ppt'|'html'   strict input format
     multiple:    boolean true if tool accepts >1 file
     minFiles:    number  default 1
     dzTitle/dzSub: optional dropzone copy
     optionsHtml: string  HTML for option fields rendered in workspace
     runLabel:    string  label for run button
     run(files, opts, helpers): async function performing the work
   }
   ========================================================= */

(() => {
  'use strict';

  const HopeWS = window.HopeWS;
  if (!HopeWS) { console.error('HopeWS missing — tools.js loaded too early.'); return; }

  // ───────────────── helpers ─────────────────
  const { PDFDocument, rgb, degrees, StandardFonts } = window.PDFLib || {};

  async function loadPdf(file) {
    const bytes = await file.arrayBuffer();
    return await PDFDocument.load(bytes, { ignoreEncryption: true });
  }

  function safeName(name, suffix, ext = 'pdf') {
    const base = (name || 'file').replace(/\.[a-z0-9]+$/i, '');
    return `${base}${suffix ? '_' + suffix : ''}.${ext}`;
  }

  function parsePageRanges(input, total) {
    // "1,3-5,7" → [0,2,3,4,6]
    if (!input) return [];
    const out = new Set();
    String(input).split(',').forEach(part => {
      const t = part.trim();
      if (!t) return;
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let a = +m[1], b = +m[2];
        if (a > b) [a, b] = [b, a];
        for (let i = a; i <= b; i++) if (i >= 1 && i <= total) out.add(i - 1);
      } else {
        const n = +t;
        if (Number.isFinite(n) && n >= 1 && n <= total) out.add(n - 1);
      }
    });
    return Array.from(out).sort((a, b) => a - b);
  }

  function stub(toolName) {
    return async function (files, opts, { toast }) {
      toast('info', 'Coming soon',
        `${toolName} runs locally and is wired up but not finished yet — your files are safe; nothing was uploaded.`);
    };
  }

  /* ------------------------------------------------------------------
   * Homepage bucket map
   *   homepageBucket: 'pdf' | 'word' | 'image' | 'others' | undefined
   *   comingSoon:     true  → render as disabled card (no click-through)
   * Tools without homepageBucket stay searchable + reachable from the
   * mega-menu but do not occupy a homepage slot.
   * ------------------------------------------------------------------ */

  // ───────────────── 1. MERGE ─────────────────
  HopeWS.register('merge', {
    title: 'Merge PDF',
    subtitle: 'Combine PDFs in any order — drag to reorder.',
    cardCategory: 'organize',
    homepageBucket: 'pdf',
    cardDesc: 'Combine multiple PDFs into a single document. Drag to reorder.',
    icon: '🗂️',
    tag: 'Popular',
    format: 'pdf',
    multiple: true,
    minFiles: 2,
    dzTitle: 'Drop your PDFs here',
    dzSub: 'Choose two or more — drag them to reorder before merging',
    optionsHtml: `
      <div class="opt-row">
        <label class="opt-check"><input type="checkbox" name="bookmarks" checked> Add bookmarks for each file</label>
      </div>`,
    runLabel: 'Merge PDFs',
    async run(files, opts, { downloadBlob }) {
      const out = await PDFDocument.create();
      for (const f of files) {
        const src = await loadPdf(f);
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach(p => out.addPage(p));
      }
      const bytes = await out.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'hope-merged.pdf');
    },
  });

  // ───────────────── 2. SPLIT ─────────────────
  HopeWS.register('split', {
    title: 'Split PDF',
    subtitle: 'Extract or break apart a PDF into smaller files.',
    cardCategory: 'organize',
    homepageBucket: 'pdf',
    cardDesc: 'Extract page ranges or split a PDF into individual pages.',
    icon: '✂️',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>
          Mode
          <select name="mode">
            <option value="ranges">Custom ranges (e.g. 1-3, 5, 7-9)</option>
            <option value="every">One PDF per page</option>
          </select>
        </label>
        <label>
          Ranges
          <input type="text" name="ranges" placeholder="1-3, 5, 7-9">
        </label>
      </div>`,
    runLabel: 'Split PDF',
    async run(files, opts, { downloadBlob, toast }) {
      const file = files[0];
      const src = await loadPdf(file);
      const total = src.getPageCount();
      const mode = opts.mode || 'ranges';

      if (mode === 'every') {
        for (let i = 0; i < total; i++) {
          const out = await PDFDocument.create();
          const [p] = await out.copyPages(src, [i]);
          out.addPage(p);
          const bytes = await out.save();
          downloadBlob(new Blob([bytes], { type: 'application/pdf' }), safeName(file.name, `page-${i + 1}`));
        }
        return;
      }
      const indexes = parsePageRanges(opts.ranges, total);
      if (!indexes.length) {
        toast('error', 'No valid pages', `Use page numbers between 1 and ${total}.`);
        return;
      }
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, indexes);
      pages.forEach(p => out.addPage(p));
      const bytes = await out.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), safeName(file.name, 'split'));
    },
  });

  // ───────────────── 3. COMPRESS ─────────────────
  HopeWS.register('compress', {
    title: 'Compress PDF',
    homepageBucket: 'pdf',
    subtitle: 'Reduce file size while keeping quality acceptable.',
    cardCategory: 'optimize',
    cardDesc: 'Reduce PDF file size for easy sharing.',
    icon: '🗜️',
    tag: 'Popular',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>
          Level
          <select name="level">
            <option value="low">Light — least compression</option>
            <option value="medium" selected>Recommended</option>
            <option value="high">High — smallest size</option>
          </select>
        </label>
      </div>
      <p class="opt-hint">Browser-side compression rebuilds and re-saves the document with optimized object streams. Your file is never uploaded.</p>`,
    runLabel: 'Compress PDF',
    async run(files, opts, { downloadBlob, toast }) {
      const file = files[0];
      const src = await loadPdf(file);
      // pdf-lib doesn't do image recompression; we re-save with object streams which still saves bytes.
      const bytes = await src.save({ useObjectStreams: true, addDefaultPage: false });
      const ratio = ((1 - bytes.byteLength / file.size) * 100).toFixed(1);
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), safeName(file.name, 'compressed'));
      if (bytes.byteLength < file.size) {
        toast('success', 'Saved space', `Reduced by ${ratio}%.`);
      }
    },
  });

  // ───────────────── 4. ROTATE ─────────────────
  HopeWS.register('rotate', {
    title: 'Rotate PDF',
    subtitle: 'Rotate all pages or selected pages.',
    cardCategory: 'edit',
    cardDesc: 'Rotate every page or a specific range — 90°, 180°, or 270°.',
    icon: '🔄',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>
          Rotation
          <select name="angle">
            <option value="90">90° clockwise</option>
            <option value="180">180°</option>
            <option value="270">270° (90° counter-clockwise)</option>
          </select>
        </label>
        <label>
          Pages
          <input type="text" name="pages" placeholder="all  or  1-3, 5">
        </label>
      </div>`,
    runLabel: 'Rotate PDF',
    async run(files, opts, { downloadBlob }) {
      const file = files[0];
      const src = await loadPdf(file);
      const total = src.getPageCount();
      const angle = parseInt(opts.angle || '90', 10);
      const indices = (!opts.pages || /^all$/i.test(opts.pages.trim()))
        ? src.getPageIndices()
        : parsePageRanges(opts.pages, total);
      indices.forEach(i => {
        const p = src.getPage(i);
        const cur = p.getRotation().angle || 0;
        p.setRotation(degrees((cur + angle) % 360));
      });
      const bytes = await src.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), safeName(file.name, 'rotated'));
    },
  });

  // ───────────────── 5. WATERMARK ─────────────────
  HopeWS.register('watermark', {
    title: 'Watermark PDF',
    subtitle: 'Place a text watermark on every page.',
    cardCategory: 'edit',
    cardDesc: 'Stamp a text watermark across every page — opacity & position.',
    icon: '💧',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>Text <input type="text" name="text" value="CONFIDENTIAL"></label>
        <label>
          Position
          <select name="pos">
            <option value="center" selected>Center diagonal</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
          </select>
        </label>
        <label>Opacity (0.05–1)
          <input type="number" name="opacity" min="0.05" max="1" step="0.05" value="0.25">
        </label>
      </div>`,
    runLabel: 'Add Watermark',
    async run(files, opts, { downloadBlob }) {
      const file = files[0];
      const src = await loadPdf(file);
      const font = await src.embedFont(StandardFonts.HelveticaBold);
      const text = String(opts.text || 'CONFIDENTIAL');
      const opacity = Math.max(0.05, Math.min(1, parseFloat(opts.opacity) || 0.25));
      const pos = opts.pos || 'center';

      src.getPages().forEach(page => {
        const { width, height } = page.getSize();
        const size = Math.min(width, height) * 0.12;
        const tw = font.widthOfTextAtSize(text, size);
        let x = (width - tw) / 2;
        let y = height / 2;
        let rot = degrees(45);
        if (pos === 'top')    { y = height - size * 1.5; rot = degrees(0); }
        if (pos === 'bottom') { y = size * 0.5;          rot = degrees(0); }

        page.drawText(text, {
          x, y,
          size,
          font,
          color: rgb(0.85, 0.45, 0.6),
          opacity,
          rotate: rot,
        });
      });
      const bytes = await src.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), safeName(file.name, 'watermarked'));
    },
  });

  // ───────────────── 6. PDF → WORD (page-as-image, layout-preserving) ─────────────────
  // Strategy (frontend-only, layout-faithful):
  //   1) pdf.js renders each page onto a canvas at 2× scale
  //   2) canvas.toBlob → PNG bytes
  //   3) docx ImageRun embeds each page as a full-bleed image inside
  //      its own A4 section so spacing, alignment, columns, tables,
  //      diagrams, and images all survive verbatim.
  //
  // Trade-off: the resulting .docx is *not* text-editable in Word. This
  // is a deliberate choice — pure-browser DOCX with editable text *and*
  // perfect layout is unsolved. If you need text editability, see the
  // backend-route note at the bottom of this file.
  HopeWS.register('pdf2word', {
    title: 'PDF to Word',
    subtitle: 'Each PDF page is embedded into Word as a high-fidelity image — layout preserved.',
    cardCategory: 'convert',
    homepageBucket: 'pdf',
    cardDesc: 'Convert PDFs into Word with full layout, images, tables, and spacing preserved.',
    icon: '📝',
    format: 'pdf',
    multiple: true,
    minFiles: 1,
    optionsHtml: `
      <div class="opt-row">
        <label>Image quality
          <select name="quality">
            <option value="1.5">Standard (smaller file)</option>
            <option value="2" selected>High (recommended)</option>
            <option value="3">Ultra (large file)</option>
          </select>
        </label>
      </div>
      <p class="opt-hint">Each page is captured as a high-resolution image and placed in Word at A4 size.
        For text-editable output (with table/structure recovery), a backend converter is required —
        see the comment block in <code>tools.js</code> for the recommended pipeline.</p>`,
    runLabel: 'Convert to Word',
    async run(files, opts, { downloadBlob, toast }) {
      const { Document, Packer, Paragraph, ImageRun } = window.docx;
      const scale = Math.max(1.5, Math.min(3, parseFloat(opts.quality) || 2));

      // A4 page size in EMU-equivalent pixels (docx uses px @ 96 dpi).
      // ~ 8.27" × 11.69" minus 0.5" margins on each side ≈ 720 × 1040 px usable.
      const PAGE_W = 720;

      for (const file of files) {
        let pdf;
        try {
          const buf = await file.arrayBuffer();
          pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
        } catch (e) {
          toast('error', 'Could not read PDF', `${file.name} appears corrupted or password-protected.`);
          continue;
        }

        const children = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);

          // STEP 1: render this page to a canvas at the chosen scale
          const viewport = page.getViewport({ scale });
          const canvas   = document.createElement('canvas');
          canvas.width   = Math.ceil(viewport.width);
          canvas.height  = Math.ceil(viewport.height);
          const ctx      = canvas.getContext('2d');
          ctx.fillStyle  = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;

          // STEP 2: snapshot canvas → PNG bytes
          const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
          if (!blob) continue;
          const pngBytes = new Uint8Array(await blob.arrayBuffer());

          // STEP 3: embed at A4 page width, preserve aspect ratio
          const targetW = PAGE_W;
          const targetH = Math.round((viewport.height / viewport.width) * targetW);

          children.push(new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [new ImageRun({
              data: pngBytes,
              transformation: { width: targetW, height: targetH }
            })]
          }));
        }

        if (!children.length) {
          toast('error', 'No pages rendered', `${file.name} produced no usable pages.`);
          continue;
        }

        const doc = new Document({
          sections: [{
            properties: {
              // Tight margins so each page-image sits flush — keeps the
              // 1-page-PDF → 1-page-DOCX correspondence intact.
              page: { margin: { top: 360, right: 360, bottom: 360, left: 360 } }
            },
            children
          }]
        });

        const out = await Packer.toBlob(doc);
        downloadBlob(out, safeName(file.name, '', 'docx'));
      }
    },
  });

  /* ─── Optional backend route (NOT enabled — for reference) ───────────
   * If you can run a small server alongside this site, you can swap the
   * frontend pipeline above for a real text-editable conversion:
   *
   *   pdf2docx (Python)
   *     pip install pdf2docx
   *     from pdf2docx import Converter
   *     Converter(src).convert(dst); cv.close()
   *   → preserves text, tables, headings, images.  Best free option.
   *
   *   LibreOffice headless
   *     soffice --headless --convert-to docx file.pdf
   *   → fast, ships with most Linux distros, tables decent.
   *
   * Either one would expose a POST /api/pdf2word endpoint that this
   * tool's run() could call instead of the canvas pipeline. Until then,
   * the in-browser image-per-page route is what's wired up.
   * ───────────────────────────────────────────────────────────────── */

  // ───────────────── 7. WORD → PDF (mammoth → jsPDF, multi-file) ─────────────────
  HopeWS.register('word2pdf', {
    title: 'Word to PDF',
    subtitle: 'Turn one or several .doc/.docx files into PDFs.',
    cardCategory: 'convert',
    homepageBucket: 'word',
    cardDesc: 'Convert Microsoft Word documents into clean PDFs.',
    icon: '📄',
    format: 'word',
    multiple: true,
    minFiles: 1,
    runLabel: 'Convert to PDF',
    async run(files, opts, { downloadBlob, toast }) {
      const { jsPDF } = window.jspdf;
      let succeeded = 0;
      for (const file of files) {
        let raw;
        try {
          raw = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        } catch (e) {
          toast('error', 'Could not parse', `${file.name} could not be read. Save as .docx (not legacy .doc) and retry.`);
          continue;
        }
        const text = (raw.value || '').trim();
        if (!text) { toast('error', 'Empty document', `${file.name} has no readable text.`); continue; }

        const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
        const margin = 48;
        const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2;
        const lineHeight = 16;
        let y = margin;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        for (const line of pdf.splitTextToSize(text, maxWidth)) {
          if (y > pdf.internal.pageSize.getHeight() - margin) { pdf.addPage(); y = margin; }
          pdf.text(line, margin, y);
          y += lineHeight;
        }
        downloadBlob(pdf.output('blob'), safeName(file.name, '', 'pdf'));
        succeeded++;
      }
      if (!succeeded) throw new Error('No files were converted.');
    },
  });

  // ───────────────── 7b. WORD ORGANIZE (basic paragraph reorder) ─────────────────
  // Reads a .docx with mammoth, splits into paragraphs by blank lines, lets the
  // user supply a comma-separated 1-based order (e.g. "3,1,2,4") and writes a
  // fresh .docx with paragraphs in that order. Heavy formatting is intentionally
  // dropped so the output is predictable.
  HopeWS.register('word-organize', {
    title: 'Word Organize',
    subtitle: 'Reorder paragraphs in a .docx file.',
    cardCategory: 'organize',
    homepageBucket: 'word',
    cardDesc: 'Reorganize the paragraphs in a Word document.',
    icon: '🧾',
    format: 'word',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>Order
          <input type="text" name="order" placeholder="e.g. 3, 1, 2, 4 — leave empty to keep current order">
        </label>
      </div>
      <p class="opt-hint">Tip: paragraphs are split on blank lines. Save your doc as .docx for best results.</p>`,
    runLabel: 'Reorder Word',
    async run(files, opts, { downloadBlob }) {
      const { Document, Packer, Paragraph, TextRun } = window.docx;
      const file = files[0];
      const buf = await file.arrayBuffer();
      const { value: raw } = await window.mammoth.extractRawText({ arrayBuffer: buf });
      const paragraphs = (raw || '').split(/\r?\n\s*\r?\n+/).map(s => s.trim()).filter(Boolean);
      if (!paragraphs.length) throw new Error('No paragraphs found in this document.');

      let order;
      const orderStr = (opts.order || '').trim();
      if (orderStr) {
        order = orderStr.split(/[,\s]+/).map(n => parseInt(n, 10) - 1)
          .filter(i => Number.isFinite(i) && i >= 0 && i < paragraphs.length);
        if (!order.length) throw new Error(`Use numbers 1–${paragraphs.length}.`);
      } else {
        order = paragraphs.map((_, i) => i);
      }

      const doc = new Document({
        sections: [{ children: order.map(i => new Paragraph({ children: [new TextRun(paragraphs[i])] })) }]
      });
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, safeName(file.name, 'organized', 'docx'));
    },
  });

  // ───────────────── 8. JPG / IMAGE → PDF ─────────────────
  HopeWS.register('jpg2pdf', {
    title: 'JPG to PDF',
    subtitle: 'Combine JPG/PNG images into a PDF — drag to reorder.',
    cardCategory: 'convert',
    homepageBucket: 'image',
    cardDesc: 'Combine JPG/PNG images into a single PDF, in any order.',
    icon: '🖼️',
    format: 'image',
    multiple: true,
    minFiles: 1,
    optionsHtml: `
      <div class="opt-row">
        <label>
          Page size
          <select name="size">
            <option value="fit" selected>Fit each image</option>
            <option value="A4">A4</option>
            <option value="Letter">US Letter</option>
          </select>
        </label>
        <label>
          Margin
          <select name="margin">
            <option value="0" selected>None</option>
            <option value="24">Small</option>
            <option value="48">Large</option>
          </select>
        </label>
      </div>`,
    runLabel: 'Create PDF',
    async run(files, opts, { downloadBlob }) {
      const out = await PDFDocument.create();
      const margin = parseInt(opts.margin || '0', 10);
      const PAGES = { A4: [595.28, 841.89], Letter: [612, 792] };
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const img = /\.(png)$/i.test(f.name)
          ? await out.embedPng(bytes)
          : await out.embedJpg(bytes);
        let page;
        if (opts.size === 'fit' || !opts.size) {
          page = out.addPage([img.width + margin * 2, img.height + margin * 2]);
          page.drawImage(img, { x: margin, y: margin, width: img.width, height: img.height });
        } else {
          const [pw, ph] = PAGES[opts.size] || PAGES.A4;
          page = out.addPage([pw, ph]);
          const aw = pw - margin * 2;
          const ah = ph - margin * 2;
          const ratio = Math.min(aw / img.width, ah / img.height);
          const w = img.width * ratio;
          const h = img.height * ratio;
          page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
        }
      }
      const bytes = await out.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'hope-images.pdf');
    },
  });
  // alias
  HopeWS.register('image2pdf', {
    title: 'Image to PDF',
    subtitle: 'Same as JPG to PDF — accepts JPG and PNG.',
    cardCategory: 'convert',
    cardDesc: 'Quick alias for converting images to a PDF.',
    icon: '📸',
    format: 'image',
    multiple: true,
    minFiles: 1,
    runLabel: 'Create PDF',
    async run(files, opts, helpers) {
      const tools = window.HopeWS;
      // delegate to jpg2pdf logic by manually mirroring (avoid private state)
      const out = await PDFDocument.create();
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const img = /\.(png)$/i.test(f.name) ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const page = out.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      const bytes = await out.save();
      helpers.downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'hope-images.pdf');
    },
  });

  // ───────────────── 8b. IMAGE COMPRESS (JPG/PNG → JPG, batch) ─────────────────
  // Re-encodes JPG/PNG inputs as JPG at the chosen quality. Lossless PNG inputs
  // become lossy JPG outputs — there's no real "compress PNG" in pure browser JS
  // without per-codec libs, and JPG re-encode is what users actually want for
  // storage savings.
  HopeWS.register('image-compress', {
    title: 'Image Compress',
    subtitle: 'Shrink JPG/PNG by re-encoding at your chosen quality.',
    cardCategory: 'optimize',
    homepageBucket: 'image',
    cardDesc: 'Reduce JPG/PNG file size with a quality slider.',
    icon: '🪶',
    format: 'image',
    multiple: true,
    minFiles: 1,
    optionsHtml: `
      <div class="opt-row">
        <label>Quality
          <input type="range" name="quality" min="0.3" max="0.95" step="0.05" value="0.7">
          <span class="opt-out" data-out="quality">70%</span>
        </label>
      </div>`,
    runLabel: 'Compress',
    async run(files, opts, { downloadBlob }) {
      const q = Math.max(0.3, Math.min(0.95, parseFloat(opts.quality) || 0.7));
      for (const f of files) {
        const url = URL.createObjectURL(f);
        try {
          const img = await new Promise((res, rej) => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = () => rej(new Error(`Could not read ${f.name}.`));
            im.src = url;
          });
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
          downloadBlob(blob, safeName(f.name, 'compressed', 'jpg'));
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    },
  });

  // ───────────────── 9. PDF → JPG ─────────────────
  HopeWS.register('pdf2jpg', {
    title: 'PDF to JPG',
    subtitle: 'Save each page of your PDF as a JPG image.',
    cardCategory: 'convert',
    homepageBucket: 'pdf',
    cardDesc: 'Render every page of a PDF to high-quality JPG images.',
    icon: '🌅',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>
          Quality
          <select name="quality">
            <option value="0.7">Standard</option>
            <option value="0.9" selected>High</option>
            <option value="1.0">Maximum</option>
          </select>
        </label>
        <label>
          Scale
          <select name="scale">
            <option value="1.5">1.5×</option>
            <option value="2" selected>2×</option>
            <option value="3">3×</option>
          </select>
        </label>
      </div>`,
    runLabel: 'Convert to JPG',
    async run(files, opts, { downloadBlob }) {
      const file = files[0];
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      const scale = parseFloat(opts.scale) || 2;
      const quality = parseFloat(opts.quality) || 0.9;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const c = document.createElement('canvas');
        c.width = viewport.width;
        c.height = viewport.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
        const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', quality));
        downloadBlob(blob, safeName(file.name, `page-${i}`, 'jpg'));
      }
    },
  });

  // ───────────────── 10. PAGE NUMBERS ─────────────────
  HopeWS.register('page-numbers', {
    title: 'Page Numbers',
    subtitle: 'Stamp page numbers on every page.',
    cardCategory: 'edit',
    cardDesc: 'Add elegant page numbers to your PDF — pick position & style.',
    icon: '🔢',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>
          Position
          <select name="pos">
            <option value="bottom-center" selected>Bottom center</option>
            <option value="bottom-right">Bottom right</option>
            <option value="top-right">Top right</option>
          </select>
        </label>
        <label>Start at <input type="number" name="start" value="1" min="1"></label>
      </div>`,
    runLabel: 'Add page numbers',
    async run(files, opts, { downloadBlob }) {
      const file = files[0];
      const src = await loadPdf(file);
      const font = await src.embedFont(StandardFonts.Helvetica);
      const start = parseInt(opts.start || '1', 10);
      src.getPages().forEach((page, i) => {
        const num = start + i;
        const { width, height } = page.getSize();
        const txt = String(num);
        const size = 11;
        const tw = font.widthOfTextAtSize(txt, size);
        let x = width / 2 - tw / 2;
        let y = 24;
        if (opts.pos === 'bottom-right') { x = width - tw - 36; y = 24; }
        if (opts.pos === 'top-right')    { x = width - tw - 36; y = height - 28; }
        page.drawText(txt, { x, y, size, font, color: rgb(0.4, 0.3, 0.35) });
      });
      const bytes = await src.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), safeName(file.name, 'numbered'));
    },
  });

  // ───────────────── 11. REMOVE PAGES ─────────────────
  HopeWS.register('remove-pages', {
    title: 'Remove Pages',
    subtitle: 'Delete specific pages from a PDF.',
    cardCategory: 'organize',
    cardDesc: 'Delete pages you no longer need from a PDF.',
    icon: '🗑️',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>Pages to remove <input type="text" name="pages" placeholder="e.g. 2, 5-7"></label>
      </div>`,
    runLabel: 'Remove pages',
    async run(files, opts, { downloadBlob, toast }) {
      const file = files[0];
      const src = await loadPdf(file);
      const total = src.getPageCount();
      const remove = new Set(parsePageRanges(opts.pages, total));
      if (!remove.size) { toast('error', 'No pages picked', 'Specify which pages to remove.'); return; }
      // Remove from highest index first
      Array.from(remove).sort((a, b) => b - a).forEach(i => src.removePage(i));
      const bytes = await src.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), safeName(file.name, 'edited'));
    },
  });

  // ───────────────── 12. EXTRACT PAGES ─────────────────
  HopeWS.register('extract-pages', {
    title: 'Extract Pages',
    subtitle: 'Pull specific pages out of a PDF.',
    cardCategory: 'organize',
    cardDesc: 'Pull out the pages you need from a larger PDF.',
    icon: '📑',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>Pages to keep <input type="text" name="pages" placeholder="e.g. 1-3, 7"></label>
      </div>`,
    runLabel: 'Extract',
    async run(files, opts, { downloadBlob, toast }) {
      const file = files[0];
      const src = await loadPdf(file);
      const total = src.getPageCount();
      const keep = parsePageRanges(opts.pages, total);
      if (!keep.length) { toast('error', 'No pages picked', 'Specify which pages to extract.'); return; }
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, keep);
      pages.forEach(p => out.addPage(p));
      const bytes = await out.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), safeName(file.name, 'extracted'));
    },
  });

  // ───────────────── 13. ORGANIZE / REORDER ─────────────────
  HopeWS.register('organize', {
    title: 'Organize PDF',
    subtitle: 'Reorder pages — provide a comma-separated 1-based page order.',
    cardCategory: 'organize',
    homepageBucket: 'others',
    cardDesc: 'Reorder or remove pages by listing the order you want.',
    icon: '🧩',
    tag: 'New',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>Page order
          <input type="text" name="order" placeholder="e.g. 3,1,2,4 — leave empty to keep current order">
        </label>
      </div>
      <p class="opt-hint">Pages not listed are dropped. Same number twice = duplicate.</p>`,
    runLabel: 'Save reordered PDF',
    async run(files, opts, { downloadBlob }) {
      const file = files[0];
      const src = await loadPdf(file);
      const total = src.getPageCount();
      const orderStr = (opts.order || '').trim();
      let order;
      if (orderStr) {
        order = orderStr.split(/[,\s]+/).map(n => parseInt(n, 10) - 1)
          .filter(i => Number.isFinite(i) && i >= 0 && i < total);
        if (!order.length) throw new Error(`Use page numbers between 1 and ${total}.`);
      } else {
        order = src.getPageIndices();
      }
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, order);
      pages.forEach(p => out.addPage(p));
      const bytes = await out.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), safeName(file.name, 'organized'));
    },
  });

  // ───────────────── 14. CROP PDF ─────────────────
  HopeWS.register('crop', {
    title: 'Crop PDF',
    subtitle: 'Trim margins around the content of every page.',
    cardCategory: 'edit',
    cardDesc: 'Trim the margins around every page of your PDF.',
    icon: '✂️',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>Top margin <input type="number" name="top" value="20" min="0"></label>
        <label>Right margin <input type="number" name="right" value="20" min="0"></label>
        <label>Bottom margin <input type="number" name="bottom" value="20" min="0"></label>
        <label>Left margin <input type="number" name="left" value="20" min="0"></label>
      </div>
      <p class="opt-hint">Margins are in points (72 = 1 inch). Crops the visible page box only.</p>`,
    runLabel: 'Crop PDF',
    async run(files, opts, { downloadBlob }) {
      const file = files[0];
      const src = await loadPdf(file);
      const t = +opts.top    || 0;
      const r = +opts.right  || 0;
      const b = +opts.bottom || 0;
      const l = +opts.left   || 0;
      src.getPages().forEach(p => {
        const { width, height } = p.getSize();
        p.setCropBox(l, b, Math.max(10, width - l - r), Math.max(10, height - t - b));
      });
      const bytes = await src.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), safeName(file.name, 'cropped'));
    },
  });

  // ───────────────── 15-29. UI-only stubs ─────────────────
  // Each is fully wired to the workspace and validates input;
  // pressing Run shows a friendly "coming soon" toast.

  HopeWS.register('scan2pdf', {
    title: 'Scan to PDF',
    subtitle: 'Use your camera to scan documents into a PDF.',
    cardCategory: 'convert',
    cardDesc: 'Scan paper documents to PDF using your camera.',
    icon: '📷',
    format: 'image',
    multiple: true,
    runLabel: 'Build PDF',
    run: stub('Scan to PDF'),
  });

  HopeWS.register('repair', {
    title: 'Repair PDF',
    subtitle: 'Try to recover corrupted or damaged PDFs.',
    cardCategory: 'optimize',
    cardDesc: 'Recover damaged or partially corrupted PDFs.',
    icon: '🩹',
    format: 'pdf',
    multiple: false,
    runLabel: 'Repair',
    run: stub('Repair'),
  });

  HopeWS.register('ocr', {
    title: 'OCR PDF',
    subtitle: 'Recognize text inside scanned PDFs.',
    cardCategory: 'intelligence',
    cardDesc: 'Make scanned PDFs searchable with optical character recognition.',
    icon: '🔎',
    tag: 'AI',
    format: 'pdf',
    multiple: false,
    runLabel: 'Run OCR',
    run: stub('OCR'),
  });

  HopeWS.register('ppt2pdf', {
    title: 'PowerPoint to PDF',
    subtitle: 'Convert .ppt/.pptx slides to PDF.',
    cardCategory: 'convert',
    cardDesc: 'Convert PowerPoint slides to a clean PDF document.',
    icon: '🎞️',
    format: 'ppt',
    multiple: false,
    runLabel: 'Convert',
    run: stub('PowerPoint to PDF'),
  });

  HopeWS.register('excel2pdf', {
    title: 'Excel to PDF',
    subtitle: 'Convert .xls/.xlsx spreadsheets to PDF.',
    cardCategory: 'convert',
    cardDesc: 'Convert Excel sheets into a printable PDF.',
    icon: '📊',
    format: 'excel',
    multiple: false,
    runLabel: 'Convert',
    run: stub('Excel to PDF'),
  });

  HopeWS.register('pdf2ppt', {
    title: 'PDF to PowerPoint',
    subtitle: 'Turn each page into a slide.',
    cardCategory: 'convert',
    cardDesc: 'Turn each PDF page into an editable slide.',
    icon: '🖥️',
    format: 'pdf',
    multiple: false,
    runLabel: 'Convert',
    run: stub('PDF to PowerPoint'),
  });

  HopeWS.register('pdf2excel', {
    title: 'PDF to Excel',
    subtitle: 'Extract tables into a spreadsheet.',
    cardCategory: 'convert',
    cardDesc: 'Extract tables from PDFs into editable Excel sheets.',
    icon: '📈',
    format: 'pdf',
    multiple: false,
    runLabel: 'Convert',
    run: stub('PDF to Excel'),
  });

  // ───────────────── HTML → PDF (real impl) ─────────────────
  // Reads the uploaded HTML inside a sandboxed iframe (so any embedded
  // <script> can't run against our window) and uses jsPDF.html() with
  // html2canvas to rasterize. Falls back to plain-text typesetting if
  // html2canvas isn't available.
  HopeWS.register('html2pdf', {
    title: 'HTML to PDF',
    subtitle: 'Convert a saved HTML page into a clean PDF.',
    cardCategory: 'convert',
    homepageBucket: 'others',
    cardDesc: 'Convert a saved HTML page into a clean PDF.',
    icon: '🌐',
    format: 'html',
    multiple: false,
    runLabel: 'Convert to PDF',
    async run(files, opts, { downloadBlob }) {
      const file = files[0];
      const html = await file.text();

      // sandboxed iframe so any inline <script> is neutralised
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-same-origin');
      frame.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;height:auto;background:#fff;';
      document.body.appendChild(frame);
      frame.contentDocument.open();
      frame.contentDocument.write(`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#111;background:#fff;}img{max-width:100%}</style></head><body>${html}</body></html>`);
      frame.contentDocument.close();
      await new Promise(r => setTimeout(r, 80));

      const { jsPDF } = window.jspdf;
      try {
        if (window.html2canvas) {
          const canvas = await window.html2canvas(frame.contentDocument.body, { scale: 2, backgroundColor: '#ffffff' });
          const img = canvas.toDataURL('image/jpeg', 0.92);
          const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
          pdf.addImage(img, 'JPEG', 0, 0, canvas.width, canvas.height);
          downloadBlob(pdf.output('blob'), safeName(file.name, '', 'pdf'));
        } else {
          // Fallback: dump visible text into A4
          const text = (frame.contentDocument.body.innerText || '').trim() || 'Empty document';
          const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
          const margin = 48;
          const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2;
          let y = margin;
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12);
          for (const line of pdf.splitTextToSize(text, maxWidth)) {
            if (y > pdf.internal.pageSize.getHeight() - margin) { pdf.addPage(); y = margin; }
            pdf.text(line, margin, y);
            y += 16;
          }
          downloadBlob(pdf.output('blob'), safeName(file.name, '', 'pdf'));
        }
      } finally {
        frame.remove();
      }
    },
  });

  // PDF/A — kept registered so the mega-menu link still works, but
  // hidden from the homepage per spec ("Coming Soon" must NOT appear there).
  HopeWS.register('pdf2pdfa', {
    title: 'PDF to PDF/A',
    subtitle: 'Convert to long-term archival format.',
    cardCategory: 'optimize',
    comingSoon: true, // no homepageBucket → not on grid
    cardDesc: 'Make PDFs archive-ready (PDF/A standard).',
    icon: '🏛️',
    format: 'pdf',
    multiple: false,
    runLabel: 'Convert',
    run: stub('PDF to PDF/A'),
  });

  HopeWS.register('unlock', {
    title: 'Unlock PDF',
    subtitle: 'Remove password protection from a PDF.',
    cardCategory: 'security',
    cardDesc: 'Remove password protection from a PDF you own.',
    icon: '🔓',
    format: 'pdf',
    multiple: false,
    optionsHtml: `<div class="opt-row"><label>Password <input type="password" name="password"></label></div>`,
    runLabel: 'Unlock',
    run: stub('Unlock PDF'),
  });

  HopeWS.register('protect', {
    title: 'Protect PDF',
    subtitle: 'Add a password to keep a PDF private.',
    cardCategory: 'security',
    cardDesc: 'Encrypt your PDF with a strong password.',
    icon: '🔒',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>Password <input type="password" name="password"></label>
        <label>Confirm <input type="password" name="confirm"></label>
      </div>`,
    runLabel: 'Protect',
    run: stub('Protect PDF'),
  });

  HopeWS.register('sign', {
    title: 'Sign PDF',
    subtitle: 'Place your signature on a PDF.',
    cardCategory: 'security',
    cardDesc: 'Sign or stamp a PDF — typed, drawn, or uploaded.',
    icon: '✍️',
    format: 'pdf',
    multiple: false,
    runLabel: 'Save signed PDF',
    run: stub('Sign PDF'),
  });

  HopeWS.register('redact', {
    title: 'Redact PDF',
    subtitle: 'Permanently black out sensitive content.',
    cardCategory: 'security',
    cardDesc: 'Black out sensitive text/images so they can\'t be recovered.',
    icon: '🚫',
    format: 'pdf',
    multiple: false,
    runLabel: 'Save redacted',
    run: stub('Redact PDF'),
  });

  HopeWS.register('compare', {
    title: 'Compare PDFs',
    subtitle: 'See differences between two PDF files.',
    cardCategory: 'intelligence',
    cardDesc: 'Highlight differences between two versions of a PDF.',
    icon: '🔁',
    format: 'pdf',
    multiple: true,
    minFiles: 2,
    runLabel: 'Compare',
    run: stub('Compare PDFs'),
  });

  HopeWS.register('ai-summarize', {
    title: 'AI Summarize',
    subtitle: 'Generate a concise summary of a PDF.',
    cardCategory: 'intelligence',
    cardDesc: 'Get a clean summary of any PDF — locally, no upload.',
    icon: '✨',
    tag: 'AI',
    format: 'pdf',
    multiple: false,
    runLabel: 'Summarize',
    run: stub('AI Summarize'),
  });

  HopeWS.register('ai-translate', {
    title: 'AI Translate',
    subtitle: 'Translate a PDF into another language.',
    cardCategory: 'intelligence',
    cardDesc: 'Translate the text in a PDF to a chosen language.',
    icon: '🌐',
    tag: 'AI',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>
          Target language
          <select name="lang">
            <option value="en">English</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="ja">日本語 (Japanese)</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
          </select>
        </label>
      </div>`,
    runLabel: 'Translate',
    run: stub('AI Translate'),
  });

  HopeWS.register('bg-remove', {
    title: 'Background Remover',
    subtitle: 'Strip backgrounds from images you put into a PDF.',
    cardCategory: 'intelligence',
    cardDesc: 'Remove backgrounds from images and place them in a PDF.',
    icon: '🪄',
    tag: 'AI',
    format: 'image',
    multiple: true,
    runLabel: 'Process',
    run: stub('Background Remover'),
  });

  HopeWS.register('edit-pdf', {
    title: 'Edit PDF',
    subtitle: 'Add text, shapes, images, or annotations.',
    cardCategory: 'edit',
    cardDesc: 'Add text, highlights, shapes, and notes to your PDF.',
    icon: '🖋️',
    format: 'pdf',
    multiple: false,
    runLabel: 'Save changes',
    run: stub('Edit PDF'),
  });

  // ───────────────── 30. WORKFLOW: Compress & Watermark ─────────────────
  HopeWS.register('workflow-share', {
    title: 'Share-ready Workflow',
    subtitle: 'Compress + watermark in one step — quick share preset.',
    cardCategory: 'workflow',
    cardDesc: 'Compress + watermark in one step — perfect for sharing.',
    icon: '🎀',
    tag: 'Workflow',
    format: 'pdf',
    multiple: false,
    optionsHtml: `
      <div class="opt-row">
        <label>Watermark text <input type="text" name="text" value="DRAFT"></label>
      </div>`,
    runLabel: 'Run workflow',
    async run(files, opts, { downloadBlob, toast }) {
      const file = files[0];
      const src = await loadPdf(file);
      const font = await src.embedFont(StandardFonts.HelveticaBold);
      const text = String(opts.text || 'DRAFT');
      src.getPages().forEach(page => {
        const { width, height } = page.getSize();
        const size = Math.min(width, height) * 0.12;
        const tw = font.widthOfTextAtSize(text, size);
        page.drawText(text, {
          x: (width - tw) / 2, y: height / 2,
          size, font, color: rgb(0.85, 0.45, 0.6),
          opacity: 0.18, rotate: degrees(45),
        });
      });
      const bytes = await src.save({ useObjectStreams: true });
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), safeName(file.name, 'share-ready'));
      toast('success', 'Workflow done', 'Compressed + watermarked.');
    },
  });

  console.log('[H🌸PE PDF] Tools loaded.');
})();
