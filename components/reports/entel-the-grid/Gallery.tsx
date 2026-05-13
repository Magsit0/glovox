"use client";

import { useCallback, useEffect, useState } from "react";
import type { GaleriaItem } from "@/lib/reports/entel-the-grid/types";

export default function Gallery({ items }: { items: GaleriaItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const close = useCallback(() => setOpenIdx(null), []);
  const next = useCallback(() => {
    setOpenIdx((i) => (i === null ? null : (i + 1) % items.length));
  }, [items.length]);
  const prev = useCallback(() => {
    setOpenIdx((i) => (i === null ? null : (i - 1 + items.length) % items.length));
  }, [items.length]);

  useEffect(() => {
    if (openIdx === null) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIdx, close, next, prev]);

  return (
    <>
      <div className="er-gallery">
        {items.map((g, i) => (
          <div
            key={g.src}
            className={`er-g-item${g.span === "tall" ? " er-g-tall" : ""}${g.span === "wide" ? " er-g-wide" : ""}`}
            onClick={() => setOpenIdx(i)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setOpenIdx(i);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.src} alt={g.caption} loading="lazy" />
            <div className="er-g-overlay">
              <span>{g.caption}</span>
            </div>
          </div>
        ))}
      </div>

      {openIdx !== null && (
        <div
          className="er-lightbox"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <button className="er-lb-close" onClick={close} aria-label="Cerrar">
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={items[openIdx].src} alt={items[openIdx].caption} />
          <div className="er-lb-nav">
            <button className="er-lb-btn" onClick={prev}>
              ← Anterior
            </button>
            <button className="er-lb-btn" onClick={next}>
              Siguiente →
            </button>
          </div>
          <div className="er-lb-counter">
            {openIdx + 1} / {items.length} — {items[openIdx].caption}
          </div>
        </div>
      )}
    </>
  );
}
