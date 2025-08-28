import React from "react";

export const ArrowButton: React.FC<{
  title: string;
  direction: "up" | "down";
  onClick: () => void;
  style: React.CSSProperties;
}> = ({ title, direction, onClick, style }) => (
  <button onClick={onClick} style={style} title={title} aria-label={title}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      {direction === "up" ? <path d="M12 6l-7 8h14z" /> : <path d="M12 18l7-8H5z" />}
    </svg>
  </button>
);

export const ToggleSwitch: React.FC<{
  checked: boolean;
  onToggle: () => void;
  label: string;
}> = ({ checked, onToggle, label }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle()}
      style={{
        width: 34,
        height: 18,
        borderRadius: 9999,
        background: checked ? "#10b981" : "#e5e7eb",
        position: "relative",
        transition: "background 0.2s",
        outline: "none",
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          transition: "left 0.2s",
        }}
      />
    </div>
    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{label}</span>
  </label>
);

export const Toolbar: React.FC<{
  left: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  style: React.CSSProperties;
}> = ({ left, center, right, style }) => (
  <div style={style}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{left}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{center}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{right}</div>
    </div>
  </div>
);

export const ChatTextarea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  style: React.CSSProperties;
  buttonStyle: React.CSSProperties;
  disabled?: boolean;
}> = ({ value, onChange, onSend, style, buttonStyle, disabled }) => {
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };
  return (
    <>
      <textarea
        placeholder="Reply or ask for a variant…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        style={style}
        rows={3}
      />
      <button onClick={onSend} disabled={disabled} style={buttonStyle}>
        Send
      </button>
    </>
  );
};
