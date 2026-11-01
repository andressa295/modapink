"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Info } from "lucide-react";
import "./material-help.css";

/** Short field guidance, available to pointer, keyboard and touch users. */
export function FieldHelp({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const container = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; arrow: number; placement: "above" | "below" } | null>(null);
  const open = hovered || focused || pinned;

  function close() {
    clearTimeout(hoverTimer.current);
    setHovered(false); setFocused(false); setPinned(false); setPosition(null);
  }

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  useLayoutEffect(() => {
    if (!open || !trigger.current || !tooltip.current) return;
    const node = tooltip.current;
    // A native popover escapes clipping and stays above a parent <dialog>.
    try { if (typeof node.showPopover === "function") node.showPopover(); } catch { /* Fixed positioning remains the fallback. */ }
    let frame = 0;
    function update() {
      if (!trigger.current || !tooltip.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const box = tooltip.current.getBoundingClientRect();
      const margin = 12; const gap = 8;
      const width = document.documentElement.clientWidth || window.innerWidth;
      const height = window.innerHeight;
      const center = anchor.left + anchor.width / 2;
      const left = Math.max(margin, Math.min(center - box.width / 2, width - box.width - margin));
      const above = anchor.top - box.height - gap;
      const placement = above >= margin ? "above" : "below";
      const top = placement === "above" ? above : Math.min(anchor.bottom + gap, Math.max(margin, height - box.height - margin));
      setPosition({ left, top: Math.max(margin, top), arrow: Math.max(10, Math.min(center - left, box.width - 10)), placement });
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }
    update();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(node);
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      try { if (typeof node.hidePopover === "function") node.hidePopover(); } catch { /* Already closed or removed. */ }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function pointer(event: PointerEvent) { if (event.target instanceof Node && !container.current?.contains(event.target)) close(); }
    function key(event: KeyboardEvent) { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", pointer, true); document.removeEventListener("keydown", key, true); };
  }, [open]);

  return <span ref={container} className="field-help" onPointerEnter={event => { clearTimeout(hoverTimer.current); if (event.pointerType !== "touch") setHovered(true); }} onPointerLeave={() => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setHovered(false), 140); }}>
    <button ref={trigger} type="button" className="field-help-button" aria-label={`Ajuda sobre ${label}`} aria-expanded={open} aria-describedby={open ? id : undefined} aria-controls={open ? id : undefined} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setPinned(false); }} onClick={event => { event.stopPropagation(); if (pinned) close(); else setPinned(true); }}>
      <Info size={12} strokeWidth={1.8} aria-hidden="true" />
    </button>
    {open && <span ref={tooltip} id={id} role="tooltip" popover="manual" className="field-help-tooltip" data-placement={position?.placement ?? "above"} style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden", "--field-help-arrow-x": `${position?.arrow ?? 16}px` } as CSSProperties}>{children}</span>}
  </span>;
}
