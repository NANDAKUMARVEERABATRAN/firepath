// FIREpath video maker: renders each spec in videos.mjs to a 1080x1920 MP4 (plus a short "-ad" cut).
// Usage:  npm run render            → all videos
//         npm run render -- 01      → videos whose id contains "01"
//         npm run still             → one PNG per scene (quick review) in out/stills
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { videos, inr } from "./videos.mjs";

const W = 1080, H = 1920, FPS = 30;
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "out");
const C = { bg1: "#0b1b2e", bg2: "#14304d", text: "#ffffff", muted: "#9fb3c8", green: "#2fd39a", greenDark: "#159b72", yellow: "#ffc94d", track: "#ffffff1f" };
const FONT = "Segoe UI, Arial, sans-serif";

/* ---------- helpers ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** progress of an animation that starts at `start` seconds and lasts `len` */
const anim = (t, start, len = 0.45) => easeOut((t - start) / len);

/** Splits "*highlight* text\nnext line" into lines of {text, hl} runs, wrapping at maxChars. */
function layout(text, size, maxWidth = 940) {
  const maxChars = Math.max(8, Math.floor(maxWidth / (size * 0.5)));
  const lines = [];
  for (const raw of String(text).split("\n")) {
    let hl = false, line = [], length = 0;
    for (const word of raw.split(" ")) {
      const runs = [];
      for (const [i, part] of word.split("*").entries()) { if (i > 0) hl = !hl; if (part) runs.push({ text: part, hl }); }
      const wlen = word.replace(/\*/g, "").length;
      if (length && length + 1 + wlen > maxChars) { lines.push(line); line = []; length = 0; }
      if (length) line.push({ text: " ", hl });
      line.push(...runs); length += (length ? 1 : 0) + wlen;
    }
    lines.push(line);
  }
  return lines;
}

/** Lines that slide up and fade in one after another. Returns svg + the y after the block. */
function textBlock(text, { t, start = 0.1, y, size = 80, weight = 800, color = C.text, gap = 1.22, stagger = 0.28, anchor = "middle" }) {
  const lines = layout(text, size);
  const x = anchor === "middle" ? W / 2 : 90;
  const svg = lines.map((runs, i) => {
    const p = anim(t, start + i * stagger);
    const ly = y + i * size * gap + (1 - p) * 40;
    const spans = runs.map(r => `<tspan fill="${r.hl ? C.yellow : color}">${esc(r.text)}</tspan>`).join("");
    return `<text xml:space="preserve" x="${x}" y="${ly}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" opacity="${p}">${spans}</text>`;
  }).join("");
  return { svg, end: y + lines.length * size * gap };
}

const logo = (x, y, s) => `<g transform="translate(${x} ${y})"><rect width="${s}" height="${s}" rx="${s * 0.24}" fill="${C.greenDark}"/><g transform="translate(${s * 0.17} ${s * 0.17}) scale(${s / 36})" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></g></g>`;
const brand = (x, y, s = 46) => `${logo(x, y, s)}<text x="${x + s + 16}" y="${y + s * 0.74}" font-family="${FONT}" font-size="${s * 0.78}" font-weight="800" fill="#fff">FIRE<tspan fill="${C.green}">path</tspan></text>`;

/* ---------- scenes ---------- */
const scenes = {
  hook(s, t) {
    const lines = layout(s.text, 92).length;
    return textBlock(s.text, { t, y: 960 - (lines * 92 * 1.22) / 2 + 70, size: 92, stagger: 0.3 }).svg;
  },
  text(s, t) {
    const lines = layout(s.text, 78).length + (s.big ? 2 : 0);
    let y = 960 - (lines * 78 * 1.25) / 2 + 60;
    let svg = "";
    if (s.eyebrow) { svg += `<text x="${W / 2}" y="${y - 90}" font-family="${FONT}" font-size="34" font-weight="700" letter-spacing="6" fill="${C.green}" text-anchor="middle" opacity="${anim(t, 0)}">${esc(s.eyebrow)}</text>`; }
    const block = textBlock(s.text, { t, y, size: 78, gap: 1.25, start: 0.15 });
    svg += block.svg;
    if (s.big) { const p = anim(t, 1.4, 0.5); svg += `<text x="${W / 2}" y="${block.end + 170}" font-family="${FONT}" font-size="${220 * (0.7 + 0.3 * p)}" font-weight="900" fill="${C.yellow}" text-anchor="middle" opacity="${p}">${esc(s.big)}</text>`; }
    return svg;
  },
  compare(s, t) {
    const max = Math.max(...s.items.map(i => i.value));
    const base = 1220, maxH = 500, bw = 260, gap = 120;
    const x0 = W / 2 - (s.items.length * bw + (s.items.length - 1) * gap) / 2;
    let svg = `<text x="${W / 2}" y="540" font-family="${FONT}" font-size="58" font-weight="800" fill="#fff" text-anchor="middle" opacity="${anim(t, 0)}">${esc(s.title)}</text>`;
    s.items.forEach((item, i) => {
      const p = anim(t, 0.6 + i * 0.5, 2.2);
      const h = Math.max(6, (item.value / max) * maxH * p);
      const x = x0 + i * (bw + gap);
      const fill = i === 0 ? C.green : "#6f87a3";
      svg += `<rect x="${x}" y="${base - h}" width="${bw}" height="${h}" rx="18" fill="${fill}"/>`;
      svg += `<text x="${x + bw / 2}" y="${base - h - 30}" font-family="${FONT}" font-size="60" font-weight="900" fill="${i === 0 ? C.yellow : "#fff"}" text-anchor="middle" opacity="${clamp(p * 3)}">${esc(inr(item.value * p))}</text>`;
      svg += `<text x="${x + bw / 2}" y="${base + 64}" font-family="${FONT}" font-size="48" font-weight="800" fill="#fff" text-anchor="middle">${esc(item.label)}</text>`;
      svg += `<text x="${x + bw / 2}" y="${base + 112}" font-family="${FONT}" font-size="32" fill="${C.muted}" text-anchor="middle">${esc(item.sub)}</text>`;
    });
    if (s.note) svg += textBlock(s.note, { t, start: 3.4, y: 1420, size: 46, weight: 700 }).svg;
    return svg;
  },
  bars(s, t) {
    const max = Math.max(...s.rows.map(r => r.value ?? 0));
    let svg = `<text x="${W / 2}" y="500" font-family="${FONT}" font-size="56" font-weight="800" fill="#fff" text-anchor="middle" opacity="${anim(t, 0)}">${esc(s.title)}</text>`;
    const top = 620, rowH = 170, left = 90, labelW = 230, barMax = W - left * 2 - labelW - 170;
    s.rows.forEach((row, i) => {
      const start = 0.5 + i * 0.9, p = anim(t, start, 1.1), appear = anim(t, start, 0.35);
      const y = top + i * rowH;
      const w = Math.max(8, ((row.value ?? max) / max) * barMax * p);
      const color = row.highlight ? C.yellow : C.green;
      svg += `<g opacity="${appear}">`;
      svg += `<text x="${left}" y="${y + 58}" font-family="${FONT}" font-size="46" font-weight="800" fill="#fff">${esc(row.label)}</text>`;
      svg += `<rect x="${left + labelW}" y="${y + 18}" width="${barMax}" height="54" rx="10" fill="${C.track}"/>`;
      svg += `<rect x="${left + labelW}" y="${y + 18}" width="${w}" height="54" rx="10" fill="${color}"/>`;
      svg += `<text x="${W - left}" y="${y + 60}" font-family="${FONT}" font-size="48" font-weight="900" fill="${row.highlight ? C.yellow : "#fff"}" text-anchor="end">${esc(row.display)}</text>`;
      svg += `</g>`;
    });
    return svg;
  },
  list(s, t) {
    let svg = s.eyebrow ? `<text x="${W / 2}" y="640" font-family="${FONT}" font-size="40" font-weight="800" letter-spacing="8" fill="${C.green}" text-anchor="middle" opacity="${anim(t, 0)}">${esc(s.eyebrow)}</text>` : "";
    s.items.forEach((item, i) => {
      const start = 0.6 + i * 1.3, p = anim(t, start, 0.5);
      const y = 800 + i * 200;
      svg += `<g opacity="${p}" transform="translate(${(1 - p) * 60} 0)">`;
      svg += `<rect x="90" y="${y}" width="${W - 180}" height="150" rx="28" fill="#ffffff14" stroke="${i === 1 ? C.green : "#ffffff22"}" stroke-width="3"/>`;
      svg += `<circle cx="170" cy="${y + 75}" r="34" fill="${i === 1 ? C.green : "#ffffff26"}"/><text x="170" y="${y + 88}" font-family="${FONT}" font-size="36" font-weight="900" fill="#fff" text-anchor="middle">${i + 1}</text>`;
      svg += textBlock(item, { t: 99, y: y + 92, size: 50, weight: 700, anchor: "start" }).svg.replace(/x="90"/g, 'x="235"');
      svg += `</g>`;
    });
    return svg;
  },
  big(s, t) {
    const pre = textBlock(s.pre, { t, y: 680, size: 62, weight: 700, color: C.muted });
    const p = anim(t, 1.1, 2.2);
    let svg = pre.svg;
    svg += `<text x="${W / 2}" y="${pre.end + 220}" font-family="${FONT}" font-size="150" font-weight="900" fill="${C.yellow}" text-anchor="middle" opacity="${clamp(p * 4)}">${esc(inr(s.value * p))}</text>`;
    svg += textBlock(s.post, { t, start: 2.8, y: pre.end + 340, size: 46, weight: 600 }).svg;
    return svg;
  },
  cta(s, t) {
    const p = anim(t, 0, 0.6);
    let svg = `<g opacity="${p}" transform="translate(${W / 2 - 80} ${560 + (1 - p) * 40})">${logo(0, 0, 160)}</g>`;
    svg += textBlock(s.headline, { t, start: 0.3, y: 900, size: 96 }).svg;
    svg += textBlock(s.sub, { t, start: 0.9, y: 1150, size: 48, weight: 600, color: C.muted }).svg;
    const q = anim(t, 1.3, 0.5), pulse = 1 + 0.03 * Math.sin(t * 5) * q;
    svg += `<g opacity="${q}" transform="translate(${W / 2} 1300) scale(${pulse})"><rect x="-330" y="-62" width="660" height="124" rx="62" fill="${C.green}"/><text x="0" y="18" font-family="${FONT}" font-size="50" font-weight="900" fill="#06281c" text-anchor="middle">FIREpath · link in bio</text></g>`;
    return svg;
  },
};

/* ---------- frame ---------- */
function frameSvg(video, sceneList, time) {
  const total = sceneList.reduce((sum, s) => sum + s.dur, 0);
  let acc = 0, scene = sceneList[0], local = 0;
  for (const s of sceneList) { if (time < acc + s.dur) { scene = s; local = time - acc; break; } acc += s.dur; scene = s; local = s.dur; }
  const fadeOut = scene === sceneList.at(-1) ? 1 : clamp((scene.dur - local) / 0.25);
  const body = scenes[scene.type](scene, local);
  const credit = scene.type === "cta" ? "" : `<text x="${W / 2}" y="388" font-family="${FONT}" font-size="30" fill="${C.muted}" text-anchor="middle">Idea from “${esc(video.book)}”</text>`;
  const disclaimer = scene.disclaimer ? `<text x="${W / 2}" y="1500" font-family="${FONT}" font-size="28" fill="${C.muted}" text-anchor="middle">${esc(scene.disclaimer)}</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg2}"/></linearGradient>
<radialGradient id="glow" cx="0.85" cy="0.2" r="0.6"><stop offset="0" stop-color="${C.green}" stop-opacity="0.18"/><stop offset="1" stop-color="${C.green}" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#glow)"/>
<rect x="0" y="0" width="${W * (time / total)}" height="10" fill="${C.green}"/>
${scene.type === "cta" ? "" : brand(W / 2 - 120, 280)}
${credit}
<g opacity="${fadeOut}">${body}</g>
${disclaimer}
</svg>`;
}

/* ---------- output ---------- */
async function renderVideo(video, sceneList, file) {
  const total = sceneList.reduce((sum, s) => sum + s.dur, 0);
  const frames = Math.round(total * FPS);
  const ff = spawn(ffmpegPath, ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", file], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolve, reject) => { ff.on("close", code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))); });
  for (let f = 0; f < frames; f += 1) {
    const buf = await sharp(Buffer.from(frameSvg(video, sceneList, f / FPS))).removeAlpha().raw().toBuffer();
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (f % 150 === 0) process.stdout.write(`\r  ${path.basename(file)} ${Math.round((f / frames) * 100)}%   `);
  }
  ff.stdin.end();
  await done;
  process.stdout.write(`\r  ${path.basename(file)} done (${total.toFixed(1)}s)        \n`);
}

const args = process.argv.slice(2);
const stillMode = args.includes("--still");
const filter = args.find(a => !a.startsWith("--"));
const selected = videos.filter(v => !filter || v.id.includes(filter));
mkdirSync(path.join(OUT, "stills"), { recursive: true });

for (const video of selected) {
  console.log(`▶ ${video.id}`);
  if (stillMode) {
    let acc = 0;
    for (const [i, s] of video.scenes.entries()) {
      await sharp(Buffer.from(frameSvg(video, video.scenes, acc + s.dur * 0.8))).png().toFile(path.join(OUT, "stills", `${video.id}-${i + 1}-${s.type}.png`));
      acc += s.dur;
    }
    continue;
  }
  await renderVideo(video, video.scenes, path.join(OUT, `${video.id}.mp4`));
  const adScenes = video.scenes.filter(s => s.ad).map(s => ({ ...s, dur: s.type === "cta" ? s.dur : Math.max(3, s.dur * 0.75) }));
  if (adScenes.length >= 2) await renderVideo(video, adScenes, path.join(OUT, `${video.id}-ad.mp4`));
}
console.log(`Saved to ${OUT}`);
