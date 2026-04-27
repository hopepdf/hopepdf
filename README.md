# H🌸PE PDF — Premium Local PDF Toolkit

A self-contained, dark-elegant PDF workspace inspired by iLovePDF — but everything runs **inside your browser**. No backend, no signup, no uploads.

希望 — *kibou* — **hope**.

---

## ✨ Highlights

- **30+ tools** across Organize, Optimize, Convert, Edit, Security & Intelligence
- **Sticky header** with iLovePDF-style mega menu (MERGE / SPLIT / COMPRESS / CONVERT ▾ / ALL PDF TOOLS)
- **Filter pills** (All · Workflows · Organize · Optimize · Convert · Edit · Security · Intelligence)
- **Strict file validation** per tool — wrong files get a red border + a friendly toast
- **Drag-and-drop reorder**, page count, total size, PDF thumbnails
- **Undo / Redo** (Ctrl+Z / Ctrl+Y) and **Delete / ↑ / ↓** keyboard support
- **Recent files** (localStorage), preview modal, retry, progress bars
- **Dark + Light** theme with soft pink + gold gradients (glassmorphism cards)
- **Sakura petals** background with **wind** that pushes them sideways when ambient sound is on
- **Butterflies** lifecycle (egg → caterpillar → pupa → butterfly → fade), rarity (white 1/4, pink 1/10, blue 1/50, red 1/100, **rainbow 1/1000**)
- Click a butterfly → it dies and a **multilingual quote** appears (Tamil 1-in-5, Japanese, Chinese, French, English, Latin, Spanish, Italian, Korean, Arabic — **never Hindi**)
- **First-visit consent modal** — must check the box & click *I Understand & Continue*
- **Floating chatbot** (bottom right) with intent recognition for tools, quick suggestions, typing animation, and a 5-second greeting bubble
- **Premium-style footer** (Product / Resources / Solutions / Legal / Company)

Everything happens in your browser. Nothing is uploaded.

---

## 🚀 Run it (local)

You only need a static file server because the PDF libraries load via CDN. Pick whichever command you have on your machine.

```bash
# 1. Go into the project folder
cd hope-pdf

# 2a. Python 3
python3 -m http.server 8000

# 2b. Node.js (no install — uses npx)
npx --yes http-server -p 8000 -c-1

# 2c. PHP
php -S localhost:8000
```

Then open <http://localhost:8000> in any modern browser.

> **Tip:** Opening `index.html` directly via `file://` mostly works, but a few features (PDF.js worker, font loading, drag/drop) behave best from `http://localhost`.

---

## 📁 Files

```
hope-pdf/
├── index.html      # Layout, mega menu, modals, hero, footer
├── style.css       # Dark/light theme, glassmorphism, butterflies, animations
├── quotes.js       # Multilingual quotes pool + pickQuote()
├── script.js       # Petals, wind, theme, workspace, butterflies, chatbot, consent
├── tools.js        # All 30+ tool registrations
└── README.md       # This file
```

No build step. No `node_modules`. Just files.

---

## ⌨️ Keyboard Shortcuts (inside a tool)

| Key | Action |
| --- | --- |
| `Esc` | Close the workspace |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `↑` / `↓` (when a file is focused) | Move file up/down |
| `Delete` / `Backspace` | Remove the focused file |

---

## 🪶 Tools Implemented (live, working)

- **Merge PDF** — combine multiple PDFs in any order (drag to reorder)
- **Split PDF** — custom ranges or one PDF per page
- **Compress PDF** — re-saves with object streams (light–high)
- **Rotate PDF** — 90° / 180° / 270°, all pages or selected ranges
- **Watermark PDF** — diagonal/top/bottom, opacity & text
- **PDF → Word** — text extraction into `.docx` (via `docx`)
- **Word → PDF** — `.doc/.docx` → PDF (via `mammoth` + `jsPDF`)
- **JPG → PDF / Image → PDF** — combine JPG/PNG into a single PDF
- **PDF → JPG** — high-quality page rasters (configurable scale)
- **Page Numbers** — bottom center / bottom right / top right
- **Remove Pages** — delete selected page numbers
- **Extract Pages** — keep only the pages you list
- **Crop PDF** — trim margins (top/right/bottom/left in points)
- **Workflow: Share-ready** — compress + watermark in one click

## 🌱 UI-only stubs (wired to workspace, "coming soon")

Organize · Scan to PDF · Repair · OCR · PowerPoint↔PDF · Excel↔PDF · HTML→PDF · PDF→PDF/A · Unlock · Protect · Sign · Redact · Compare · AI Summarize · AI Translate · Background Remover · Edit PDF.

These **validate input strictly** and open the workspace, but show a friendly *coming soon* toast on Run. They're intentionally there so you can flesh them out incrementally without touching the rest of the app.

---

## 🦋 Butterflies & Lifecycle

The lifecycle layer slowly cycles through a ~3-minute loop:

```
egg (bottom-left)  →  caterpillar (climbs left edge)  →  pupa (top)
              →  butterfly emerges from pupa  →  oldest butterfly fades away
```

There are usually 4–5 butterflies on screen. Click one and it dies (puff animation), and a quote popup appears.

Rarity (per spawn):

| Rarity | Probability |
| --- | --- |
| Rainbow ✨ | 1 / 1000 |
| Red 🔴 | 1 / 100 |
| Blue 🔵 | 1 / 50 |
| Pink 🌸 | 1 / 10 |
| White 🤍 | 1 / 4 |
| Normal (theme color) | the rest |

---

## 🌬️ Wind & Sound

Toggle the wind sound on (via the sound button — pink-noise through a low-pass filter) and the petals will start drifting horizontally with gusts. Turn it off and they fall straight down again.

---

## 🌐 Quote Languages

Tamil is biased to roughly **1 in every 5** clicks. The remaining 4-out-of-5 are picked uniformly from: Japanese, Chinese, French, English, Latin, Spanish, Italian, Korean, Arabic. **Hindi is not included by design.**

---

## 🛡️ Privacy

H🌸PE PDF is a 100% browser-side toolkit. Files never leave your machine. The only things stored locally are:

- `hope-theme` — your light/dark preference
- `hope-recent` — recent file names (no contents)
- `hope-consent` — that you accepted the first-visit notice

You can clear all of that from your browser's site data at any time.

---

## 🧰 Built with

- [`pdf-lib`](https://pdf-lib.js.org/) — merge, split, watermark, rotate, page numbers, crop
- [`pdfjs-dist`](https://mozilla.github.io/pdf.js/) — text extraction & rendering for previews
- [`jspdf`](https://github.com/parallax/jsPDF) — Word→PDF text typesetting
- [`mammoth.js`](https://github.com/mwilliamson/mammoth.js) — `.docx` → text
- [`docx`](https://github.com/dolanmiu/docx) — generating `.docx` output
- [`FileSaver.js`](https://github.com/eligrey/FileSaver.js) — reliable downloads

All loaded over CDN — no install required.

---

Made with care, petals, and a butterfly or two. 🌸
# hope-pdf
