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
  mode: "all",
  topN: 200,
  topPercent: 10,
};

export function normalizeCorpus(text: string, options: CorpusOptions): string {
  let result = text;

  if (options.lowercase) {
    result = result.toLowerCase();
  }

  // Compose decomposed letters + accents (e.g. e + combining acute -> é).
  result = result.normalize("NFC");

  // Zero-width and other invisible format characters are not punctuation.
  result = result.replace(/\p{Cf}/gu, "");

  if (options.stripPunctuation) {
    // Join contractions and hyphenations before stripping word-boundary punctuation.
    result = result.replace(/(?<=\p{L})[''\u2019\u02BC-](?=\p{L})/gu, "");
    result = result.replace(/[\p{P}\p{S}]/gu, " ");
  }

  if (options.removeNumbers) {
    result = result.replace(/\p{N}+/gu, " ");
  }

  return result;
}

export function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function countWords(tokens: string[], minLength: number): WordCount[] {
  const counts = new Map<string, number>();

  for (const token of tokens) {
    if (token.length < minLength) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
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
  const tokens = tokenize(normalized);
  const ranked = countWords(tokens, options.minLength);
  const filtered = applyFilter(ranked, filter, tokens.length);

  return {
    ranked,
    filtered,
    stats: {
      tokenCount: tokens.length,
      uniqueCount: ranked.length,
      filteredCount: filtered.length,
    },
  };
}

export function wordsToListText(words: WordCount[]): string {
  return words.map((entry) => entry.word).join(" ");
}
