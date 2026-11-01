"use client";
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { DemoState } from "./domain";
import { getSupabase, isSupabaseConfigured } from "./supabase-client";
import { envelopeSchema, requestUuid, type ProductionCommand, type ProductionEnvelope, type ProductionProfile } from "./production-contract";
const emptyState = (): DemoState => ({ version: 1, materials: [], models: [], orders: [], inspections: [], activity: [], dailyApprovals: [] });
interface Store {
  state: DemoState; ready: boolean; message: string; error: string; busy: boolean; canViewCosts: boolean; profile: ProductionProfile | null;
  execute: (command: ProductionCommand, successMessage: string) => Promise<boolean>;
  notify: (message: string) => void; refresh: () => Promise<void>;
}
const Context = createContext<Store | null>(null);
const bucket = "confeccao-images";
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(emptyState); const [ready, setReady] = useState(false);
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<ProductionProfile | null>(null); const [canViewCosts, setCanViewCosts] = useState(false);
  const epoch = useRef(0); const sessionUser = useRef<string | null>(null);
  const revision = useRef(0); const active = useRef(true); const saving = useRef(false); const pendingRefresh = useRef(false); const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retries = useRef(new Map<string, { id: string; command: ProductionCommand & { expectedRevision: number } }>());
  const imageCache = useRef(new Map<string, { url: string; expires: number }>());
  const uploaded = useRef(new Map<string, string>());
  const notify = useCallback((text: string) => { clearTimeout(timer.current); setMessage(text); if (text) timer.current = setTimeout(() => setMessage(""), 7000); }, []);
  const clear = useCallback(() => { epoch.current += 1; setReady(true); setState(emptyState()); setProfile(null); setCanViewCosts(false); revision.current = 0; retries.current.clear(); imageCache.current.clear(); uploaded.current.clear(); }, []);
  const hydrate = useCallback(async (envelope: ProductionEnvelope, expectedEpoch: number) => {
    const paths = [...new Set([...envelope.state.models, ...envelope.state.inspections].map(item => item.image).filter((v): v is string => !!v))];
    const missing = paths.filter(path => !imageCache.current.has(path) || imageCache.current.get(path)!.expires < Date.now());
    if (missing.length) {
      const { data, error: storageError } = await getSupabase().storage.from(bucket).createSignedUrls(missing, 3600);
      if (!storageError && active.current && epoch.current === expectedEpoch) for (const item of data ?? []) { if (item.path && item.signedUrl) imageCache.current.set(item.path, { url: item.signedUrl, expires: Date.now() + 50 * 60_000 }); }
    }
    const withImage = <T extends { image?: string }>(item: T): T => ({ ...item, image: item.image ? imageCache.current.get(item.image)?.url : undefined });
    return { ...envelope.state, models: envelope.state.models.map(withImage), inspections: envelope.state.inspections.map(withImage) };
  }, []);
  const accept = useCallback(async (data: unknown, expectedEpoch: number) => {
    if (!active.current || epoch.current !== expectedEpoch) return;
    const envelope = envelopeSchema.parse(data); const next = await hydrate(envelope, expectedEpoch);
    if (!active.current || epoch.current !== expectedEpoch || envelope.revision < revision.current) return;
    revision.current = envelope.revision; setState(next); setProfile(envelope.profile); setCanViewCosts(envelope.canViewCosts); setError("");
  }, [hydrate]);
  const refresh = useCallback(async (force = false) => {
    if (saving.current && !force) { pendingRefresh.current = true; return; }
    const expectedEpoch = epoch.current; const startedRevision = revision.current;
    if (!isSupabaseConfigured()) { clear(); setReady(true); setError("O banco da confecção ainda não foi conectado."); return; }
    try {
      const client = getSupabase(); const { data: auth, error: authError } = await client.auth.getUser();
      if (epoch.current !== expectedEpoch) return;
      if (authError) throw authError;
      if (!auth.user) { sessionUser.current = null; clear(); setReady(true); return; }
      if (saving.current && !force) { pendingRefresh.current = true; return; }
      const { data, error: rpcError } = await client.rpc("mf_get_state");
      if (saving.current && !force) { pendingRefresh.current = true; return; }
      if (rpcError) throw rpcError;
      await accept(data, expectedEpoch);
    } catch (cause) {
      if (epoch.current !== expectedEpoch || revision.current !== startedRevision) return;
      if (saving.current && !force) { pendingRefresh.current = true; return; }
      // A failed read does not prove an earlier write failed. Keep request IDs
      // until a definitive response or a real session change resolves them.
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados da confecção. Verifique seu acesso e tente novamente.");
    } finally { if (active.current && epoch.current === expectedEpoch) setReady(true); }
  }, [accept, clear]);
  useEffect(() => {
    active.current = true; let unsubscribe = () => {}; let scheduled: ReturnType<typeof setTimeout> | undefined;
    void refresh();
    if (isSupabaseConfigured()) {
      const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
        clearTimeout(scheduled);
        if (!session || event === "SIGNED_OUT") { sessionUser.current = null; clear(); }
        else {
          if (sessionUser.current !== session.user.id) { sessionUser.current = session.user.id; clear(); setReady(false); }
          scheduled = setTimeout(() => { void refresh(); }, 0);
        }
      }); unsubscribe = () => data.subscription.unsubscribe();
    }
    const focus = () => { if (!saving.current) void refresh(); };
    window.addEventListener("focus", focus);
    const interval = setInterval(() => { if (!saving.current && document.visibilityState === "visible") void refresh(); }, 45_000);
    return () => { active.current = false; clearTimeout(timer.current); clearTimeout(scheduled); clearInterval(interval); window.removeEventListener("focus", focus); unsubscribe(); };
  }, [clear, refresh]);
  async function prepare(command: ProductionCommand, expectedEpoch: number): Promise<ProductionCommand> {
    const image = command.payload.image;
    if (typeof image !== "string" || !image.startsWith("data:")) return command;
    const folder = command.type === "inspect_order" ? "inspections" : "models";
    const cacheKey = `${folder}:${image}`;
    let path = uploaded.current.get(cacheKey);
    if (!path) {
      if (!/^data:image\/(webp|png|jpeg);base64,/.test(image)) throw new Error("Formato de imagem inválido.");
      const [header, encoded] = image.split(","); const raw = atob(encoded); if (raw.length > 5 * 1024 * 1024) throw new Error("A imagem deve ter até 5 MB.");
      const contentType = header.slice(5, header.indexOf(";")); const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
      path = `${folder}/${requestUuid()}.${extension}`;
      const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
      const { error: uploadError } = await getSupabase().storage.from(bucket).upload(path, bytes, { contentType, upsert: false }); if (uploadError) throw uploadError;
      if (active.current && epoch.current === expectedEpoch) uploaded.current.set(cacheKey, path);
    }
    return { ...command, payload: { ...command.payload, image: path } };
  }
  const execute: Store["execute"] = async (command, successMessage) => {
    if (saving.current) { notify("Aguarde a operação atual terminar."); return false; }
    if (!profile) { notify("Entre com um acesso ativo antes de registrar alterações."); return false; }
    if (error) { notify("Carregue os dados da confecção novamente antes de registrar alterações."); return false; }
    saving.current = true; setBusy(true);
    const fingerprint = JSON.stringify(command); const expectedEpoch = epoch.current; let committed = false;
    try {
      let request = retries.current.get(fingerprint);
      if (!request) {
        const prepared = await prepare(command, expectedEpoch);
        if (!active.current || epoch.current !== expectedEpoch) return false;
        request = { id: requestUuid(), command: { ...prepared, expectedRevision: revision.current } }; retries.current.set(fingerprint, request);
      }
      if (!active.current || epoch.current !== expectedEpoch) return false;
      const { data, error: rpcError } = await getSupabase().rpc("mf_apply_command", { p_command: request.command, p_request_id: request.id });
      if (epoch.current !== expectedEpoch) return false;
      if (rpcError) {
        if (rpcError.code === "40001") {
          retries.current.delete(fingerprint);
          await refresh(true);
          throw new Error("Outra pessoa atualizou os dados. Confira os valores atualizados e tente novamente.");
        }
        throw rpcError;
      }
      committed = true; retries.current.delete(fingerprint); await accept(data, expectedEpoch); notify(successMessage); return true;
    } catch (cause) {
      if (epoch.current !== expectedEpoch) return false;
      const text = cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "Não foi possível registrar a operação.";
      if (committed) { await refresh(true); notify("A operação foi salva, mas a atualização da tela falhou. Confira os dados antes de repetir."); return true; }
      notify(text); return false;
    } finally {
      saving.current = false;
      if (active.current) {
        setBusy(false);
        if (pendingRefresh.current) { pendingRefresh.current = false; void refresh(); }
      }
    }
  };
  return <Context.Provider value={{ state, ready, message, error, busy, canViewCosts, profile, execute, notify, refresh }}>{children}<div className={`toast ${message ? "visible" : ""}`} role="status" aria-live="polite">{message}</div></Context.Provider>;
}
export function useDemo() { const value = useContext(Context); if (!value) throw new Error("ProductionProvider não encontrado"); return value; }
