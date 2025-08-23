import React, { useEffect } from "react";

export type ApprovalResult = "approve" | "skip" | "stop";

interface Props {
  initial: string;
  onApprove: () => void;
  onSkip: () => void;
  onStop: () => void;
}

export default function CommentApprovalOverlay({ initial, onApprove, onSkip, onStop }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") onApprove();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onApprove, onSkip]);

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>comment coach — approval</div>
      <div style={{ fontSize: 12, opacity: 0.9 }}>
        Review/edit the reply in the textbox. Approve to post.
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button
          onClick={onApprove}
          style={{
            flex: 1,
            background: "#10b981",
            color: "#fff",
            border: "none",
            padding: "8px 10px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          approve (ctrl/⌘+enter)
        </button>
        <button
          onClick={onSkip}
          style={{
            flex: 1,
            background: "#64748b",
            color: "#fff",
            border: "none",
            padding: "8px 10px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          skip (esc)
        </button>
      </div>

      <button
        onClick={onStop}
        style={{
          background: "#ef4444",
          color: "#fff",
          border: "none",
          padding: "8px 10px",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        stop run
      </button>
    </div>
  );
}
