/** The share-picture layout used by the default image and by article images (Batch 17B). Used inside next/og ImageResponse only. */
export const OG_SIZE = { width: 1200, height: 630 };

export function OgCard({ eyebrow, title, footer }: { eyebrow: string; title: string; footer?: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: "linear-gradient(135deg, #0A0E27 0%, #1C2242 55%, #6D35F9 100%)",
        color: "#FAFAFC",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: "linear-gradient(90deg, #2C75FC, #B23CFC)", marginRight: 14 }} />
        LinkLazy
        <span style={{ marginLeft: 20, fontSize: 26, fontWeight: 500, color: "#C9C4F0" }}>{eyebrow}</span>
      </div>
      <div style={{ display: "flex", fontSize: title.length > 70 ? 54 : 66, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1.5 }}>{title}</div>
      <div style={{ display: "flex", fontSize: 28, color: "#C9C4F0" }}>{footer ?? "linklazy.com"}</div>
    </div>
  );
}
