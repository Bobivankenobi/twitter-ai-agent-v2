import React, { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "./Spinner";
import { candidatesSorted, circleCurrentArticle, gotoNext, jumpToArticle } from "../helpers/manualNavigationHelpers";
import { CONFIG } from "../constants";
import { sleep } from "../utils";
import { captureAndAnalyzeOnce } from "../actions";

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

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
  repliedIds: new Set<string>(),
  skippedIds: new Set<string>(),
  attemptsById: new Map<string, number>(),
  anySuccessThisRun: false,
  observer: null,
  currentArticle: null,
};

const panelStyle: React.CSSProperties = {
  position: "fixed",
  bottom: "20px",
  right: "20px",
  width: 350,
  height: "95%",
  background: "#fff",
  border: "1px solid #ccc",
  borderRadius: 8,
  boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
  display: "flex",
  flexDirection: "column",
  zIndex: 99999,
  overflow: "hidden", // parent stays hidden; inner content scrolls
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  color: "#111",
};

const headerStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #eee",
  background: "#f9fafb",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const promptBoxStyle: React.CSSProperties = {
  fontSize: 12,
  textAlign: "left",
  lineHeight: 1.35,
  color: "#374151",
  background: "#F3F4F6",
  borderRadius: 6,
  padding: "8px 10px",
  whiteSpace: "pre-wrap",
};

const messagesStyle: React.CSSProperties = {
  padding: 10,
  fontSize: 14,
  textAlign: "left",
};

const inputRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "left",
  gap: 8,
  padding: 10,
  borderTop: "1px solid #eee",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 6,
  outline: "none",
} as const;

export type AnalyzedPost = {
  post_kind: "original" | "reply" | "retweet" | "quote" | "ad";
  is_truncated: boolean;
  language: string | null;
  author_name: string;
  author_handle: string;
  tweet_text: string;
  media_description: string;
  image_text: string;
  relationships: string;
  hidden_or_subtext: string;
  author_intent: string;
  author_tone: string;
  audience: string;
  context_or_background: string;
  why_now: string;
  risks_to_avoid: string;
  takeaway: string;
  key_ideas: string[];
  conversation_hooks: string[];
  suggested_reply: {
    short: string;
    question: string;
    value_add: string;
  };
  confidence: "low" | "medium" | "high";
};

// UI helpers
const badge = (bg: string, txt: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  color: "#fff",
  background: bg,
  lineHeight: 1.6,
  marginRight: 6,
});

const sectionStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #eee",
  background: "#fafafa",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#334155",
  marginBottom: 6,
};

const textBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "10px",
  color: "#111827",
  fontSize: 13.5,
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
};

const pillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#eef2ff",
  color: "#3730a3",
  fontSize: 12,
  marginRight: 6,
  marginBottom: 6,
  border: "1px solid #c7d2fe",
};

const listStyle: React.CSSProperties = {
  margin: "6px 0 0 16px",
  padding: 0,
  color: "#0f172a",
  fontSize: 13.5,
  lineHeight: 1.45,
};

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const subtle: React.CSSProperties = { color: "#64748b", fontSize: 12 };

const sendBtnStyle: React.CSSProperties = {
  background: "#1DA1F2",
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 6,
  cursor: "pointer",
} as const;

// Tabs
type Tab = "chat" | "analysis";

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  padding: "8px 8px 0 8px",
  borderBottom: "1px solid #eee",
  background: "#fafafa",
};

const tabBtn: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const tabBtnActive: React.CSSProperties = {
  ...tabBtn,
  background: "#111827",
  color: "#fff",
  borderColor: "#111827",
};

const contentScroll: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  minHeight: 0, // important for flex scroll
};

const controlsRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "8px 12px",
  borderBottom: "1px solid #eee",
  background: "#fff",
};

// Helpers
const text = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const orNone = (v: unknown) => (text(v) || "none");
const orNull = (v: unknown) => (text(v) || null);
const inferTruncated = (t: string) => !!t && (t.length > 275 || /…$/.test(t) || /Show more/i.test(t));
const enumOr = <T extends string>(v: unknown, allowed: readonly T[], fallback: T) =>
  allowed.includes(v as T) ? (v as T) : fallback;

export default function CommentChat() {
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedPostData, setAnalyzedPostData] = useState({});
  const [activeTab, setActiveTab] = useState<Tab>("chat");

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
      const result = (resp as any)?.backend?.result ?? {};

      const post_kind = enumOr(result?.post_kind, ["original", "reply", "retweet", "quote", "ad"] as const, "original");
      const author_name = text(result?.author_name);
      const author_handle = text(result?.author_handle).startsWith("@")
        ? text(result?.author_handle)
        : author_name
        ? `@${text(result?.author_handle)}`
        : text(result?.author_handle) || "";

      const tweet_text_raw = text(result?.tweet_text) || text(result?.content) || "";
      const media_description = text(result?.media_description) || text(result?.media_summary) || "";
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

  const systemPrompt = useMemo(
    () =>
      `You are helping a user refine a Twitter comment.

System:
• Keep replies casual, concise (<220 chars).
• Ask clarifying questions if needed.

Post content:
${tweet_text || "Analyze the post and provide a comment suggestion."}
`,
    [tweet_text]
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Seed chat with a random suggested reply when analysis arrives
  useEffect(() => {
    const s = (analyzedPostData as AnalyzedPost)?.suggested_reply;
    if (!s) return;
    const replies = [s.short, s.question, s.value_add].filter(Boolean) as string[];
    const randomReply = replies[Math.floor(Math.random() * replies.length)];
    setMessages(randomReply ? [{ role: "assistant", content: randomReply }] : []);
    setInput("");
  }, [analyzedPostData]);

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

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  return (
    <div style={panelStyle} id="ta-chat">
      {/* Header */}
      <div style={headerStyle}>
        <strong>Comment Assistant</strong>
      </div>

      {/* Controls */}
      <div style={controlsRow}>
        <button
          onClick={gotoPrev}
          id="twitter-agent-btn-prev"
          className="px-4 py-2 rounded-md bg-slate-600 text-white shadow hover:bg-slate-700 transition"
        >
          Prev
        </button>

        <button
          onClick={gotoNextPost}
          id="twitter-agent-btn-next"
          className="px-4 py-2 rounded-md bg-slate-600 text-white shadow hover:bg-slate-700 transition"
        >
          Next
        </button>

        <button
          onClick={analyzeCurrentPost}
          id="twitter-agent-btn-analyze"
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-teal-500 text-white shadow hover:bg-teal-600 transition disabled:opacity-50"
          disabled={isAnalyzing}
        >
          <span>Analyze</span>
          {isAnalyzing && <Spinner />}
        </button>
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
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
              <div style={promptBoxStyle}>{systemPrompt}</div>
            </div>

            {/* Thread */}
            <div ref={listRef} style={messagesStyle} aria-live="polite">
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <strong style={{ marginRight: 6 }}>{m.role === "assistant" ? "GPT" : "You"}:</strong>
                  <span>{m.content}</span>
                </div>
              ))}
              {loading && <div style={{ opacity: 0.6, fontStyle: "italic" }}>GPT is typing…</div>}
            </div>
          </>
        ) : (
          <>
            {/* Analysis UI */}
            <div style={sectionStyle}>
              <div style={headerRow}>
                <h2 style={{ fontWeight: 800, color: "#111827" }}>Post Analysis</h2>
                <div>
                  <span style={badge("#0ea5e9", post_kind?.toUpperCase() || "UNKNOWN")} />
                  <span style={badge("#10b981", language || "auto")} />
                  <span style={badge("#6366f1", `confidence: ${confidence || "medium"}`)} />
                  {is_truncated && <span style={badge("#f59e0b", "truncated")} />}
                </div>
              </div>

              {/* Author */}
              <div style={{ marginTop: 8 }}>
                <div style={labelStyle}>Author</div>
                <div style={textBox}>
                  <strong>{author_name || "Unknown"}</strong>{" "}
                  <span style={{ color: "#6b7280" }}>{author_handle || ""}</span>
                </div>
              </div>

              {/* Tweet text */}
              <div style={{ marginTop: 10 }}>
                <div style={labelStyle}>Tweet Text (exact)</div>
                <div style={{ ...textBox, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {tweet_text || "—"}
                </div>
                <div style={{ ...subtle, marginTop: 6 }}>
                  Kind: <strong>{post_kind}</strong> · Truncated: <strong>{String(!!is_truncated)}</strong>
                </div>
              </div>

              {/* Media + OCR */}
              <div style={{ marginTop: 10 }}>
                <div style={labelStyle}>Media Description</div>
                <div style={textBox}>{media_description || "—"}</div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={labelStyle}>Image Text (OCR)</div>
                <div style={textBox}>{image_text || "none"}</div>
              </div>

              {/* Relationships / Subtext */}
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div>
                  <div style={labelStyle}>Relationships</div>
                  <div style={textBox}>{relationships || "—"}</div>
                </div>
                <div>
                  <div style={labelStyle}>Hidden / Subtext</div>
                  <div style={{ ...textBox, background: "#fff7ed", borderColor: "#fed7aa" }}>
                    {hidden_or_subtext || "none"}
                  </div>
                </div>
              </div>

              {/* Intent / Tone / Audience */}
              <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div>
                  <div style={labelStyle}>Author Intent</div>
                  <div style={textBox}>{author_intent || "—"}</div>
                </div>
                <div>
                  <div style={labelStyle}>Author Tone</div>
                  <div style={textBox}>{author_tone || "—"}</div>
                </div>
                <div>
                  <div style={labelStyle}>Audience</div>
                  <div style={textBox}>{audience || "—"}</div>
                </div>
              </div>

              {/* Context / Why now / Risks */}
              <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div>
                  <div style={labelStyle}>Context / Background</div>
                  <div style={textBox}>{context_or_background || "none"}</div>
                </div>
                <div>
                  <div style={labelStyle}>Why Now</div>
                  <div style={textBox}>{why_now || "unclear"}</div>
                </div>
                <div>
                  <div style={labelStyle}>Risks to Avoid</div>
                  <div style={{ ...textBox, background: "#fee2e2", borderColor: "#fecaca" }}>
                    {risks_to_avoid || "—"}
                  </div>
                </div>
              </div>

              {/* Takeaway */}
              <div style={{ marginTop: 10 }}>
                <div style={labelStyle}>Takeaway</div>
                <div style={{ ...textBox, background: "#ecfeff", borderColor: "#bae6fd" }}>
                  {takeaway || "—"}
                </div>
              </div>

              {/* Key ideas */}
              <div style={{ marginTop: 10 }}>
                <div style={labelStyle}>Key Ideas</div>
                {Array.isArray(key_ideas) && key_ideas.length ? (
                  <ul style={listStyle}>
                    {key_ideas.slice(0, 3).map((k, i) => (
                      <li key={i}>• {k}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={textBox}>—</div>
                )}
              </div>

              {/* Conversation hooks */}
              <div style={{ marginTop: 10 }}>
                <div style={labelStyle}>Conversation Hooks</div>
                <div>
                  {(conversation_hooks || []).slice(0, 6).map((h: string, i: number) => (
                    <span key={i} style={pillStyle}>{h}</span>
                  ))}
                  {(!conversation_hooks || conversation_hooks.length === 0) && (
                    <div style={textBox}>—</div>
                  )}
                </div>
              </div>

              {/* Suggested replies */}
              <div style={{ marginTop: 10 }}>
                <div style={labelStyle}>Suggested Reply</div>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
                  <div style={{ ...textBox, background: "#f0fdf4", borderColor: "#bbf7d0" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 6 }}>Short</div>
                    {suggested_reply?.short || "—"}
                  </div>
                  <div style={{ ...textBox, background: "#f0f9ff", borderColor: "#bae6fd" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#075985", marginBottom: 6 }}>Question</div>
                    {suggested_reply?.question || "—"}
                  </div>
                  <div style={{ ...textBox, background: "#faf5ff", borderColor: "#e9d5ff" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#6b21a8", marginBottom: 6 }}>Value Add</div>
                    {suggested_reply?.value_add || "—"}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Input only for Chat tab */}
      {activeTab === "chat" && (
        <div style={inputRowStyle}>
          <input
            type="text"
            placeholder="Reply or ask for a variant…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            style={inputStyle}
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{ ...sendBtnStyle, opacity: loading || !input.trim() ? 0.6 : 1 }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
