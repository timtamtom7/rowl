export function truncateTitle(text: string, maxLength = 50): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}...`;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "need",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "and",
  "but",
  "or",
  "nor",
  "not",
  "so",
  "yet",
  "both",
  "either",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "i",
  "me",
  "my",
  "we",
  "us",
  "our",
  "you",
  "your",
  "he",
  "she",
  "they",
  "them",
  "what",
  "which",
  "who",
  "whom",
  "how",
  "when",
  "where",
  "why",
  "just",
  "also",
  "very",
  "really",
  "please",
  "hi",
  "hey",
  "hello",
  "thanks",
  "thank",
  "ok",
  "okay",
  "sure",
  "yeah",
  "yes",
  "no",
  "like",
  "want",
  "make",
  "get",
  "let",
  "put",
  "go",
  "come",
]);

/**
 * Derive a smarter thread title from the first few user messages.
 * Extracts the most meaningful/specific words to create a concise title.
 */
export function deriveSmartThreadTitle(messages: string[]): string | null {
  const combined = messages.join(" ").toLowerCase();
  const words = combined
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (words.length === 0) return null;

  // Count word frequency — more frequent = more relevant to the conversation
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  // Sort by frequency (descending), then by first appearance
  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([word]) => word);

  // Take top 4-6 meaningful words, capitalize first
  const titleWords = ranked.slice(0, 5);
  if (titleWords.length === 0) return null;

  const title = titleWords
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");

  return truncateTitle(title, 50);
}
