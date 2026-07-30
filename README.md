# CorpusToWords

Turn arbitrary text into a typing-test word list. Paste or load a corpus, normalize it, filter by frequency, and copy or download the result.

## Features

- **Paste or load** — drop in text or open a `.txt` file (large files stay in memory, not in the editor)
- **Normalize** — lowercase, strip punctuation, remove numbers, minimum word length
- **Filter** (default: top 200 words)
  - All unique words
  - Top **N** most frequent words
  - Top **N%** by rank (most frequent unique words)
  - Top **N%** by coverage (smallest set of words that account for N% of tokens)
- **Preview** — ranked table with counts, up to 1,000 rows (click **Apply** to process)
- **Export** — space-separated word list, copy or download (full list even when preview is truncated)

## Run locally

```bash
cd CorpusToWords
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Stack

TypeScript, Vite, Tailwind CSS v4 — same as Typing Test.
