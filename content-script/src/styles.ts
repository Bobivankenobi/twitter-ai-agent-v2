export const panelStyle: React.CSSProperties = {
  position: "fixed",
  bottom: "20px",
  right: "10px",
  width: 350,
  height: "95%",
  background: "#fff",
  border: "1px solid #ccc",
  borderRadius: 8,
  boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
  display: "flex",
  flexDirection: "column",
  zIndex: 99999,
  overflow: "hidden",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  color: "#111",
};

export const headerStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #eee",
  background: "#f9fafb",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

export const promptBoxStyle: React.CSSProperties = {
  fontSize: 12,
  textAlign: "left",
  lineHeight: 1.35,
  color: "#374151",
  background: "#F3F4F6",
  borderRadius: 6,
  padding: "8px 10px",
  whiteSpace: "pre-wrap",
  marginTop: 10,
};

export const messagesStyle: React.CSSProperties = {
  padding: 10,
  fontSize: 14,
  textAlign: "left",
};

export const inputRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "left",
  gap: 8,
  padding: 10,
  borderTop: "1px solid #eee",
};

export const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 6,
  outline: "none",
} as const;

export const sectionStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #eee",
  background: "#fafafa",
};

export const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#334155",
  marginBottom: 6,
};

export const textBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "10px",
  color: "#111827",
  fontSize: 13.5,
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
};

export const pillStyle: React.CSSProperties = {
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

export const listStyle: React.CSSProperties = {
  margin: "6px 0 0 16px",
  padding: 0,
  color: "#0f172a",
  fontSize: 13.5,
  lineHeight: 1.45,
};

export const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

export const subtle: React.CSSProperties = { color: "#64748b", fontSize: 12 };

export const sendBtnStyle: React.CSSProperties = {
  background: "#1DA1F2",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: 6,
  cursor: "pointer",
} as const;

export const tabBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  padding: "8px 8px 0 8px",
  borderBottom: "1px solid #eee",
  background: "#fafafa",
};

export const tabBtn: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

export const tabBtnActive: React.CSSProperties = {
  ...tabBtn,
  background: "#111827",
  color: "#fff",
  borderColor: "#111827",
};

export const contentScroll: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  minHeight: 0,
};

export const controlsRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "8px 12px",
  borderBottom: "1px solid #eee",
  background: "#fff",
};
