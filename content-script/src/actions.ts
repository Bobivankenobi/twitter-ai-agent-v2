// Assuming './utils' exports these functions
import { CONFIG } from "./constants";
import { getTweetActionButtons } from "./getters";
import { isVisible, overlapScore, sleep, toTokenSet, waitFor, waitForDialogClose } from "./utils";

// Defines a function named captureAndAnalyzeOnce
// its job is to request a screenshot capture from the background script,
// send it to your backend for AI analysis, and return the response.
export const captureAndAnalyzeOnce = (): Promise<{
  ok: boolean;
  error?: string;
  raw?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  backend?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}> => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "captureAndAnalyzeRaw",
      },
      (resp) => {
        // Be resilient to undefined/extension errors
        if (!resp) {
          console.error("❌ No response from background");
          resolve({
            ok: false,
            error: "no-response",
          });
          return;
        }
        if (!resp.ok) {
          console.error("❌ Backend/Background error:", resp.error || resp.raw);
        } else {
          console.log("✅ Backend result:", resp.backend);
        }
        resolve(resp);
      }
    );
  });
};

/**
 * Programmatically types text into Twitter/X's DraftJS reply editor.
 * DraftJS doesn't always react to setting .innerText/.value directly,
 * so we simulate what a user would do + fire events it listens for.
 *
 * @param editorEl - the contenteditable element inside the reply dialog
 * @param text - the text to insert
 */
const typeIntoDraftEditor = (editorEl: HTMLElement, text: string): void => {
  editorEl.focus();

  // Ask the browser to select all existing content in the editor.
  // DraftJS tracks selection state and responds to execCommand operations.
  document.execCommand("selectAll", false, undefined);
  // Insert our text at the current selection (replacing the selection).
  // This mirrors a user typing/pasting, which DraftJS understands.
  document.execCommand("insertText", false, text);

  // --- Nudge React/DraftJS state updates ("belt and suspenders") ---

  // Many DraftJS/React setups rely on input/change/keyboard events
  // to commit internal editor state. We dispatch them to be safe.

  // Fire an InputEvent so React/DraftJS updates its model.
  editorEl.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
    })
  );
  // Some UIs listen for a generic 'change' to enable buttons etc.

  editorEl.dispatchEvent(
    new Event("change", {
      bubbles: true,
    })
  );

  // Key events can trigger additional validations/UI updates in some builds.
  editorEl.dispatchEvent(
    new KeyboardEvent("keyup", {
      bubbles: true,
    })
  );
};

/**
 * Paste comment into the reply modal and press the enabled "Reply" button.
 * @param dialog  The <div role="dialog"> reply modal
 * @param commentText  Text to paste
 */
export const pasteAndSubmitReply = async (
  dialog: HTMLElement,
  commentText: string
): Promise<void> => {
  // 1) Get the DraftJS editor inside THIS dialog
  const editor = await waitFor(
    () =>
      dialog.querySelector(
        '[data-testid="tweetTextarea_0"][contenteditable="true"]'
      ) as HTMLElement | null
  );

  if (!editor) {
    throw new Error("Editor element not found");
  }

  // 2) Type the comment
  const text = (commentText || "").trim();
  if (!text) {
    throw new Error("Empty commentText");
  }
  typeIntoDraftEditor(editor, text);
  let replyBtn: HTMLElement | null = null;
  setTimeout(() => {
    replyBtn = dialog.querySelector('[data-testid="tweetButton"]') as HTMLElement | null;
    if (replyBtn) {
      replyBtn.click();
    }
  }, 2000);

  // 4) Wait for modal to close (submission finished)
  // await waitForDisappear(dialog, 1000);

  // small settle delay
  await sleep(1000);
};

interface FindTweetOptions {
  minScore?: number;
  onlyViewport?: boolean;
}

interface FoundTweet {
  article: HTMLElement;
  score: number;
}

/**
 * Find the tweet <article> whose text best matches the given snippet.
 * @param snippet - partial text from the tweet you’re looking for
 * @param opts
 * - minScore: minimal overlap (0..1) required to accept (default 0.5)
 * - onlyViewport: restrict search to visible tweets (default true)
 * @returns { {article: HTMLElement, score: number} | null }
 */
export const findTweetByText = (
  snippet: string,
  { minScore = 0.5, onlyViewport = true }: FindTweetOptions = {}
): FoundTweet | null => {
  const needles = toTokenSet(snippet);
  if (!needles.size) return null;

  const articles = Array.from(document.querySelectorAll('article[role="article"]'));
  let best: FoundTweet | null = null;

  for (const art of articles) {
    if (onlyViewport && !isVisible(art as HTMLElement)) continue;

    // Tweet text is scattered across many spans; innerText gets the full visible text
    const text = (art as HTMLElement).innerText || art.textContent || "";
    const hay = toTokenSet(text);
    const score = overlapScore(needles, hay);

    if (score >= minScore && (!best || score > best.score)) {
      best = {
        article: art as HTMLElement,
        score,
      };
    }
  }
  return best;
};

export async function engageTweet(article: HTMLElement, commentText: string): Promise<boolean> {
  try {
    const { replyBtn, likeBtn } = getTweetActionButtons(article);

    if (likeBtn && !likeBtn.matches('[data-testid="unlike"]')) {
      (likeBtn as HTMLButtonElement).click();
      await sleep(200);
    }
    if (!replyBtn) return false;

    (replyBtn as HTMLButtonElement).click();

    const dialog = await waitFor<HTMLElement | null>(
      () => document.querySelector("div[role='dialog']") as HTMLElement | null
    );
    if (!dialog) return false;

    await pasteAndSubmitReply(dialog, commentText);

    const closed = await waitForDialogClose(10000);
    if (!closed) return false;

    await sleep(CONFIG.postCloseWaitMs);
    return true;
  } catch (e) {
    console.error("❌ engageTweet failed:", e);
    return false;
  }
}
