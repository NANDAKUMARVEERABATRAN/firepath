"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { shareText, type Milestone } from "@/lib/milestones";

const SIZE = 1080;
const CHIP_LABELS: Record<string, string> = { fire: "FIRE %", freedom: "Freedom", streak: "Streak", levels: "Levels", rank: "Rank", gain: "Growth", lessons: "Lessons" };

/** Draws a branded square image for a milestone (no money amounts — safe to share). */
function draw(canvas: HTMLCanvasElement, m: Milestone) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = SIZE; canvas.height = SIZE;
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, "#142b45"); bg.addColorStop(0.65, "#1c4a5e"); bg.addColorStop(1, "#159b72");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE);
  // soft glow
  const glow = ctx.createRadialGradient(SIZE * 0.8, SIZE * 0.15, 0, SIZE * 0.8, SIZE * 0.15, SIZE * 0.6);
  glow.addColorStop(0, "rgba(85,214,166,0.35)"); glow.addColorStop(1, "rgba(85,214,166,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, SIZE, SIZE);

  const font = (weight: number, size: number) => `${weight} ${size}px Manrope, "Segoe UI", system-ui, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff"; ctx.font = font(800, 46); ctx.fillText("FIRE", 90, 130);
  const fireWidth = ctx.measureText("FIRE").width;
  ctx.fillStyle = "#55d6a6"; ctx.fillText("path", 90 + fireWidth, 130);

  ctx.font = font(400, 150); ctx.fillText(m.emoji, 82, 380);

  // headline, wrapped
  ctx.fillStyle = "#ffffff"; ctx.font = font(800, 76);
  const words = m.headline.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > SIZE - 180 && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  lines.slice(0, 4).forEach((text, i) => ctx.fillText(text, 90, 520 + i * 92));
  const afterHeadline = 520 + Math.min(4, lines.length) * 92;

  ctx.fillStyle = "#c0ced5"; ctx.font = font(500, 40); ctx.fillText(m.sub, 90, afterHeadline + 20);

  if (m.progress !== undefined) {
    const y = afterHeadline + 90, w = SIZE - 180, h = 30;
    ctx.fillStyle = "rgba(255,255,255,0.16)"; ctx.beginPath(); ctx.roundRect(90, y, w, h, 15); ctx.fill();
    const bar = ctx.createLinearGradient(90, 0, 90 + w, 0); bar.addColorStop(0, "#55d6a6"); bar.addColorStop(1, "#ffe08a");
    ctx.fillStyle = bar; ctx.beginPath(); ctx.roundRect(90, y, Math.max(h, w * Math.min(1, m.progress / 100)), h, 15); ctx.fill();
  }

  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = font(600, 34); ctx.fillText("Find your FIRE number — free", 90, SIZE - 110);
  ctx.fillStyle = "#55d6a6"; ctx.font = font(800, 34); ctx.fillText("Start your path on FIREpath →", 90, SIZE - 62);
}

export default function ShareMilestone({ milestones }: { milestones: Milestone[] }) {
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState("");
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = milestones[Math.min(index, milestones.length - 1)];
  const siteUrl = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin) : "";

  useEffect(() => {
    if (!current || !canvasRef.current) return;
    // Wait for the web font so the image uses the brand typeface.
    void document.fonts?.ready.then(() => { if (canvasRef.current) { draw(canvasRef.current, current); setPreview(canvasRef.current.toDataURL("image/png")); } });
  }, [current]);

  if (!current) return null;

  const toBlob = () => new Promise<Blob | null>(resolve => canvasRef.current?.toBlob(resolve, "image/png") ?? resolve(null));

  async function share() {
    setNote("");
    const blob = await toBlob();
    const text = shareText(current, siteUrl);
    const file = blob ? new File([blob], "firepath-milestone.png", { type: "image/png" }) : null;
    try {
      if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch { return; /* user closed the share sheet */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  async function download() {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "firepath-milestone.png"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setNote("Saved! Post it to your WhatsApp status or Instagram story.");
  }

  return (
    <section className="side-card share-card">
      <div className="side-card-head"><h3><Share2 size={16} /> Share your progress</h3><button type="button" className="text-link" onClick={() => void share()}>Share →</button></div>
      <canvas ref={canvasRef} hidden />
      <div className="share-row">
        <button type="button" className="share-thumb" onClick={() => setExpanded(value => !value)} aria-label={expanded ? "Hide image preview" : "Show the full image"}>
          {preview ? <img src={preview} alt="" /> : <span className="placeholder" />}
        </button>
        <div className="share-text"><strong>{current.emoji} {current.headline}</strong><small>{current.sub}</small></div>
      </div>
      {expanded && preview && <img className="share-preview" src={preview} alt={`${current.headline}. ${current.sub}`} />}
      {milestones.length > 1 && <div className="qn-chips share-chips">{milestones.slice(0, 4).map((m, i) => <button key={m.id} type="button" className={i === index ? "selected" : ""} onClick={() => setIndex(i)}>{m.emoji} {CHIP_LABELS[m.id.split("-")[0]] ?? "Milestone"}</button>)}</div>}
      <p className="side-empty">{note || <>No amounts shown, only progress. <button type="button" className="share-save" onClick={() => void download()}><Download size={12} /> Save image</button></>}</p>
    </section>
  );
}
