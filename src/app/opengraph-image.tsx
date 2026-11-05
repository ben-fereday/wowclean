import { ImageResponse } from "next/og";

export const alt = "WOW CLEAN — Mobile auto detailing in Calgary";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          padding: "76px",
          color: "#ffffff",
          background: "linear-gradient(120deg, #080e22, #101d48)",
          borderTop: "12px solid #5bf3ff",
        }}
      >
        <div style={{ color: "#5bf3ff", fontSize: 26, fontWeight: 700, letterSpacing: 7 }}>CALGARY, AB</div>
        <div style={{ display: "flex", alignItems: "center", gap: 26, fontSize: 116, fontWeight: 700, letterSpacing: -5 }}>
          <span style={{ color: "#5bf3ff" }}>WOW</span>
          <span>CLEAN</span>
        </div>
        <div style={{ marginTop: 14, color: "#bac9df", fontSize: 38 }}>Mobile auto detailing in Calgary</div>
      </div>
    ),
    size,
  );
}
