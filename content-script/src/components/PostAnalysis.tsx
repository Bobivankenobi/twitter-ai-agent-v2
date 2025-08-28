import React from "react";
import { AnalyzedPost } from "../types";
import { badge } from "../helpers/uiHelpers";
import {
  sectionStyle,
  headerRow,
  labelStyle,
  textBox,
  subtle,
  listStyle,
  pillStyle,
} from "../styles";

type Props = Pick<
  AnalyzedPost,
  | "post_kind"
  | "is_truncated"
  | "language"
  | "author_name"
  | "author_handle"
  | "tweet_text"
  | "media_description"
  | "image_text"
  | "relationships"
  | "hidden_or_subtext"
  | "author_intent"
  | "author_tone"
  | "audience"
  | "context_or_background"
  | "why_now"
  | "risks_to_avoid"
  | "takeaway"
  | "key_ideas"
  | "conversation_hooks"
  | "suggested_reply"
  | "confidence"
>;

const PostAnalysis: React.FC<Props> = ({
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
}) => {
  return (
    <div style={sectionStyle}>
      {/* Header */}
      <div style={headerRow}>
        <h2 style={{ fontWeight: 800, color: "#111827" }}>Post Analysis</h2>
        <div>
          <span style={badge("#0ea5e9", (post_kind || "UNKNOWN").toUpperCase())} />
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
        <div
          style={{
            ...textBox,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
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
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "1fr 1fr 1fr",
        }}
      >
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
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "1fr 1fr 1fr",
        }}
      >
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
            <span key={i} style={pillStyle}>
              {h}
            </span>
          ))}
          {(!conversation_hooks || conversation_hooks.length === 0) && <div style={textBox}>—</div>}
        </div>
      </div>

      {/* Suggested replies */}
      <div style={{ marginTop: 10 }}>
        <div style={labelStyle}>Suggested Reply</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div style={{ ...textBox, background: "#f0fdf4", borderColor: "#bbf7d0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 6 }}>
              Short
            </div>
            {suggested_reply?.short || "—"}
          </div>
          <div style={{ ...textBox, background: "#f0f9ff", borderColor: "#bae6fd" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#075985", marginBottom: 6 }}>
              Question
            </div>
            {suggested_reply?.question || "—"}
          </div>
          <div style={{ ...textBox, background: "#faf5ff", borderColor: "#e9d5ff" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b21a8", marginBottom: 6 }}>
              Value Add
            </div>
            {suggested_reply?.value_add || "—"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostAnalysis;
