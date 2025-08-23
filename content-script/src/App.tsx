import React, { useEffect, useState } from "react";
import Logo from "./Logo";
import { isVisible, sleep, waitFor } from "./utils";
import {
  captureAndAnalyzeOnce,
  findTweetByText,
  pasteAndSubmitReply,
} from "./actions";
import { getTweetActionButtons } from "./getters";
import { CONFIG, OFFSET_TOP_PX, SELECTOR } from "./constants";
import { candidatesSorted, circleCurrentArticle, gotoNext, jumpToArticle, scrollToAlignTop, waitUntilAligned } from "./helpers/manualNavigationHelpers";
import CommentChat from "./components/CommentChat";
import { Spinner } from "./components/Spinner";

// If you don't have chrome types installed, this prevents TS errors
declare const chrome: any;


export interface State {
  stopped: boolean;
  running: boolean;
  repliedIds: Set<string>;
  skippedIds: Set<string>;
  attemptsById: Map<string, number>;
  anySuccessThisRun: boolean;
  observer: MutationObserver | null;
  currentArticle: HTMLElement | null;
  semiAuto: boolean; // NEW: require approve before submitting
}


interface FindTweetHit {
  article: HTMLElement;
  score: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface State {
  stopped: boolean;
  running: boolean;
  repliedIds: Set<string>;
  skippedIds: Set<string>;
  attemptsById: Map<string, number>;
  anySuccessThisRun: boolean;
  observer: MutationObserver | null;
  currentArticle: HTMLElement | null;
}


const state: State = {
  stopped: false,
  running: false,
  repliedIds: new Set(),
  skippedIds: new Set(),
  attemptsById: new Map(),
  anySuccessThisRun: false,
  observer: null,
  currentArticle: null,
  semiAuto: true, // default ON; toggle with a button if you want
};


// ======================
// Helpers (from content.js)
// ======================

async function submitReply(dialog: HTMLElement): Promise<boolean> {
  const submitBtn =
    dialog.querySelector('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]') as HTMLButtonElement | null;
  if (!submitBtn) return false;
  submitBtn.click();
  return true;
}

type ApprovalResult = "approve" | "skip" | "stop";

function makeApprovalOverlay(dialog: HTMLElement, initial: string): {
  el: HTMLDivElement;
  wait: () => Promise<ApprovalResult>;
  destroy: () => void;
} {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "fixed",
    right: "20px",
    top: "100px",
    zIndex: "999999",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px",
    background: "rgba(17,24,39,0.95)",
    color: "#fff",
    borderRadius: "10px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
    width: "260px",
  } as CSSStyleDeclaration);

  wrap.innerHTML = `
    <div style="font-weight:600; font-size:14px;">comment coach — approval</div>
    <div style="font-size:12px; opacity:.9;">Review/edit the reply in the textbox. Approve to post.</div>
    <div style="display:flex; gap:8px; margin-top:6px;">
      <button id="cca-approve" style="flex:1; background:#10b981; color:#fff; border:none; padding:8px 10px; border-radius:8px; cursor:pointer;">approve (ctrl/⌘+enter)</button>
      <button id="cca-skip" style="flex:1; background:#64748b; color:#fff; border:none; padding:8px 10px; border-radius:8px; cursor:pointer;">skip (esc)</button>
    </div>
    <button id="cca-stop" style="background:#ef4444; color:#fff; border:none; padding:8px 10px; border-radius:8px; cursor:pointer;">stop run</button>
  `;

  document.body.appendChild(wrap);

  // prefill (done by pasteReplyOnly upstream), keep here for safety if needed
  const editable =
    (dialog.querySelector('[data-testid="tweetTextarea_0"] div[contenteditable="true"]') as HTMLElement | null) ||
    (dialog.querySelector('div[role="textbox"][contenteditable="true"]') as HTMLElement | null);
  if (editable && !editable.innerText?.trim()) {
    try {
      document.execCommand("insertText", false, initial || "");
    } catch {
      editable.textContent = initial || "";
      editable.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  }
  editable?.focus();

  let resolver: (v: ApprovalResult) => void;
  const p = new Promise<ApprovalResult>((res) => (resolver = res));

  const onApprove = () => resolver!("approve");
  const onSkip = () => resolver!("skip");
  const onStop = () => resolver!("stop");

  wrap.querySelector<HTMLButtonElement>("#cca-approve")?.addEventListener("click", onApprove);
  wrap.querySelector<HTMLButtonElement>("#cca-skip")?.addEventListener("click", onSkip);
  wrap.querySelector<HTMLButtonElement>("#cca-stop")?.addEventListener("click", onStop);

  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") onSkip();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") onApprove();
  };
  window.addEventListener("keydown", keyHandler, true);

  const destroy = () => {
    window.removeEventListener("keydown", keyHandler, true);
    wrap.remove();
  };

  return { el: wrap, wait: () => p, destroy };
}


async function engageTweetSemiAuto(article: HTMLElement, commentText: string): Promise<"posted" | "skipped" | "failed" | "stopped"> {
  try {
    const { replyBtn, likeBtn } = getTweetActionButtons(article);

    // gentle like (optional)
    if (likeBtn && !likeBtn.matches('[data-testid="unlike"]')) {
      (likeBtn as HTMLButtonElement).click();
      await sleep(150);
    }
    if (!replyBtn) return "failed";

    (replyBtn as HTMLButtonElement).click();

    const dialog = await waitFor<HTMLElement | null>(() =>
      document.querySelector("div[role='dialog']") as HTMLElement | null
    );
    if (!dialog) return "failed";

    // paste only (allow editing)
    await pasteReplyOnly(dialog, (commentText || "").trim());

    // approval overlay
    const approval = makeApprovalOverlay(dialog, commentText || "");
    const userChoice = await approval.wait();
    approval.destroy();

    if (userChoice === "stop") {
      // close dialog without posting
      (document.querySelector('div[role="dialog"] [aria-label="Close"]') as HTMLElement | null)?.click();
      state.stopped = true;
      return "stopped";
    }
    if (userChoice === "skip") {
      (document.querySelector('div[role="dialog"] [aria-label="Close"]') as HTMLElement | null)?.click();
      await sleep(150);
      return "skipped";
    }

    // user approved -> submit
    const okSubmit = await submitReply(dialog);
    if (!okSubmit) return "failed";

    const closed = await waitForDialogClose(10000);
    if (!closed) return "failed";

    await sleep(CONFIG.postCloseWaitMs);
    return "posted";
  } catch (e) {
    console.error("❌ engageTweetSemiAuto failed:", e);
    return "failed";
  }
}






// paste ONLY (no submit)
async function pasteReplyOnly(dialog: HTMLElement, text: string): Promise<boolean> {
  if (!dialog) return false;
  const editable =
    (dialog.querySelector(
      '[data-testid="tweetTextarea_0"] div[contenteditable="true"]'
    ) as HTMLElement | null) ||
    (dialog.querySelector('div[role="textbox"][contenteditable="true"]') as HTMLElement | null);
  if (!editable) return false;
  editable.focus();
  try {
    document.execCommand("insertText", false, text || "");
  } catch {
    editable.textContent = text || "";
    editable.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
  return true;
}


function loadRepliedFromStorage(): void {
  try {
    const raw = localStorage.getItem(CONFIG.persistKey);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) arr.forEach((id) => state.repliedIds.add(id));
  } catch {
    /* empty */
  }
}
function saveRepliedToStorage(): void {
  try {
    localStorage.setItem(
      CONFIG.persistKey,
      JSON.stringify([...state.repliedIds])
    );
  } catch {
    /* empty */
  }
}

function getTweetId(article: HTMLElement): string {
  const link = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
  const match = link?.getAttribute("href")?.match(/\/status\/(\d+)/);
  if (match) return match[1];
  const user = (article.querySelector('[data-testid="User-Name"] a') as HTMLElement | null)?.textContent || "";
  const time =
    (article.querySelector("time") as HTMLElement | null)?.getAttribute("datetime") || "";
  const text =
    (article.querySelector('[data-testid="tweetText"]') as HTMLElement | null)?.innerText ||
    "";
  return `${user}|${time}|${text.slice(0, 30)}`;
}

function nextCandidateBelowViewport(): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
  for (const a of all) {
    if (!isVisible(a)) continue;
    if (a.getBoundingClientRect().top <= 0) continue;
    const id = getTweetId(a);
    if (state.repliedIds.has(id)) continue;
    if (state.skippedIds.has(id)) continue;
    if (a.dataset.engaged === "1" || a.dataset.skipped === "1") continue;
    return a;
  }
  return null;
}


async function waitForDialogClose(timeoutMs = 10000): Promise<boolean> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return true;
    await sleep(120);
  }
  return false;
}

function waitForNewTweetsWithTimeout(
  timeoutMs: number = CONFIG.mutationTimeoutMs
): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const markDone = (val: boolean) => {
      if (!done) {
        done = true;
        try {
          state.observer?.disconnect();
        } catch {
          /* empty */
        }
        resolve(val);
      }
    };
    state.observer = new MutationObserver(() => markDone(true));
    state.observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => markDone(false), timeoutMs);
  });
}

async function engageTweet(article: HTMLElement, commentText: string): Promise<boolean> {
  try {
    const { replyBtn, likeBtn } = getTweetActionButtons(article);

    if (likeBtn && !likeBtn.matches('[data-testid="unlike"]')) {
      (likeBtn as HTMLButtonElement).click();
      await sleep(200);
    }
    if (!replyBtn) return false;

    (replyBtn as HTMLButtonElement).click();

    const dialog = await waitFor<HTMLElement | null>(() =>
      document.querySelector("div[role='dialog']") as HTMLElement | null
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

function bumpAttempt(id: string, article?: HTMLElement | null): void {
  const n = (state.attemptsById.get(id) || 0) + 1;
  state.attemptsById.set(id, n);
  if (n >= CONFIG.maxAttemptsPerTweet) {
    state.skippedIds.add(id);
    if (article?.dataset) article.dataset.skipped = "1";
    console.log("⏭️ Skipping stubborn tweet:", id);
  }
}

async function run(): Promise<void> {
  if (state.running) return;
  state.running = true;
  state.stopped = false;
  state.anySuccessThisRun = false;
  loadRepliedFromStorage();

  console.log("▶️ Twitter AI Agent started");

  while (!state.stopped) {
    try {
      // Find next candidate already loaded on the page
      let article = nextCandidateBelowViewport();

      // If no candidate AND we had at least one success, load more by nudging down once
      if (!article && state.anySuccessThisRun) {
        window.scrollBy({
          top: Math.floor(window.innerHeight * CONFIG.scrollAdvanceRatio),
          behavior: "smooth",
        });
        await waitForNewTweetsWithTimeout();
        await sleep(300);
        article = nextCandidateBelowViewport();
        if (!article) {
          await sleep(500);
          continue;
        }
      }

      if (!article) {
        await sleep(400);
        continue;
      }

      // Align candidate
      scrollToAlignTop(article);
      await waitUntilAligned(article, CONFIG.alignTolerancePx, CONFIG.alignMaxWaitMs, state);
      await sleep(150);

      // Screenshot + analyze
      const startedAt = Date.now();
      const resp = await captureAndAnalyzeOnce();
      const tookMs = Date.now() - startedAt;
      console.log(`🧾 Capture+analyze took ${tookMs}ms`, resp);
      console.log("resp?.backend?.result", resp?.backend?.result);
      const aiContent = (resp as any)?.backend?.result?.tweet_text as string | undefined;
      const aiReplyArray = (resp as any)?.backend?.result?.suggested_reply
      const aiReply = aiReplyArray?.short

      const id = getTweetId(article);

      if (!aiContent) {
        bumpAttempt(id, article);
        await sleep(200);
        continue;
      }

      // Try to match in viewport; if none, try a small fallback (allow off-viewport search)
      let hit = (findTweetByText(aiContent, {
        minScore: CONFIG.minMatchScore,
        onlyViewport: true,
      }) as FindTweetHit | null) as FindTweetHit | null;

      if (!hit?.article?.isConnected) {
        hit = (findTweetByText(aiContent, {
          minScore: CONFIG.minMatchScore,
          onlyViewport: false,
        }) as FindTweetHit | null) as FindTweetHit | null;
      }
      if (!hit?.article?.isConnected) {
        console.log("⚠️ No tweet matched the AI snippet in viewport.");
        bumpAttempt(id, article);
        await sleep(250);
        continue;
      }

      const targetId = getTweetId(hit.article);
      if (state.repliedIds.has(targetId)) {
        hit.article.dataset.engaged = "1";
        continue;
      }

      // const ok = await engageTweet(hit.article, aiReply || "");
      // if (ok) {
      //   state.repliedIds.add(targetId);
      //   state.anySuccessThisRun = true;
      //   hit.article.dataset.engaged = "1";
      //   saveRepliedToStorage();

      //   window.scrollBy({
      //     top: Math.floor(window.innerHeight * CONFIG.scrollAdvanceRatio),
      //     behavior: "smooth",
      //   });
      //   await sleep(700);
      //   continue;
      // } else {
      //   bumpAttempt(targetId, hit.article);
      //   await sleep(250);
      // }
       // ✅ unified engage call: semi-auto OR full-auto
       const modeResult = state.semiAuto
       ? await engageTweetSemiAuto(hit.article, aiReply || "")
       : (await engageTweet(hit.article, aiReply || "")) ? "posted" : "failed";

     if (modeResult === "posted") {
       state.repliedIds.add(targetId);
       state.anySuccessThisRun = true;
       hit.article.dataset.engaged = "1";
       saveRepliedToStorage();

       window.scrollBy({
         top: Math.floor(window.innerHeight * CONFIG.scrollAdvanceRatio),
         behavior: "smooth",
       });
       await sleep(700);
       continue;
     } else if (modeResult === "skipped") {
       state.skippedIds.add(targetId);
       hit.article.dataset.skipped = "1";
       await sleep(250);
       continue;
     } else if (modeResult === "stopped") {
       break; // exit run loop gracefully
     } else {
       bumpAttempt(targetId, hit.article);
       await sleep(250);
     }
    } catch (err) {
      console.error("Loop error:", err);
      await sleep(500);
    }
  }

  try {
    state.observer?.disconnect();
  } catch {
    /* empty */
  }
  state.observer = null;
  state.running = false;
  console.log("⏹️ Twitter AI Agent stopped");
}

export default function App() {
  const [_, setRenderToggle] = useState(false); // force re-render


  return (
    <div className="w-full text-center">
      <div className="fixed right-5 top-[100px] z-[9999] flex flex-col gap-2">
        {/* Toggle Semi-auto */}
        <button
          onClick={() => {
            state.semiAuto = !state.semiAuto;
            setRenderToggle((v) => !v); // force re-render
          }}
          className={`p-2.5 rounded-md shadow-md text-white border-none cursor-pointer ${
            state.semiAuto ? "bg-emerald-500" : "bg-slate-500"
          }`}
        >
          Semi-auto: {state.semiAuto ? "ON" : "OFF"}
        </button>
  
        {/* Run Button */}
        <button
          onClick={() => run()}
          id="twitter-agent-btn-start"
          className="p-2.5 rounded-md shadow-md text-white border-none cursor-pointer bg-[#1DA1F2]"
        >
          Run
        </button>
  
        {/* Stop Button */}
        <button
          onClick={() => {
            state.stopped = true;
          }}
          id="twitter-agent-btn-stop"
          className="p-2.5 rounded-md shadow-md text-white border-none cursor-pointer bg-[#e11d48]"
        >
          Stop
        </button>
      </div>
  
      <CommentChat />
    </div>
  );
}



