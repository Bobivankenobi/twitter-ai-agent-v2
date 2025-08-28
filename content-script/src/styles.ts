export const panelStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 20,
  right: 10,
  width: 360,
  height: "95%",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 12px 30px rgba(2, 6, 23, 0.16)",
  display: "flex",
  flexDirection: "column",
  zIndex: 99999,
  overflow: "hidden",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  color: "#0f172a",
};

export const headerStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  background: "radial-gradient(120% 120% at 0% 0%, #eef2ff 0%, #f1f5f9 40%, #ffffff 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

export const headerTitle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 16,
  letterSpacing: 0.2,
};

export const promptBoxStyle: React.CSSProperties = {
  fontSize: 12,
  textAlign: "left",
  lineHeight: 1.45,
  color: "#334155",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "10px 12px",
  whiteSpace: "pre-wrap",
  marginTop: 10,
};

export const messagesStyle: React.CSSProperties = {
  padding: 12,
  fontSize: 14,
  textAlign: "left",
};

export const inputRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: 10,
  borderTop: "1px solid #e2e8f0",
  background: "#ffffff",
};

export const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  outline: "none",
  fontSize: 13.5,
};

export const sectionStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #eef2f7",
  background: "#fbfdff",
};

export const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#334155",
  marginBottom: 6,
};

export const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280", // muted gray
  marginTop: 2,
  textAlign: "left",
  lineHeight: 1.4,
};

export const textBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  padding: "10px",
  color: "#0f172a",
  fontSize: 13.5,
  lineHeight: 1.5,
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
  background: "linear-gradient(90deg, #0ea5e9, #22d3ee)",
  color: "#ffffff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  boxShadow: "0 4px 12px rgba(14,165,233,0.25)",
} as const;

export const tabBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  padding: "8px 8px 0 8px",
  background: "#f8fafc",
};

export const tabBtn: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};

export const tabBtnActive: React.CSSProperties = {
  ...tabBtn,
  background: "linear-gradient(90deg, #111827, #334155)",
  color: "#fff",
  borderColor: "#111827",
};

export const contentScroll: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  minHeight: 0,
  paddingBottom: 6,
};

export const midGroup: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  justifyContent: "center",
};
export const btnGroupRight: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  justifyContent: "flex-end",
};

export const btn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  color: "#0f172a",
  boxShadow: "0 2px 8px rgba(2,6,23,0.06)",
} as const;

export const checkboxWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  height: 36,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
};

export const checkbox: React.CSSProperties = {
  width: 16,
  height: 16,
  accentColor: "#10b981",
  cursor: "pointer",
};

export const checkboxLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#0f172a",
};

export const controlsRow: React.CSSProperties = {
  display: "flex",

  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  background: "#ffffff",
};

export const btnGroup: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

export const btnBase: React.CSSProperties = {
  minWidth: 70,
  height: 34,
  padding: "6px 12px",
  borderRadius: 8,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  color: "#fff",
  transition: "all 0.2s ease",
};

export const btnNav: React.CSSProperties = {
  ...btnBase,
  background: "#e5e7eb",
  color: "#111827",
};

export const btnInfo: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
};

export const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(90deg, #10b981, #22c55e)",
};

export const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(90deg, #ef4444, #f97316)",
};

export const checkboxLabelWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  color: "#111827",
  cursor: "pointer",
  userSelect: "none",
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};

export const btnArrow: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 8,
  border: "none",
  background: "#e5e7eb",
  color: "#111827",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(2,6,23,0.08)",
  transition: "all 0.15s ease",
};

const checkboxNative: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  width: 16,
  height: 16,
  borderRadius: 4,
  border: "1px solid #d1d5db",
  backgroundColor: "#f9fafb",
  cursor: "pointer",
  display: "inline-block",
};

export const checkboxNativeChecked: React.CSSProperties = {
  ...checkboxNative,
  backgroundColor: "#10b981",
  borderColor: "#10b981",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='white' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 6L9 17l-5-5'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
  backgroundSize: "14px",
};
