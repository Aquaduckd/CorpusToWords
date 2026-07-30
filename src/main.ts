import "./style.css";

import {
  DEFAULT_CORPUS_FILTER,
  type CorpusFilter,
  type CorpusOptions,
  type FilterMode,
  processCorpus,
  wordsToListText,
} from "./corpus";
import { queryRequired } from "./dom";
import { formatBytes } from "./format";

const INLINE_CORPUS_LIMIT = 512_000;
const MAX_TABLE_ROWS = 1_000;
const OUTPUT_PREVIEW_LIMIT = 100_000;

const corpusInputEl = queryRequired<HTMLTextAreaElement>("#corpus-input");
const corpusStatusEl = queryRequired<HTMLElement>("#corpus-status");
const corpusFileEl = queryRequired<HTMLInputElement>("#corpus-file");
const wordlistOutputEl = queryRequired<HTMLTextAreaElement>("#wordlist-output");
const copyWordlistBtn = queryRequired<HTMLButtonElement>("#copy-wordlist");
const downloadWordlistBtn = queryRequired<HTMLButtonElement>("#download-wordlist");
const corpusStatsEl = queryRequired<HTMLElement>("#corpus-stats");
const wordsTableBodyEl = queryRequired<HTMLElement>("#words-table-body");
const wordsTableEmptyEl = queryRequired<HTMLElement>("#words-table-empty");
const wordsTableNoteEl = queryRequired<HTMLElement>("#words-table-note");

const optLowercaseEl = queryRequired<HTMLInputElement>("#opt-lowercase");
const optStripPunctuationEl = queryRequired<HTMLInputElement>("#opt-strip-punctuation");
const optRemoveNumbersEl = queryRequired<HTMLInputElement>("#opt-remove-numbers");
const optMinLengthEl = queryRequired<HTMLInputElement>("#opt-min-length");

const filterModeEls = [
  queryRequired<HTMLInputElement>("#filter-all"),
  queryRequired<HTMLInputElement>("#filter-top-n"),
  queryRequired<HTMLInputElement>("#filter-top-percent-rank"),
  queryRequired<HTMLInputElement>("#filter-top-percent-coverage"),
];
const filterTopNValueEl = queryRequired<HTMLInputElement>("#filter-top-n-value");
const filterTopPercentRankValueEl = queryRequired<HTMLInputElement>(
  "#filter-top-percent-rank-value",
);
const filterTopPercentCoverageValueEl = queryRequired<HTMLInputElement>(
  "#filter-top-percent-coverage-value",
);
const applyBtn = queryRequired<HTMLButtonElement>("#apply-options");

const COPY_LABEL = "Copy";
const COPIED_LABEL = "Copied!";
let copyResetTimeout: number | null = null;

let corpusText = "";
let corpusSourceLabel = "";
let lastWordlistText = "";
let isExternalCorpus = false;

function readOptions(): CorpusOptions {
  return {
    lowercase: optLowercaseEl.checked,
    stripPunctuation: optStripPunctuationEl.checked,
    removeNumbers: optRemoveNumbersEl.checked,
    minLength: Math.max(1, Number.parseInt(optMinLengthEl.value, 10) || 1),
  };
}

function readFilter(): CorpusFilter {
  const selected = filterModeEls.find((input) => input.checked);
  const mode = (selected?.value ?? DEFAULT_CORPUS_FILTER.mode) as FilterMode;

  return {
    mode,
    topN: Math.max(1, Number.parseInt(filterTopNValueEl.value, 10) || DEFAULT_CORPUS_FILTER.topN),
    topPercent:
      mode === "top-percent-coverage"
        ? Math.min(
            100,
            Math.max(
              1,
              Number.parseInt(filterTopPercentCoverageValueEl.value, 10) ||
                DEFAULT_CORPUS_FILTER.topPercent,
            ),
          )
        : Math.min(
            100,
            Math.max(
              1,
              Number.parseInt(filterTopPercentRankValueEl.value, 10) ||
                DEFAULT_CORPUS_FILTER.topPercent,
            ),
          ),
  };
}

function updateCorpusUi(): void {
  if (corpusText.length === 0) {
    isExternalCorpus = false;
    corpusInputEl.readOnly = false;
    corpusInputEl.value = "";
    corpusInputEl.placeholder = "Paste text here, or use Load file for large corpora…";
    corpusStatusEl.classList.add("hidden");
    corpusStatusEl.textContent = "";
    return;
  }

  if (corpusText.length <= INLINE_CORPUS_LIMIT && !isExternalCorpus) {
    corpusInputEl.readOnly = false;
    corpusInputEl.value = corpusText;
    corpusStatusEl.classList.add("hidden");
    return;
  }

  isExternalCorpus = true;
  corpusInputEl.readOnly = true;
  corpusInputEl.value = "";
  corpusInputEl.placeholder =
    "Large corpus kept in memory (not shown here). Load another file or clear the status line to paste.";
  corpusStatusEl.classList.remove("hidden");
  corpusStatusEl.textContent = `${corpusSourceLabel || "Corpus"} · ${formatBytes(corpusText.length)} · ${corpusText.length.toLocaleString()} characters — cleared if you paste below`;
}

function setCorpus(text: string, sourceLabel: string, external = false): void {
  corpusText = text;
  corpusSourceLabel = sourceLabel;
  isExternalCorpus = external || text.length > INLINE_CORPUS_LIMIT;
  updateCorpusUi();
}

function renderWordsTable(words: ReturnType<typeof processCorpus>["filtered"]): void {
  wordsTableBodyEl.replaceChildren();

  if (words.length === 0) {
    wordsTableEmptyEl.classList.remove("hidden");
    wordsTableNoteEl.classList.add("hidden");
    return;
  }

  wordsTableEmptyEl.classList.add("hidden");

  const visible = words.slice(0, MAX_TABLE_ROWS);
  for (const [index, entry] of visible.entries()) {
    const row = document.createElement("tr");
    row.className = "border-t border-zinc-800/60";

    const rankCell = document.createElement("td");
    rankCell.className = "px-3 py-2 text-zinc-500";
    rankCell.textContent = String(index + 1);

    const wordCell = document.createElement("td");
    wordCell.className = "px-3 py-2 font-medium text-zinc-100";
    wordCell.textContent = entry.word;

    const countCell = document.createElement("td");
    countCell.className = "px-3 py-2 text-zinc-400";
    countCell.textContent = String(entry.count);

    row.append(rankCell, wordCell, countCell);
    wordsTableBodyEl.append(row);
  }

  if (words.length > MAX_TABLE_ROWS) {
    wordsTableNoteEl.textContent = `Showing first ${MAX_TABLE_ROWS.toLocaleString()} of ${words.length.toLocaleString()} filtered words. Copy or Download includes the full list.`;
    wordsTableNoteEl.classList.remove("hidden");
  } else {
    wordsTableNoteEl.classList.add("hidden");
  }
}

function setWordlistOutput(fullText: string): void {
  lastWordlistText = fullText;

  if (fullText.length <= OUTPUT_PREVIEW_LIMIT) {
    wordlistOutputEl.value = fullText;
    return;
  }

  wordlistOutputEl.value = `${fullText.slice(0, OUTPUT_PREVIEW_LIMIT)}\n\n… truncated preview (${fullText.length.toLocaleString()} characters total — use Copy or Download for the full list)`;
}

async function refresh(): Promise<void> {
  if (!corpusText.trim()) {
    corpusStatsEl.textContent = "No corpus loaded";
    lastWordlistText = "";
    wordlistOutputEl.value = "";
    renderWordsTable([]);
    wordsTableEmptyEl.classList.remove("hidden");
    return;
  }

  applyBtn.disabled = true;
  applyBtn.textContent = "Applying…";

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });

  try {
    const result = processCorpus(corpusText, readOptions(), readFilter());
    setWordlistOutput(wordsToListText(result.filtered));
    corpusStatsEl.textContent = `${result.stats.tokenCount.toLocaleString()} tokens · ${result.stats.uniqueCount.toLocaleString()} unique · ${result.stats.filteredCount.toLocaleString()} in list`;
    renderWordsTable(result.filtered);
  } finally {
    applyBtn.disabled = false;
    applyBtn.textContent = "Apply";
  }
}

function formatDownloadTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function downloadWordlist(): void {
  const text = lastWordlistText.trim();
  if (!text) return;

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `corpus-wordlist-${formatDownloadTimestamp(new Date())}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyWordlist(): Promise<void> {
  const text = lastWordlistText.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return;
  }

  if (copyResetTimeout !== null) {
    window.clearTimeout(copyResetTimeout);
  }

  copyWordlistBtn.textContent = COPIED_LABEL;
  copyWordlistBtn.disabled = true;

  copyResetTimeout = window.setTimeout(() => {
    copyResetTimeout = null;
    copyWordlistBtn.textContent = COPY_LABEL;
    copyWordlistBtn.disabled = false;
  }, 1500);
}

corpusInputEl.addEventListener("input", () => {
  if (corpusInputEl.readOnly) return;
  setCorpus(corpusInputEl.value, "", false);
});

corpusInputEl.addEventListener("paste", (event) => {
  const pasted = event.clipboardData?.getData("text/plain") ?? "";
  if (pasted.length <= INLINE_CORPUS_LIMIT) return;

  event.preventDefault();
  setCorpus(pasted, "Pasted text", true);
});

corpusInputEl.addEventListener("keydown", (event) => {
  if (!corpusInputEl.readOnly) return;
  if (event.key !== "Backspace" && event.key !== "Delete") return;

  event.preventDefault();
  setCorpus("", "", false);
});

corpusStatusEl.addEventListener("click", () => {
  if (!corpusText) return;
  setCorpus("", "", false);
  corpusInputEl.readOnly = false;
  corpusInputEl.focus();
});

corpusFileEl.addEventListener("change", async () => {
  const file = corpusFileEl.files?.[0];
  if (!file) return;

  setCorpus(await file.text(), file.name, true);
  corpusFileEl.value = "";
});

applyBtn.addEventListener("click", () => {
  void refresh();
});

copyWordlistBtn.addEventListener("click", () => {
  void copyWordlist();
});

downloadWordlistBtn.addEventListener("click", downloadWordlist);

renderWordsTable([]);
wordsTableEmptyEl.classList.remove("hidden");
corpusStatsEl.textContent = "Not applied yet";
