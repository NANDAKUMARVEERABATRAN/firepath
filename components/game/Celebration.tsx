"use client";

import { useEffect } from "react";

const COLORS = ["#55d6a6", "#159b72", "#ffc94d", "#ff8a5b", "#6ea8ff", "#c58cff"];

/** Lightweight confetti overlay. Respects reduced-motion via CSS. */
export default function Celebration({ title, detail, onClose }: { title: string; detail: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  return (
    <div className="celebration" role="dialog" aria-live="assertive" aria-label={title} onClick={onClose}>
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 60 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, background: COLORS[i % COLORS.length], animationDelay: `${(i % 12) * 0.08}s`, animationDuration: `${2.2 + (i % 5) * 0.35}s` }} />
        ))}
      </div>
      <div className="celebration-card" onClick={event => event.stopPropagation()}>
        <span className="celebration-emoji">🏆</span>
        <h2>{title}</h2>
        <p>{detail}</p>
        <button className="button button-primary" type="button" onClick={onClose}>Keep going</button>
      </div>
    </div>
  );
}
