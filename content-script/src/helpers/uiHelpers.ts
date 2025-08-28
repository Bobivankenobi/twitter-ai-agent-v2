// UI helpers
export const badge = (bg: string, txt: string): React.CSSProperties => {
  console.log("txt", txt);
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    color: "#fff",
    background: bg,
    lineHeight: 1.6,
    marginRight: 6,
  };
};

export const text = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
export const orNone = (v: unknown) => text(v) || "none";
export const orNull = (v: unknown) => text(v) || null;
export const inferTruncated = (t: string) =>
  !!t && (t.length > 275 || /…$/.test(t) || /Show more/i.test(t));
export const enumOr = <T extends string>(v: unknown, allowed: readonly T[], fallback: T) =>
  allowed.includes(v as T) ? (v as T) : fallback;
