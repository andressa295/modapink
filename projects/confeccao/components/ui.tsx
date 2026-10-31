"use client";
import { useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { X, Upload, Shirt, ArrowUpRight, Search } from "lucide-react";
import { useDemo } from "../lib/demo-store";
import type { Model, Stage } from "../lib/domain";
export function Status({ stage }: { stage: Stage | string }) { const key = stage === "Concluído" || stage === "Aprovadas" || stage === "Resolvido" ? "green" : stage === "Qualidade" || stage === "Retrabalho" ? "amber" : stage === "Perda" ? "red" : stage === "Costura" ? "purple" : stage === "Acabamento" ? "blue" : stage === "Corte" ? "pink" : "gray"; return <span className={`badge ${key}`}><i />{stage}</span>; }
export function Modal({ title, subtitle, children, onClose, drawer = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null); const id = useId(); const { message, notify } = useDemo();
  useEffect(() => { const dialog = ref.current; notify(""); if (dialog && !dialog.open) dialog.showModal(); return () => { if (dialog?.open) dialog.close(); }; }, [notify]);
  return <dialog ref={ref} aria-labelledby={id} className={drawer ? "modal drawer" : "modal"} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) { const bounds = ref.current.getBoundingClientRect(); if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) onClose(); } }}><div className="modal-header"><div><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="icon-button" aria-label="Fechar janela" onClick={onClose}><X size={19} /></button></div><div className="modal-body">{children}</div>{message && <div className="modal-feedback" role="status">{message}</div>}</dialog>;
}
export function Empty({ title = "Nenhum resultado encontrado", text = "Experimente outro termo ou ajuste os filtros.", action }: { title?: string; text?: string; action?: ReactNode }) { return <div className="empty"><span><Search size={25} /></span><h3>{title}</h3><p>{text}</p>{action}</div>; }
export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) { return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="heading-actions">{children}</div></div>; }
export function Garment({ color = "#de7eaa", large = false, image, name = "Modelo de body" }: { color?: string; large?: boolean; image?: string; name?: string }) { return <div className={`garment ${large ? "large" : ""}`} style={{ "--garment": color } as CSSProperties}>{image ? <img src={image} alt={name} /> : <svg viewBox="0 0 130 150" fill="none" aria-hidden="true"><path d="M38 13 50 10Q51 37 65 37T80 10L92 13 96 55Q89 75 94 94 92 118 75 133L75 140H55V133Q38 118 36 94 41 75 34 55Z" fill="currentColor" opacity=".92"/><path d="M43 17Q44 47 65 47T87 17M37 89Q65 99 93 89M52 130Q65 116 78 130" stroke="white" strokeOpacity=".35" strokeWidth="1.5"/><path d="M37 55 40 79M93 55 90 79" stroke="black" strokeOpacity=".08" strokeWidth="2"/></svg>}</div>; }
export function ModelThumb({ model, color }: { model: Model; color?: string }) { return <Garment color={color} image={model.image} name={model.name} />; }
export function ImageField({ value, onChange, label = "Adicionar imagem" }: { value?: string; onChange: (image: string | undefined) => void; label?: string }) {
  const { notify } = useDemo(); const [busy, setBusy] = useState(false); const id = useId();
  async function read(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { notify("Escolha uma imagem JPG, PNG ou WebP de até 5 MB."); return; }
    setBusy(true);
    let url = "";
    try { url = URL.createObjectURL(file); const img = new Image(); img.src = url; await img.decode(); const scale = Math.min(1, 900 / Math.max(img.width, img.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale); canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height); onChange(canvas.toDataURL("image/webp", .75)); }
    catch { notify("Não foi possível abrir essa imagem. Tente outro arquivo."); }
    finally { if (url) URL.revokeObjectURL(url); setBusy(false); }
  }
  return <div className="image-field">{value ? <div className="image-preview"><img src={value} alt="Prévia da imagem selecionada" /><button type="button" className="icon-button" aria-label="Remover imagem" onClick={() => onChange(undefined)}><X size={15} /></button></div> : <label htmlFor={id} className="upload"><Upload size={22} /><strong>{busy ? "Preparando imagem…" : label}</strong><span>JPG, PNG ou WebP · até 5 MB</span></label>}<input id={id} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={e => { read(e.target.files?.[0]); e.target.value = ""; }} /><small>Prévia local. O armazenamento de imagens será conectado na próxima etapa.</small></div>;
}
export function PanelTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) { return <div className="panel-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }
export function Metric({ label, value, note, icon, tone = "pink", tag }: { label: string; value: ReactNode; note: string; icon: ReactNode; tone?: string; tag?: string }) { return <article className="metric"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><div className="metric-value">{value}</div><div className="metric-bottom">{tag && <span className={`metric-tag ${tone}`}>{tag}</span>}<span>{note}</span></div></article>; }
export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replaceAll('"', '""')}"`; };
  const csv = "\uFEFF" + [headers, ...rows].map(row => row.map(escape).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
