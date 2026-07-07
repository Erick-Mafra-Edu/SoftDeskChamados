import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(160deg, rgb(12, 62, 140) 0%, rgb(20, 115, 230) 55%, rgb(138, 206, 255) 100%)",
          color: "white",
          fontSize: 220,
          fontWeight: 700,
          letterSpacing: -12,
        }}
      >
        DS
      </div>
    ),
    size,
  );
}
