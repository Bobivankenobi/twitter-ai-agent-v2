import { CONFIG } from "./constants";
import { State } from "./types";

// --- tiny utils ---
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const waitFor = <T>(
  fn: () => T | null | undefined,
  timeout: number = 6000,
  every: number = 100
): Promise<T> =>
  new Promise((res, rej) => {
    const t0 = performance.now();
    (function poll() {
      try {
        const v = fn();
        if (v) return res(v);
        if (performance.now() - t0 >= timeout) return rej(new Error("waitFor timeout"));
        setTimeout(poll, every);
      } catch (e) {
        rej(e);
      }
    })();
  });

export const waitForDisappear = (
  el: HTMLElement,
  timeout: number = 8000,
  every: number = 120
): Promise<boolean> =>
  new Promise((res, rej) => {
    const t0 = performance.now();
    (function poll() {
      if (!document.body.contains(el)) return res(true);
      if (performance.now() - t0 >= timeout) return rej(new Error("waitForDisappear timeout"));
      setTimeout(poll, every);
    })();
  });

// Basic text normalization function
// Goal: make string comparisons more consistent by removing case differences,
// extra spaces, punctuation, and diacritics (accents)

// Example: "Girişmen !!! " → "girismen"
const norm = (s: string): string => {
  return (
    s
      .toLowerCase() // 1. Convert all letters to lowercase for case-insensitive comparison

      // 2. Normalize Unicode text to "NFKD" form:
      //    - Decomposes accented characters into base + diacritic mark
      //    Example: "ş" → "s" + "◌̧"
      .normalize("NFKD")

      // 3. Remove diacritic marks (accents) from characters
      //    - Unicode range \u0300–\u036f covers combining diacritical marks
      .replace(/[\u0300-\u036f]/g, "")

      // 4. Remove most punctuation and special symbols, keep only:
      //    - Letters (\p{L}), Numbers (\p{N}), and Spaces (\s)
      //    Everything else is replaced with a space
      .replace(/[^\p{L}\p{N}\s]/gu, " ")

      // 5. Replace multiple spaces/tabs/newlines with a single space
      .replace(/\s+/g, " ")

      // 6. Trim leading and trailing spaces
      .trim()
  );
};

// Convert a string into a set of tokens (words) for easier matching
// - Uses norm(s) to normalize text first (e.g., lowercase, trim, remove punctuation — depending on your norm function)
// - Splits text into words by spaces
// - Filters out very short words (less than 3 characters) to reduce noise (e.g., "a", "is", "to")
// - Wraps the result in a Set to keep only unique tokens
export const toTokenSet = (s: string): Set<string> => {
  return new Set(
    norm(s) // normalize text
      .split(" ") // split into tokens
      .filter((t) => t.length >= 3) // keep words with 3+ characters
  );
};

// Check if an element is visible in the viewport
// - Uses getBoundingClientRect() to get element’s size and position relative to viewport
// - Returns true if:
//   * element has a positive height and width (visible size)
//   * element is at least partially inside the viewport (top/left not completely outside, bottom/right not completely off-screen)
export const isVisible = (el: HTMLElement): boolean => {
  const r = el.getBoundingClientRect();
  return (
    r.height > 0 && // element has height
    r.width > 0 && // element has width
    r.bottom > 0 && // bottom is below top edge of viewport
    r.right > 0 && // right is right of left edge of viewport
    r.top < (window.innerHeight || document.documentElement.clientHeight) && // top is above bottom edge of viewport
    r.left < (window.innerWidth || document.documentElement.clientWidth) // left is left of right edge of viewport
  );
};

// Calculates the "overlap score" between two sets of tokens
// Formula: |A ∩ B| / |A|
// Meaning: fraction of tokens from `needles` that also exist in `haystack`

// Example:
//   needles = {"apple", "banana"}
//   haystack = {"apple", "orange"}
//   hits = 1 (only "apple" matches)
//   score = 1 / 2 = 0.5
export const overlapScore = (needles: Set<string>, haystack: Set<string>): number => {
  let hits = 0; // counter for matching tokens

  // Iterate over each token in the "needles" set
  for (const t of needles) {
    // If haystack contains the token, count it as a hit
    if (haystack.has(t)) hits++;
  }

  // Divide number of matches by size of "needles"
  // Use Math.max(1, needles.size) to avoid dividing by zero
  return hits / Math.max(1, needles.size);
};

export async function waitForDialogClose(timeoutMs = 10000): Promise<boolean> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return true;
    await sleep(120);
  }
  return false;
}

export function loadRepliedFromStorage(state: State): void {
  try {
    const raw = localStorage.getItem(CONFIG.persistKey);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) arr.forEach((id) => state.repliedIds.add(id));
  } catch {
    /* empty */
  }
}

export function saveRepliedToStorage(state: State): void {
  try {
    localStorage.setItem(CONFIG.persistKey, JSON.stringify([...state.repliedIds]));
  } catch {
    /* empty */
  }
}
