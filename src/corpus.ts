export type CorpusOptions = {
  lowercase: boolean;
  stripPunctuation: boolean;
  removeNumbers: boolean;
  minLength: number;
};

export type WordCount = {
  word: string;
  count: number;
};

export type FilterMode = "all" | "top-n" | "top-percent-rank" | "top-percent-coverage";

export type CorpusFilter = {
  mode: FilterMode;
  topN: number;
  topPercent: number;
};

export type CorpusStats = {
  tokenCount: number;
  uniqueCount: number;
  filteredCount: number;
};

export const DEFAULT_CORPUS_OPTIONS: CorpusOptions = {
  lowercase: true,
  stripPunctuation: true,
  removeNumbers: false,
  minLength: 1,
};

export const DEFAULT_CORPUS_FILTER: CorpusFilter = {
  mode: "top-n",
  topN: 200,
  topPercent: 10,
};

function isWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\r" || char === "\t" || char === "\f" || char === "\v";
}

export function normalizeCorpus(text: string, options: CorpusOptions): string {
  let result = text;

  if (options.lowercase) {
    result = result.toLowerCase();
  }

  result = result.normalize("NFC");
  result = result.replace(/\p{Cf}/gu, "");

  if (options.stripPunctuation) {
    result = result.replace(/(?<=\p{L})[''\u2019\u02BC-](?=\p{L})/gu, "");
    result = result.replace(/[\p{P}\p{S}]/gu, " ");
  }

  if (options.removeNumbers) {
    result = result.replace(/\p{N}+/gu, " ");
  }

  return result;
}

/** Single-pass token count + frequency map (avoids materializing all tokens). */
export function countWordsFromText(
  text: string,
  minLength: number,
): { ranked: WordCount[]; tokenCount: number } {
  const counts = new Map<string, number>();
  let tokenCount = 0;

  const len = text.length;
  let index = 0;

  while (index < len) {
    while (index < len && isWhitespace(text[index]!)) {
      index += 1;
    }

    if (index >= len) break;

    const start = index;
    while (index < len && !isWhitespace(text[index]!)) {
      index += 1;
    }

    tokenCount += 1;
    const token = text.slice(start, index);
    if (token.length >= minLength) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  const ranked = [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));

  return { ranked, tokenCount };
}

export function applyFilter(
  ranked: WordCount[],
  filter: CorpusFilter,
  totalTokens: number,
): WordCount[] {
  switch (filter.mode) {
    case "all":
      return ranked;
    case "top-n":
      return ranked.slice(0, Math.max(0, Math.floor(filter.topN)));
    case "top-percent-rank": {
      const limit = Math.ceil(ranked.length * (filter.topPercent / 100));
      return ranked.slice(0, Math.max(0, limit));
    }
    case "top-percent-coverage": {
      if (totalTokens === 0) return [];

      const target = totalTokens * (filter.topPercent / 100);
      let covered = 0;
      const selected: WordCount[] = [];

      for (const entry of ranked) {
        selected.push(entry);
        covered += entry.count;
        if (covered >= target) break;
      }

      return selected;
    }
  }
}

export function processCorpus(
  text: string,
  options: CorpusOptions,
  filter: CorpusFilter,
): {
  ranked: WordCount[];
  filtered: WordCount[];
  stats: CorpusStats;
} {
  const normalized = normalizeCorpus(text, options);
  const { ranked, tokenCount } = countWordsFromText(normalized, options.minLength);
  const filtered = applyFilter(ranked, filter, tokenCount);

  return {
    ranked,
    filtered,
    stats: {
      tokenCount,
      uniqueCount: ranked.length,
      filteredCount: filtered.length,
    },
  };
}

export function wordsToListText(words: WordCount[]): string {
  return words.map((entry) => entry.word).join(" ");
}
