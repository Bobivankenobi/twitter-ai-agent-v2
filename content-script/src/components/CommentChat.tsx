import React, { useEffect, useRef, useState } from "react";
import { Spinner } from "./Spinner";
import {
  candidatesSorted,
  circleCurrentArticle,
  gotoNext,
  jumpToArticle,
  scrollToAlignTop,
  waitUntilAligned,
} from "../helpers/manualNavigationHelpers";
import { CONFIG, SELECTOR } from "../constants";
import { isVisible, loadRepliedFromStorage, saveRepliedToStorage, sleep } from "../utils";
import { captureAndAnalyzeOnce, engageTweet, findTweetByText } from "../actions";
import { getTweetActionButtons } from "../getters";
import CommentApprovalOverlay from "./CommentApprovalOverlay";
import {
  AnalyzedPost,
  ApprovalResult,
  ChatMessage,
  ChatRole,
  FindTweetHit,
  State,
  Tab,
} from "../types";
import { enumOr, inferTruncated, orNone, orNull, text } from "../helpers/uiHelpers";
import { ArrowButton, ToggleSwitch, ChatTextarea } from "./ui";
import { useCallback } from "react";
import {
  btnArrow,
  btnGroup,
  contentScroll,
  controlsRow,
  headerStyle,
  hintStyle,
  inputRowStyle,
  inputStyle,
  labelStyle,
  messagesStyle,
  panelStyle,
  promptBoxStyle,
  sendBtnStyle,
  tabBarStyle,
  tabBtn,
  tabBtnActive,
  textBox,
} from "../styles";
import { btnInfo, btnPrimary, btnDanger, headerTitle } from "../styles";
import PostAnalysis from "./PostAnalysis";

const state: State = {
  stopped: false,
  running: false,
  repliedIds: new Set<string>(),
  skippedIds: new Set<string>(),
  attemptsById: new Map<string, number>(),
  anySuccessThisRun: false,
  observer: null,
  currentArticle: null,
  semiAuto: false,
};

export default function CommentChat() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedPostData, setAnalyzedPostData] = useState({});
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  const [renderToggle, setRenderToggle] = useState(false);
  const [approvalVisible, setApprovalVisible] = useState(false);
  const [approvalInitialText, setApprovalInitialText] = useState("");
  const approvalPromiseRef = useRef<(v: ApprovalResult) => void>();
  console.log("renderToggle", renderToggle);

  // const handlePrev = useCallback(() => {
  //   void gotoPrev();
  // }, []);
  // const handleNext = useCallback(() => {
  //   void gotoNextPost();
  // }, []);
  // const handleAnalyze = useCallback(() => {
  //   void analyzeCurrentPost();
  // }, [isAnalyzing]);
  // const handleRun = useCallback(() => {
  //   void run();
  // }, []);
  // const handleStop = useCallback(() => {
  //   state.stopped = true;
  //   setRenderToggle((v) => !v);
  // }, []);
  const handleToggleSemi = useCallback(() => {
    state.semiAuto = !state.semiAuto;
    setRenderToggle((v) => !v);
  }, []);

  async function engageTweetSemiAuto(
    article: HTMLElement,
    commentText: string,
    waitForApproval: (text: string) => Promise<ApprovalResult>
  ): Promise<"posted" | "skipped" | "failed" | "stopped"> {
    try {
      const { replyBtn, likeBtn } = getTweetActionButtons(article);

      // gentle like (optional)
      if (likeBtn && !likeBtn.matches('[data-testid="unlike"]')) {
        (likeBtn as HTMLButtonElement).click();
        await sleep(150);
      }
      if (!replyBtn) return "failed";

      const userChoice = await waitForApproval(commentText || "");

      if (userChoice === "stop") {
        // close dialog without posting
        (
          document.querySelector('div[role="dialog"] [aria-label="Close"]') as HTMLElement | null
        )?.click();
        state.stopped = true;
        return "stopped";
      }
      if (userChoice === "skip") {
        (
          document.querySelector('div[role="dialog"] [aria-label="Close"]') as HTMLElement | null
        )?.click();
        await sleep(150);
        return "skipped";
      }

      await sleep(CONFIG.postCloseWaitMs);
      console.log("posted");
      return "posted";
    } catch (e) {
      console.error("❌ engageTweetSemiAuto failed:", e);
      return "failed";
    }
  }

  function getTweetId(article: HTMLElement): string {
    const link = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
    const match = link?.getAttribute("href")?.match(/\/status\/(\d+)/);
    if (match) return match[1];
    const user =
      (article.querySelector('[data-testid="User-Name"] a') as HTMLElement | null)?.textContent ||
      "";
    const time =
      (article.querySelector("time") as HTMLElement | null)?.getAttribute("datetime") || "";
    const text =
      (article.querySelector('[data-testid="tweetText"]') as HTMLElement | null)?.innerText || "";
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

  function toAnalyzedPost(result: {
    tweet_text: unknown;
    content: unknown;
    takeaway: unknown;
    post_kind: unknown;
    language: unknown;
    author_name: unknown;
    author_handle: unknown;
    media_description: unknown;
    media_summary: unknown;
    image_text: unknown;
    relationships: unknown;
    hidden_or_subtext: unknown;
    author_intent: unknown;
    author_tone: unknown;
    audience: unknown;
    context_or_background: unknown;
    why_now: unknown;
    risks_to_avoid: unknown;
    key_ideas: unknown[];
    conversation_hooks: unknown[];
    suggested_reply: { short: unknown; question: unknown; value_add: unknown };
    confidence: unknown;
  }): AnalyzedPost {
    const tweet_text_raw = text(result?.tweet_text) || text(result?.content) || "";
    const takeaway_raw = text(result?.takeaway);

    return {
      post_kind: enumOr(
        result?.post_kind,
        ["original", "reply", "retweet", "quote", "ad"] as const,
        "original"
      ),
      is_truncated: inferTruncated(tweet_text_raw),
      language: orNull(result?.language),

      author_name: text(result?.author_name),
      author_handle: text(result?.author_handle).startsWith("@")
        ? text(result?.author_handle)
        : text(result?.author_name)
          ? `@${text(result?.author_handle)}`
          : text(result?.author_handle) || "",

      tweet_text: tweet_text_raw,

      media_description: text(result?.media_description) || text(result?.media_summary) || "",
      image_text: text(result?.image_text) || "none",

      relationships: orNone(result?.relationships),
      hidden_or_subtext: orNone(result?.hidden_or_subtext),

      author_intent: text(result?.author_intent),
      author_tone: text(result?.author_tone),

      audience: orNone(result?.audience),
      context_or_background: orNone(result?.context_or_background),
      why_now: text(result?.why_now) || "unclear",
      risks_to_avoid: orNone(result?.risks_to_avoid),

      takeaway: takeaway_raw.startsWith("✅ In short")
        ? takeaway_raw
        : `✅ In short ${takeaway_raw}`.replace(/\s+/g, " ").trim(),

      key_ideas: Array.isArray(result?.key_ideas)
        ? result.key_ideas.map(text).filter(Boolean).slice(0, 3)
        : [],

      conversation_hooks: Array.isArray(result?.conversation_hooks)
        ? result.conversation_hooks.map(text).filter(Boolean).slice(0, 3)
        : [],

      suggested_reply: {
        short: text(result?.suggested_reply?.short).slice(0, 120),
        question: text(result?.suggested_reply?.question),
        value_add: text(result?.suggested_reply?.value_add),
      },

      confidence: enumOr(result?.confidence, ["low", "medium", "high"] as const, "medium"),
    };
  }

  function extractTweetText(article: HTMLElement): string {
    const el = article.querySelector('[data-testid="tweetText"]') as HTMLElement | null;
    if (!el) return "";
    return (el.innerText || "").replace(/\s+/g, " ").trim();
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

  function bumpAttempt(id: string, article?: HTMLElement | null): void {
    const n = (state.attemptsById.get(id) || 0) + 1;
    state.attemptsById.set(id, n);
    if (n >= CONFIG.maxAttemptsPerTweet) {
      state.skippedIds.add(id);
      if (article?.dataset) article.dataset.skipped = "1";
      console.log("⏭️ Skipping stubborn tweet:", id);
    }
  }

  function waitForApproval(initial: string): Promise<ApprovalResult> {
    setApprovalVisible(true);
    setApprovalInitialText(initial);
    return new Promise<ApprovalResult>((resolve) => {
      approvalPromiseRef.current = resolve;
    });
  }
  //=================  HELPERS  ========================

  async function run(): Promise<void> {
    if (state.running) return;
    state.running = true;
    state.stopped = false;
    state.anySuccessThisRun = false;
    loadRepliedFromStorage(state);

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
        const aiContent = resp?.backend?.result?.tweet_text as string | undefined;
        const aiReplyArray = resp?.backend?.result?.suggested_reply;
        const aiReply = aiReplyArray?.short;

        //---------
        const result = resp?.backend?.result ?? {};
        const structured = toAnalyzedPost(result);
        setAnalyzedPostData(structured);
        setActiveTab("chat");
        //---------

        const id = getTweetId(article);

        if (!aiContent) {
          bumpAttempt(id, article);
          await sleep(200);
          continue;
        }

        // Try to match in viewport; if none, try a small fallback (allow off-viewport search)
        let hit = findTweetByText(aiContent, {
          minScore: CONFIG.minMatchScore,
          onlyViewport: true,
        }) as FindTweetHit | null as FindTweetHit | null;

        if (!hit?.article?.isConnected) {
          hit = findTweetByText(aiContent, {
            minScore: CONFIG.minMatchScore,
            onlyViewport: false,
          }) as FindTweetHit | null as FindTweetHit | null;
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

        const modeResult = state.semiAuto
          ? await engageTweetSemiAuto(hit.article, aiReply || "", waitForApproval)
          : (await engageTweet(hit.article, aiReply || ""))
            ? "posted"
            : "failed";

        if (modeResult === "posted") {
          state.repliedIds.add(targetId);
          state.anySuccessThisRun = true;
          hit.article.dataset.engaged = "1";
          saveRepliedToStorage(state);
          console.log("scrolling");
          await sleep(700);
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
  //=================  HELPERS AUTO AND SEMI AUTO  ========================

  async function gotoPrev(): Promise<void> {
    circleCurrentArticle();
    return gotoNext(-1, CONFIG.alignTolerancePx, CONFIG.alignMaxWaitMs, state);
  }
  async function gotoNextPost(): Promise<void> {
    circleCurrentArticle();
    return gotoNext(+1, CONFIG.alignTolerancePx, CONFIG.alignMaxWaitMs, state);
  }

  async function analyzeCurrentPost(): Promise<void> {
    try {
      setIsAnalyzing(true);
      let a = state.currentArticle;
      if (!a) {
        const arr = candidatesSorted();
        a = arr.find((el) => el.getBoundingClientRect().top > 0) || arr[0] || null;
        if (!a) return;
        await jumpToArticle(a, CONFIG.alignTolerancePx, CONFIG.alignMaxWaitMs, state);
      }

      await jumpToArticle(a, CONFIG.alignTolerancePx, CONFIG.alignMaxWaitMs, state);
      await sleep(120);

      const resp = await captureAndAnalyzeOnce();
      const result = resp?.backend?.result ?? {};
      const post_kind = enumOr(
        result?.post_kind,
        ["original", "reply", "retweet", "quote", "ad"] as const,
        "original"
      );
      const author_name = text(result?.author_name);
      const author_handle = text(result?.author_handle).startsWith("@")
        ? text(result?.author_handle)
        : author_name
          ? `@${text(result?.author_handle)}`
          : text(result?.author_handle) || "";

      const tweet_text_raw = text(result?.tweet_text) || text(result?.content) || "";
      const media_description =
        text(result?.media_description) || text(result?.media_summary) || "";
      const image_text = text(result?.image_text) || "none";

      const structured: AnalyzedPost = {
        post_kind,
        is_truncated: inferTruncated(tweet_text_raw),
        language: orNull(result?.language),

        author_name,
        author_handle,
        tweet_text: tweet_text_raw,

        media_description,
        image_text,

        relationships: orNone(result?.relationships),
        hidden_or_subtext: orNone(result?.hidden_or_subtext),

        author_intent: text(result?.author_intent),
        author_tone: text(result?.author_tone),

        audience: orNone(result?.audience),
        context_or_background: orNone(result?.context_or_background),
        why_now: text(result?.why_now) || "unclear",
        risks_to_avoid: orNone(result?.risks_to_avoid),

        takeaway: text(result?.takeaway).startsWith("✅ In short")
          ? text(result?.takeaway)
          : `✅ In short ${text(result?.takeaway)}`.replace(/\s+/g, " ").trim(),

        key_ideas: Array.isArray(result?.key_ideas)
          ? (result.key_ideas as unknown[]).map(text).filter(Boolean).slice(0, 3)
          : [],

        conversation_hooks: Array.isArray(result?.conversation_hooks)
          ? (result.conversation_hooks as unknown[]).map(text).filter(Boolean).slice(0, 3)
          : [],

        suggested_reply: {
          short: text(result?.suggested_reply?.short).slice(0, 120),
          question: text(result?.suggested_reply?.question),
          value_add: text(result?.suggested_reply?.value_add),
        },

        confidence: enumOr(result?.confidence, ["low", "medium", "high"] as const, "medium"),
      };

      setAnalyzedPostData(structured);

      // auto-switch to Chat and seed with a suggestion
      setActiveTab("chat");
    } catch (error) {
      console.error("Error analyzing current post:", error);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const {
    post_kind,
    is_truncated,
    language,
    author_name,
    author_handle,
    tweet_text,
    media_description,
    image_text,
    relationships,
    hidden_or_subtext,
    author_intent,
    author_tone,
    audience,
    context_or_background,
    why_now,
    risks_to_avoid,
    takeaway,
    key_ideas,
    conversation_hooks,
    suggested_reply,
    confidence,
  } = analyzedPostData as AnalyzedPost;

  // function handleAcceptSuggestion(text: string) {
  //   const analyzed = analyzedPostData as AnalyzedPost;
  //   const tweetText = analyzed?.tweet_text;
  //   if (!tweetText) return alert("No analyzed tweet text found.");

  //   let hit = findTweetByText(tweetText, {
  //     minScore: CONFIG.minMatchScore,
  //     onlyViewport: true,
  //   });

  //   if (!hit?.article?.isConnected) {
  //     hit = findTweetByText(tweetText, {
  //       minScore: CONFIG.minMatchScore,
  //       onlyViewport: false,
  //     });
  //   }

  //   if (!hit?.article) {
  //     return alert("Could not find matching tweet on page.");
  //   }

  //   engageTweet(hit.article, text)
  //     .then((ok) => {
  //       approvalPromiseRef.current?.("approve");
  //       setApprovalVisible(false);
  //       if (!ok) alert("Failed to reply to tweet.");
  //     })
  //     .catch((err) => {
  //       console.error("Error engaging tweet:", err);
  //       alert("Something went wrong while replying.");
  //     });
  // }

  function handleAcceptSuggestion(text: string) {
    const analyzed = analyzedPostData as AnalyzedPost;
    const tweetText = analyzed?.tweet_text;
    if (!tweetText) return alert("No analyzed tweet text found.");

    // 1) fuzzy find (viewport → full page)
    let hit = findTweetByText(tweetText, { minScore: CONFIG.minMatchScore, onlyViewport: true });
    if (!hit?.article?.isConnected) {
      hit = findTweetByText(tweetText, { minScore: CONFIG.minMatchScore, onlyViewport: false });
    }

    // 2) fallback: use currently selected article if text matches closely
    if (!hit?.article && state.currentArticle) {
      const currentText = extractTweetText(state.currentArticle);
      if (
        currentText &&
        tweetText &&
        currentText.includes(tweetText.slice(0, Math.min(40, tweetText.length)))
      ) {
        hit = { article: state.currentArticle } as unknown as FindTweetHit | null;
      }
    }

    if (!hit?.article) {
      return alert("Could not find matching tweet on page.");
    }

    engageTweet(hit.article, text)
      .then((ok) => {
        approvalPromiseRef.current?.("approve");
        setApprovalVisible(false);
        if (!ok) alert("Failed to reply to tweet.");
      })
      .catch((err) => {
        console.error("Error engaging tweet:", err);
        alert("Something went wrong while replying.");
      });
  }

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const onSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    void (async () => {
      await sendMessage(trimmed);
    })();
  }, [input, loading]);

  // Seed chat with a random suggested reply when analysis arrives
  // this needs to be FIXED
  useEffect(() => {
    const s = (analyzedPostData as AnalyzedPost)?.suggested_reply;
    if (!s) return;
    const replies = [s.short, s.question, s.value_add].filter(Boolean) as string[];
    const randomReply = replies[Math.floor(Math.random() * replies.length)];
    setMessages(
      randomReply
        ? [
            {
              role: "assistant",
              content: "Suggested comments not quite right? Let’s find a better one.",
            },
          ]
        : []
    );
    setInput("");
  }, [analyzedPostData]);

  const ANALYZE_BTN_CLASS = "ca-analyze-btn";

  function hydrateAnalysisFromArticle(article: HTMLElement) {
    const t = extractTweetText(article);
    // you can grab more fields if you want
    const authorName =
      (article.querySelector('[data-testid="User-Name"] a') as HTMLElement | null)?.textContent ||
      "";
    const authorHandleRaw =
      (article.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null)?.pathname
        ?.split("/")
        ?.filter(Boolean)[0] || "";
    const authorHandle = authorHandleRaw ? `@${authorHandleRaw}` : "";

    // append this tweet’s text into analyzedPostData so Accept can fuzzy-find
    setAnalyzedPostData((prev) => ({
      ...prev,
      tweet_text: t, // <-- key bit: make Accept work
      author_name: authorName,
      author_handle: authorHandle,
      post_kind: (prev as AnalyzedPost)?.post_kind ?? "original",
    }));
  }

  function attachAnalyzeButtonToArticle(
    article: HTMLElement,
    setInputCb: (v: string) => void,
    setActiveTabCb: (tab: Tab) => void
    // analyzeCurrentPost: () => Promise<void>
  ) {
    if (article.querySelector(`.${ANALYZE_BTN_CLASS}`)) return;

    const actionRow =
      article.querySelector('div[role="group"]') ||
      article.querySelector('[data-testid="reply"]')?.parentElement?.parentElement;
    if (!actionRow) return;

    const btn = document.createElement("button");
    btn.textContent = "Append text of post to chat";
    btn.className = ANALYZE_BTN_CLASS;
    Object.assign(btn.style, {
      marginLeft: "8px",
      padding: "6px 10px",
      border: "1px solid rgba(29,155,240,0.4)",
      background: "rgba(29,155,240,0.15)",
      color: "#E7E9EA",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "12px",
    } as CSSStyleDeclaration);

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      state.currentArticle = article;

      // 1) grab tweet text and seed the chat input
      const tweetText = extractTweetText(article);
      if (tweetText) {
        setActiveTabCb("chat");
        setInputCb(`create comment for this post:\n${tweetText}`);
      }

      // 2) ALSO hydrate analyzedPostData.tweet_text so Accept can fuzzy-find
      hydrateAnalysisFromArticle(article);
      // 2) (optional) still run your analysis pipeline
      // await analyzeCurrentPost();
    });

    actionRow.appendChild(btn);
  }

  function isInViewport(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  function attachButtonsToVisibleTweets(
    setInputCb: (v: string) => void,
    setActiveTabCb: (tab: Tab) => void
    // analyzeCurrentPost: () => Promise<void>
  ) {
    // analyzeCurrentPost
    const articles = document.querySelectorAll<HTMLElement>(SELECTOR);
    articles.forEach((a) => {
      if (!isVisible(a)) return;
      if (!isInViewport(a)) return;
      attachAnalyzeButtonToArticle(a, setInputCb, setActiveTabCb);
    });
  }

  useEffect(() => {
    // analyzeCurrentPost
    attachButtonsToVisibleTweets(setInput, setActiveTab);

    const mo = new MutationObserver(() => {
      // analyzeCurrentPost
      requestAnimationFrame(() => attachButtonsToVisibleTweets(setInput, setActiveTab));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // analyzeCurrentPost
    const onScroll = () => attachButtonsToVisibleTweets(setInput, setActiveTab);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // autoscroll chat
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // send message
  const backendUrl = "http://localhost:4000";
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: "user" as ChatRole, content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${backendUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analyzedPost: analyzedPostData,
          messages: nextMessages,
        }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data?.reply || "" }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Network error" }]);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: 44,
    maxHeight: 160,
    resize: "vertical",
  } as const;

  return (
    <div style={panelStyle} id="ta-chat">
      <div style={headerStyle}>
        <div style={headerTitle}>Comment Coach</div>
      </div>

      {/* Controls */}
      <div style={controlsRow}>
        {/* Navigation + Analyze */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <div style={btnGroup}>
            <ArrowButton title="Previous post" direction="up" onClick={gotoPrev} style={btnArrow} />
            <ArrowButton
              title="Next post"
              direction="down"
              onClick={gotoNextPost}
              style={btnArrow}
            />
            <button onClick={analyzeCurrentPost} style={btnInfo} disabled={isAnalyzing}>
              {isAnalyzing ? <Spinner /> : "Analyze"}
            </button>
          </div>
          <div style={hintStyle}>Analyze = check only current post</div>
        </div>
      </div>

      {/* Right: run/stop */}

      <div>
        <div style={controlsRow}>
          {/* Semi-auto + Run/Stop */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={btnGroup}>
              <button onClick={run} style={btnPrimary}>
                Run
              </button>
              <button
                onClick={() => {
                  state.stopped = true;
                }}
                style={btnDanger}
              >
                Stop
              </button>
              <ToggleSwitch
                checked={state.semiAuto}
                onToggle={handleToggleSemi}
                label="Confirm replies"
              />
            </div>
            <div style={hintStyle}>
              Run = start auto-replying
              <br />
              Stop = end process
              <br />
              Confirm replies = approve every comment first before posting
            </div>
          </div>
        </div>

        {approvalVisible && (
          <CommentApprovalOverlay
            initial={approvalInitialText}
            onApprove={() => {
              approvalPromiseRef.current?.("approve");
              setApprovalVisible(false);
            }}
            onSkip={() => {
              approvalPromiseRef.current?.("skip");
              setApprovalVisible(false);
            }}
            onStop={() => {
              approvalPromiseRef.current?.("stop");
              setApprovalVisible(false);
            }}
          />
        )}
      </div>
      {/* Tabs */}
      <div style={tabBarStyle}>
        <button
          style={activeTab === "chat" ? tabBtnActive : tabBtn}
          onClick={() => setActiveTab("chat")}
        >
          Chat
        </button>
        <button
          style={activeTab === "analysis" ? tabBtnActive : tabBtn}
          onClick={() => setActiveTab("analysis")}
        >
          Analysis
        </button>
      </div>

      {/* Scrollable content area */}
      <div style={contentScroll}>
        {activeTab === "chat" ? (
          <>
            {/* System prompt (optional visibility) */}
            <div style={promptBoxStyle}>
              <p style={{ marginTop: 5 }}>
                Type your comment idea or ask for a variant, and I’ll suggest a concise reply.
              </p>
              <p style={{ marginTop: 15 }}>
                <i>Post content:</i>
              </p>
              <p>
                <strong>
                  {tweet_text || "Analyze the post and provide a comment suggestion."}
                </strong>
              </p>
            </div>

            {takeaway && (
              <div style={{ marginTop: 16 }}>
                <div style={labelStyle}>🔍 Takeaway</div>
                <div
                  style={{
                    ...textBox,
                    background: "#ecfeff",
                    borderColor: "#bae6fd",
                    fontSize: 13,
                    padding: "8px 12px",
                    borderRadius: 8,
                  }}
                >
                  {takeaway}
                </div>
              </div>
            )}

            {/* Suggested Replies */}
            {suggested_reply && (
              <div style={{ marginTop: 16 }}>
                <div style={labelStyle}>💡 Comment Suggestions</div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}
                >
                  {[
                    {
                      label: "Short",
                      color: "#16a34a",
                      bg: "#f0fdf4",
                      text: suggested_reply.short,
                    },
                    {
                      label: "Question",
                      color: "#0284c7",
                      bg: "#f0f9ff",
                      text: suggested_reply.question,
                    },
                    {
                      label: "Value Add",
                      color: "#9333ea",
                      bg: "#faf5ff",
                      text: suggested_reply.value_add,
                    },
                  ]
                    .filter(({ text }) => text)
                    .map(({ label, color, bg, text }) => (
                      <div
                        key={label}
                        style={{
                          background: bg,
                          border: `1px solid ${color}20`,
                          padding: "10px 12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div style={{ fontWeight: "bold", fontSize: 12, color }}>{label}</div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ fontSize: 13, maxWidth: "70%", lineHeight: 1.4 }}>
                            {text}
                          </div>
                          <button
                            onClick={() => handleAcceptSuggestion(text!)}
                            style={{
                              ...sendBtnStyle,
                              background: color,
                              fontSize: 11,
                              height: "28px",
                              padding: "4px 10px",
                              borderRadius: 6,
                              marginLeft: 8,
                              whiteSpace: "nowrap",
                            }}
                          >
                            ✅ Accept
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Thread */}
            <div ref={listRef} style={messagesStyle} aria-live="polite">
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <strong style={{ marginRight: 6 }}>
                    {m.role === "assistant" ? "GPT" : "You"}:
                  </strong>
                  <span>{m.content}</span>
                  {m.role === "assistant" && (
                    <button
                      onClick={() => handleAcceptSuggestion(m.content!)}
                      style={{
                        ...sendBtnStyle,
                        background: "#16a34a",
                        fontSize: 11,
                        height: "28px",
                        padding: "4px 10px",
                        borderRadius: 6,
                        marginLeft: 8,
                        whiteSpace: "nowrap",
                      }}
                    >
                      ✅ Accept
                    </button>
                  )}
                </div>
              ))}
              {loading && <div style={{ opacity: 0.6, fontStyle: "italic" }}>GPT is typing…</div>}
            </div>
          </>
        ) : (
          <>
            {/* Analysis UI */}
            <PostAnalysis
              post_kind={post_kind}
              is_truncated={is_truncated}
              language={language}
              author_name={author_name}
              author_handle={author_handle}
              tweet_text={tweet_text}
              media_description={media_description}
              image_text={image_text}
              relationships={relationships}
              hidden_or_subtext={hidden_or_subtext}
              author_intent={author_intent}
              author_tone={author_tone}
              audience={audience}
              context_or_background={context_or_background}
              why_now={why_now}
              risks_to_avoid={risks_to_avoid}
              takeaway={takeaway}
              key_ideas={key_ideas}
              conversation_hooks={conversation_hooks}
              suggested_reply={suggested_reply}
              confidence={confidence}
            />
          </>
        )}
      </div>

      {/* Input only for Chat tab */}
      {activeTab === "chat" && (
        <div style={inputRowStyle}>
          <ChatTextarea
            value={input}
            onChange={setInput}
            onSend={onSend}
            style={textareaStyle}
            buttonStyle={{
              ...sendBtnStyle,
              alignSelf: "flex-end",
              opacity: loading || !input.trim() ? 0.6 : 1,
            }}
            disabled={loading || !input.trim()}
          />
        </div>
      )}
    </div>
  );
}
