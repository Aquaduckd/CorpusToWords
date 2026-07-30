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

const corpusInputEl = queryRequired<HTMLTextAreaElement>("#corpus-input");
const corpusFileEl = queryRequired<HTMLInputElement>("#corpus-file");
const wordlistOutputEl = queryRequired<HTMLTextAreaElement>("#wordlist-output");
const copyWordlistBtn = queryRequired<HTMLButtonElement>("#copy-wordlist");
const downloadWordlistBtn = queryRequired<HTMLButtonElement>("#download-wordlist");
const corpusStatsEl = queryRequired<HTMLElement>("#corpus-stats");
const wordsTableBodyEl = queryRequired<HTMLElement>("#words-table-body");
const wordsTableEmptyEl = queryRequired<HTMLElement>("#words-table-empty");

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

function renderWordsTable(words: ReturnType<typeof processCorpus>["filtered"]): void {
  wordsTableBodyEl.replaceChildren();

  if (words.length === 0) {
    wordsTableEmptyEl.classList.remove("hidden");
    return;
  }

  wordsTableEmptyEl.classList.add("hidden");

  for (const [index, entry] of words.entries()) {
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
}

function refresh(): void {
  const result = processCorpus(corpusInputEl.value, readOptions(), readFilter());
  const listText = wordsToListText(result.filtered);

  wordlistOutputEl.value = listText;
  corpusStatsEl.textContent = `${result.stats.tokenCount.toLocaleString()} tokens · ${result.stats.uniqueCount.toLocaleString()} unique · ${result.stats.filteredCount.toLocaleString()} shown`;
  renderWordsTable(result.filtered);
}

function formatDownloadTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function downloadWordlist(): void {
  const text = wordlistOutputEl.value.trim();
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
  const text = wordlistOutputEl.value.trim();
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

corpusFileEl.addEventListener("change", async () => {
  const file = corpusFileEl.files?.[0];
  if (!file) return;

  corpusInputEl.value = await file.text();
  corpusFileEl.value = "";
});

applyBtn.addEventListener("click", refresh);

copyWordlistBtn.addEventListener("click", () => {
  void copyWordlist();
});

downloadWordlistBtn.addEventListener("click", downloadWordlist);

renderWordsTable([]);
wordsTableEmptyEl.classList.remove("hidden");
corpusStatsEl.textContent = "Not applied yet";
