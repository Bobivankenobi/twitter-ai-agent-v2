import React, { useEffect } from "react";
import Logo from "./Logo";
import { sleep, waitFor } from "./utils";
import {
  captureAndAnalyzeOnce,
  findTweetByText,
  pasteAndSubmitReply,
} from "./actions";
import { getTweetActionButtons } from "./getters";
import { OFFSET_TOP_PX, SELECTOR } from "./constants";

// If you don't have chrome types installed, this prevents TS errors
declare const chrome: any;

// ======================
// Types
// ======================
interface Config {
  alignTolerancePx: number;
  alignMaxWaitMs: number;
  minMatchScore: number;
  postCloseWaitMs: number;
  scrollAdvanceRatio: number;
  mutationTimeoutMs: number;
  persistKey: string;
  maxAttemptsPerTweet: number;
}

interface FindTweetHit {
  article: HTMLElement;
  score: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface State {
  stopped: boolean;
  running: boolean;
  repliedIds: Set<string>;
  skippedIds: Set<string>;
  attemptsById: Map<string, number>;
  anySuccessThisRun: boolean;
  observer: MutationObserver | null;
  currentArticle: HTMLElement | null;
}

// ======================
// Config & State
// ======================
const CONFIG: Config = {
  alignTolerancePx: 2,
  alignMaxWaitMs: 1500,
  minMatchScore: 0.55,
  postCloseWaitMs: 1200,
  scrollAdvanceRatio: 0.15,
  mutationTimeoutMs: 6000,
  persistKey: "twitterAgent.repliedIds.v1",
  maxAttemptsPerTweet: 2,
};

const state: State = {
  stopped: false,
  running: false,
  repliedIds: new Set<string>(),
  skippedIds: new Set<string>(),
  attemptsById: new Map<string, number>(),
  anySuccessThisRun: false,
  observer: null,
  currentArticle: null,
};

// ======================
// Helpers (from content.js)
// ======================
function ensureStyles(): void {
  if (document.getElementById("ta-style")) return;
  const el = document.createElement("style");
  el.id = "ta-style";
  el.textContent = `
    .ta-current { outline: 3px solid red !important; border-radius: 10px; }
  `;
  document.head.appendChild(el);
}

function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function candidatesSorted(): HTMLElement[] {
  const arr = Array.from(
    document.querySelectorAll<HTMLElement>(SELECTOR)
  )
    .filter(isVisible)
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
    );
  return arr;
}

function setCurrentArticle(a: HTMLElement | null): void {
  if (state.currentArticle && state.currentArticle.isConnected) {
    state.currentArticle.classList.remove("ta-current");
    state.currentArticle.dataset.current = "0";
  }
  state.currentArticle = a;
  if (a) {
    a.classList.add("ta-current");
    a.dataset.current = "1";
  }
}

async function jumpToArticle(a: HTMLElement | null): Promise<void> {
  if (!a) return;
  setCurrentArticle(a);
  scrollToAlignTop(a);
  await waitUntilAligned(a);
}

function currentIndex(arr: HTMLElement[]): number {
  if (!state.currentArticle) return -1;
  return arr.indexOf(state.currentArticle);
}

async function gotoNext(delta = +1): Promise<void> {
  const arr = candidatesSorted();
  if (!arr.length) return;
  let idx = currentIndex(arr);
  if (idx === -1) {
    const below = arr.find((el) => el.getBoundingClientRect().top > 0);
    await jumpToArticle(below || arr[0]);
    return;
  }
  idx = Math.min(Math.max(idx + delta, 0), arr.length - 1);
  await jumpToArticle(arr[idx]);
}
async function gotoPrev(): Promise<void> {
  return gotoNext(-1);
}
async function gotoNextPost(): Promise<void> {
  return gotoNext(+1);
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

async function analyzeCurrentPost(): Promise<void> {
  let a = state.currentArticle;
  if (!a) {
    const arr = candidatesSorted();
    a = arr.find((el) => el.getBoundingClientRect().top > 0) || arr[0] || null;
    if (!a) return;
    await jumpToArticle(a);
  }

  await jumpToArticle(a);
  await sleep(120);

  const resp = await captureAndAnalyzeOnce();
  const aiReply = (resp as any)?.backend?.result?.comment_suggestion || "";
  const aiContent = (resp as any)?.backend?.result?.content || "";

  // open chat UI instead of pasting directly
  openCommentChat(aiReply, aiContent);
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

function scrollToAlignTop(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const y = window.scrollY + rect.top - OFFSET_TOP_PX;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

async function waitUntilAligned(
  el: HTMLElement,
  tol: number = CONFIG.alignTolerancePx,
  maxWaitMs: number = CONFIG.alignMaxWaitMs
): Promise<boolean> {
  const start = performance.now();
  while (performance.now() - start < maxWaitMs) {
    if (state.stopped) return false;
    const top = el.getBoundingClientRect().top;
    if (top >= OFFSET_TOP_PX - tol && top <= OFFSET_TOP_PX + tol) return true;
    await sleep(50);
  }
  return false;
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


// extract this
export async function engageTweet(article: HTMLElement, commentText: string): Promise<boolean> {
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
      await waitUntilAligned(article);
      await sleep(150);

      // Screenshot + analyze
      const startedAt = Date.now();
      const resp = await captureAndAnalyzeOnce();
      const tookMs = Date.now() - startedAt;
      console.log(`🧾 Capture+analyze took ${tookMs}ms`, resp);

      const aiContent = (resp as any)?.backend?.result?.content as string | undefined;
      const aiReply = (resp as any)?.backend?.result?.comment_suggestion as string | undefined;

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

      const ok = await engageTweet(hit.article, aiReply || "");
      if (ok) {
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

// Start/Stop messages
function attachRuntimeListeners(): void {
  if (!chrome?.runtime?.onMessage) return;
  chrome.runtime.onMessage.addListener((request: any) => {
    if (request.action === "runScroll") run();
    if (request.action === "stopScroll") state.stopped = true;
  });
}

// UI controls
function injectControls(): void {
  const ids = [
    "twitter-agent-btn-start",
    "twitter-agent-btn-stop",
    "twitter-agent-btn-prev",
    "twitter-agent-btn-next",
    "twitter-agent-btn-analyze",
  ];
  if (ids.some((id) => document.getElementById(id))) return;

  function makeBtn(
    id: string,
    label: string,
    top: string,
    onclick: () => void,
    bg: string
  ) {
    const b = document.createElement("button");
    b.id = id;
    b.textContent = label;
    Object.assign(b.style, {
      position: "fixed",
      right: "20px",
      top,
      zIndex: "9999",
      padding: "10px",
      background: bg,
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    } as CSSStyleDeclaration);
    b.onclick = onclick;
    document.body.appendChild(b);
    return b;
  }

  makeBtn(
    "twitter-agent-btn-start",
    "🤖 Run",
    "100px",
    () => chrome.runtime?.sendMessage?.({ action: "runScroll" }),
    "#1DA1F2"
  );
  makeBtn(
    "twitter-agent-btn-stop",
    "⏹ Stop",
    "140px",
    () => chrome.runtime?.sendMessage?.({ action: "stopScroll" }),
    "#e11d48"
  );

  makeBtn("twitter-agent-btn-prev", "⬆ Prev", "200px", () => gotoPrev(), "#475569");
  makeBtn("twitter-agent-btn-next", "⬇ Next", "240px", () => gotoNextPost(), "#475569");
  makeBtn(
    "twitter-agent-btn-analyze",
    "🧪 Analyze",
    "280px",
    () => analyzeCurrentPost(),
    "#14b8a6"
  );

  // hotkeys J/K to navigate, A to analyze
  window.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /input|textarea/i.test(t.tagName))) return;
    if (e.key.toLowerCase() === "j") gotoNextPost();
    if (e.key.toLowerCase() === "k") gotoPrev();
    if (e.key.toLowerCase() === "a") analyzeCurrentPost();
  });
}

// Chat UI
function openCommentChat(initialSuggestion: string, tweetContent: string) {
  let container = document.getElementById("ta-chat");
  if (container) container.remove();

  const chatHistory: ChatMessage[] = [
    { role: "assistant", content: `here’s my first comment: "${initialSuggestion || ""}"` },
  ];

  container = document.createElement("div");
  container.id = "ta-chat";
  Object.assign(container.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "350px",
    maxHeight: "400px",
    background: "#fff",
    border: "1px solid #ccc",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    zIndex: "99999",
  } as unknown as CSSStyleDeclaration);

  const messagesDiv = document.createElement("div");
  Object.assign(messagesDiv.style, {
    flex: "1",
    overflowY: "auto",
    padding: "10px",
    fontSize: "14px",
    color: "#111",
  } as CSSStyleDeclaration);

  const inputDiv = document.createElement("div");
  inputDiv.style.display = "flex";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Ask GPT...";
  Object.assign(input.style, {
    flex: "1",
    padding: "8px",
    border: "none",
    outline: "none",
    color: "#111",
  } as CSSStyleDeclaration);

  const sendBtn = document.createElement("button");
  sendBtn.textContent = "Send";
  Object.assign(sendBtn.style, {
    background: "#1DA1F2",
    color: "#fff",
    border: "none",
    padding: "8px 12px",
    cursor: "pointer",
  } as CSSStyleDeclaration);

  inputDiv.appendChild(input);
  inputDiv.appendChild(sendBtn);

  container.appendChild(messagesDiv);
  container.appendChild(inputDiv);
  document.body.appendChild(container);

  addChatMessage(messagesDiv, "GPT", `Here’s my first comment: "${initialSuggestion || ""}"`);

  async function sendMessage(text: string) {
    if (!text) return;
    addChatMessage(messagesDiv, "You", text);

    chatHistory.push({ role: "user", content: text });

    try {
      const res = await fetch("http://localhost:4000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tweetContent,
          messages: chatHistory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addChatMessage(
          messagesDiv,
          "GPT",
          `Error: ${data?.error || "unknown error"}`
        );
        return;
      }

      const reply = (data && data.reply) || "";
      addChatMessage(messagesDiv, "GPT", reply);
      chatHistory.push({ role: "assistant", content: reply });
    } catch (e) {
      addChatMessage(messagesDiv, "GPT", `Network error`);
      console.error("Chat error:", e);
    }
  }

  sendBtn.onclick = () => {
    const text = input.value.trim();
    input.value = "";
    sendMessage(text);
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const text = input.value.trim();
      input.value = "";
      sendMessage(text);
    }
  });
}

function addChatMessage(container: HTMLElement, sender: string, text: string) {
  const msg = document.createElement("div");
  msg.style.marginBottom = "8px";
  msg.style.color = "#111";
  msg.innerHTML = `<strong>${sender}:</strong> ${text}`;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

// ======================
// React component
// ======================
export default function App() {

  
  useEffect(() => {
    ensureStyles();
    attachRuntimeListeners();
    injectControls();

    return () => {
      try {
        state.observer?.disconnect();
      } catch {
        /* empty */
      }
    };
  }, []);

  return (
    <div className="w-full text-center">
    </div>
  );
}
