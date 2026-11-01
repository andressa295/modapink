"use client";
import { useRef, useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { removeRecord, type RemovableEntity } from "../lib/record-removal";
import { Modal } from "./ui";
import "./record-removal.css";

export function RecordRemovalDialog({ entity, id, name, description, onClose, onRemoved }: {
  entity: RemovableEntity; id: string; name: string; description?: string; onClose: () => void; onRemoved: () => void | Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  async function confirm() {
    if (saving.current) return;
    saving.current = true; setRemoving(true); setError("");
    try { await removeRecord(entity, id); await onRemoved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir agora. Tente novamente."); }
    finally { saving.current = false; setRemoving(false); }
  }
  return <Modal title="Excluir cadastro" subtitle="Confira o registro antes de confirmar." onClose={() => { if (!saving.current) onClose(); }}>
    <div className="record-removal-content"><span className="record-removal-icon"><Trash2 size={22} /></span><p>Você vai excluir <strong>{name}</strong>.</p><p>{description ?? "O cadastro deixará de aparecer nas listas. O histórico da produção será preservado."}</p></div>
    {error && <div className="record-removal-error" role="alert"><TriangleAlert size={17} /><p>{error}</p></div>}
    <div className="form-footer"><button type="button" className="button secondary" onClick={onClose} disabled={removing}>Cancelar</button><button type="button" className="button record-remove-confirm" onClick={() => void confirm()} disabled={removing}><Trash2 size={15} />{removing ? "Excluindo…" : "Excluir cadastro"}</button></div>
  </Modal>;
}
