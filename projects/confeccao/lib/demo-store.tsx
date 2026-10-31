"use client";
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { DemoState } from "./domain";
import { makeSeed } from "./seed";
import { z } from "zod";
const STORAGE_KEY = "modapink-confeccao-demo-v1";
const number = z.number().finite().nonnegative();
const schema = z.object({
  version: z.literal(1),
  materials: z.array(z.object({ id: z.string(), name: z.string(), category: z.enum(["Tecido", "Aviamento"]), color: z.string(), hex: z.string(), lot: z.string(), supplier: z.string(), quantity: number, reserved: number, minimum: number, unit: z.enum(["kg", "m", "un"]), price: number })),
  models: z.array(z.object({ id: z.string(), name: z.string(), reference: z.string(), materialId: z.string(), consumption: number, sizes: z.array(z.string()), notionsCost: number, sewingCost: number, finishingCost: number, notes: z.string(), image: z.string().optional() })),
  orders: z.array(z.object({ id: z.string(), modelId: z.string(), materialId: z.string(), quantity: number, variants: z.array(z.object({ size: z.string(), quantity: number })), stage: z.enum(["Planejado", "Corte", "Costura", "Acabamento", "Qualidade", "Concluído"]), due: z.string(), team: z.string(), priority: z.enum(["Normal", "Alta"]), reserved: number, actualConsumption: number.nullable(), materialPrice: number, approved: number, rework: number, lost: number, created: z.string() })),
  inspections: z.array(z.object({ id: z.string(), orderId: z.string(), quantity: number, result: z.enum(["Aprovadas", "Retrabalho", "Perda"]), reason: z.string(), notes: z.string(), image: z.string().optional(), date: z.string(), resolved: z.boolean() })),
  activity: z.array(z.object({ id: z.string(), title: z.string(), detail: z.string(), date: z.string() })),
});
interface Store { state: DemoState; ready: boolean; message: string; run: (fn: (state: DemoState) => DemoState, message: string) => boolean; notify: (message: string) => void; reset: () => void; }
const Context = createContext<Store | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(makeSeed);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const current = useRef(state);
  const notify = useCallback((message: string) => { clearTimeout(timer.current); setToast(message); if (message) timer.current = setTimeout(() => setToast(""), 7000); }, []);
  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const parsed = schema.safeParse(JSON.parse(raw)); if (parsed.success) { current.current = parsed.data; setState(parsed.data); } else notify("Os dados locais foram reiniciados para manter a demonstração consistente."); } }
    catch { notify("O armazenamento deste navegador não está disponível. Você ainda pode explorar o painel."); }
    setReady(true);
    return () => clearTimeout(timer.current);
  }, []);
  const run: Store["run"] = (fn, message) => {
    try {
      const next = fn(current.current);
      current.current = next; setState(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); notify(message); }
      catch { notify(`${message} A alteração ficará somente nesta sessão: armazenamento local indisponível ou cheio.`); }
      return true;
    } catch (e) { notify(e instanceof Error ? e.message : "Não foi possível registrar a alteração."); return false; }
  };
  const reset = () => { const next = makeSeed(); current.current = next; setState(next); try { localStorage.removeItem(STORAGE_KEY); } catch {} notify("Demonstração restaurada para os dados iniciais."); };
  return <Context.Provider value={{ state, ready, message: toast, run, notify, reset }}>{children}<div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">{toast}</div></Context.Provider>;
}
export function useDemo() { const value = useContext(Context); if (!value) throw new Error("DemoProvider não encontrado"); return value; }
