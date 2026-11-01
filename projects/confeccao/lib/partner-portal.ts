import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, getSupabasePublicConfiguration } from "./supabase-client";
import { requestUuid } from "./production-contract";
import { createdPortalLinkSchema, isPortalPartnerPath, ownerPortalStateSchema, parseGuestPortalState, portalPhotoPathSchema, portalSubmissionResultSchema, portalTokenFromFragment, PortalAccessError, validatePortalSubmission, type CreatedPortalLink, type GuestPortalState, type OwnerPortalState, type PortalSubmissionInput } from "./partner-portal-contract";
export * from "./partner-portal-contract";
const bucket = "confeccao-images";
function fail(cause: unknown): PortalAccessError {
  if (cause instanceof PortalAccessError) return cause;
  const failure = cause && typeof cause === "object" ? cause as { code?: string; status?: number; statusCode?: number | string } : {};
  if (["42501", "PGRST301", "PGRST302", "PGRST303"].includes(failure.code ?? "") || [401, 403].includes(Number(failure.status ?? failure.statusCode))) return new PortalAccessError("denied", "Este acesso foi encerrado ou expirou. Peça um novo link à Moda Pink.");
  if (["22023", "23503", "23505", "23514", "P0001"].includes(failure.code ?? "")) return new PortalAccessError("validation", "Não foi possível salvar esses dados. Confira as quantidades, a descrição dos defeitos e as fotos.");
  return new PortalAccessError("network", "Não foi possível conectar agora. Confira sua conexão e tente novamente.");
}
function parseOwner(data: unknown) { const result = ownerPortalStateSchema.safeParse(data); if (!result.success) throw new PortalAccessError("network", "A resposta da confecção está incompleta. Atualize a página."); return result.data; }
export async function getOwnerPortalState(): Promise<OwnerPortalState> { const { data, error } = await getSupabase().rpc("mf_portal_owner_state"); if (error) throw fail(error); return parseOwner(data); }
async function manage(type: string, payload: Record<string, unknown>): Promise<OwnerPortalState> {
  const { data, error } = await getSupabase().rpc("mf_portal_manage", { p_command: { type, payload } });
  if (error) { const failure = fail(error); if (failure.kind === "validation") throw new PortalAccessError("validation", "Não foi possível salvar. Confira os dados: o nome deve ser único e a ordem precisa estar disponível para atribuição."); throw failure; }
  return parseOwner(data);
}
export function createPortalPartner(input: { id?: string; name: string; contact?: string; active?: boolean }) { return manage("save_partner", { ...input, name: input.name.trim(), contact: input.contact?.trim() ?? "", active: input.active ?? true }); }
export async function assignPortalOrder(input: { partnerId: string | null; orderId: string }) {
  const current = await getOwnerPortalState(); const order = current.orders.find(o => o.id === input.orderId || o.code === input.orderId);
  if (!order) throw new PortalAccessError("validation", "Selecione uma ordem de produção válida.");
  return manage("assign_order", { ...input, orderId: order.id });
}
export async function createPortalLink(partnerId: string): Promise<OwnerPortalState & { createdLink: CreatedPortalLink }> { const result = await manage("create_link", { partnerId }); const link = createdPortalLinkSchema.safeParse(result.createdLink); if (!link.success) throw new PortalAccessError("network", "O link não foi retornado. Confira a situação do acesso antes de gerar outro."); return { ...result, createdLink: link.data }; }
export function revokePortalLink(partnerId: string) { return manage("revoke_link", { partnerId }); }
export async function getOwnerPortalPhotoUrl(path: string): Promise<string> { portalPhotoPathSchema.parse(path); const { data, error } = await getSupabase().storage.from(bucket).createSignedUrl(path, 60); if (error || !data.signedUrl) throw fail(error); return data.signedUrl; }

export interface GuestPortalConnection {
  load: () => Promise<GuestPortalState>;
  submit: (input: PortalSubmissionInput, requestId: string) => Promise<ReturnType<typeof portalSubmissionResultSchema.parse>>;
  upload: (blob: Blob) => Promise<string>;
  removeDraft: (path: string) => Promise<void>;
  photoUrls: (paths: string[]) => Promise<Record<string, string>>;
  clearPhotos: () => void;
  dispose: () => void;
}
export function createGuestPortalConnection(accessToken: string): GuestPortalConnection {
  const token = portalTokenFromFragment(`#acesso=${accessToken}`);
  const config = getSupabasePublicConfiguration();
  if (!config.url || !config.publishableKey.startsWith("sb_publishable_")) throw new PortalAccessError("configuration", "Este acesso ainda não está disponível. Fale com a Moda Pink.");
  const abort = new AbortController(); let disposed = false; let snapshot: GuestPortalState | null = null;
  const photos = new Map<string, { url: string; until: number }>(); const flights = new Map<string, Promise<string>>(); let photoEpoch = 0;
  const reservations = new WeakMap<Blob, { path: string; until: number }>(); const draftPaths = new Set<string>(); let allowedPaths = new Set<string>();
  const guest: SupabaseClient = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `confeccao-portal-${requestUuid()}` }, global: { headers: { "x-confeccao-portal": token }, fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: abort.signal }) } });
  function ensure() { if (disposed) throw new PortalAccessError("denied", "Este acesso foi encerrado. Abra novamente o link recebido."); }
  function clearPhotos() { photoEpoch += 1; for (const photo of photos.values()) URL.revokeObjectURL(photo.url); photos.clear(); flights.clear(); }
  async function load() {
    ensure();
    try { const { data, error } = await guest.rpc("mf_portal_get", { p_token: token }); if (error) throw error;
      const parsed = parseGuestPortalState(data);
      ensure(); snapshot = parsed; allowedPaths = new Set([...snapshot.orders.map(order => order.model.image).filter((path): path is string => !!path), ...snapshot.updates.flatMap(update => update.photos), ...snapshot.latestUpdates.flatMap(update => update.photos)]);
      for (const [path, photo] of photos) if (!allowedPaths.has(path)) { URL.revokeObjectURL(photo.url); photos.delete(path); }
      return snapshot;
    } catch (cause) { clearPhotos(); snapshot = null; allowedPaths.clear(); throw fail(cause); }
  }
  async function submit(input: PortalSubmissionInput, requestId: string) {
    ensure(); const order = snapshot?.orders.find(item => item.id === input.orderId); if (!order || !snapshot) throw new PortalAccessError("denied", "Esta ordem não está disponível neste acesso.");
    const update = validatePortalSubmission(input, order);
    if (update.photos.some(path => !isPortalPartnerPath(path, snapshot!.partner.id))) throw new PortalAccessError("validation", "Uma das fotos não pertence a este acesso.");
    try { const { data, error } = await guest.rpc("mf_portal_submit", { p_token: token, p_request_id: requestId, p_update: update }); if (error) throw error; const result = portalSubmissionResultSchema.safeParse(data); if (!result.success || result.data.requestId !== requestId || result.data.update.partnerId !== snapshot.partner.id || result.data.update.orderId !== order.id) throw new PortalAccessError("network", "O envio não pôde ser confirmado. Tente novamente com os mesmos dados.");
      ensure(); for (const path of update.photos) { draftPaths.delete(path); allowedPaths.add(path); } return result.data;
    } catch (cause) { const error = fail(cause); if (error.kind === "denied") { clearPhotos(); snapshot = null; allowedPaths.clear(); } throw error; }
  }
  async function upload(blob: Blob) {
    ensure(); if (!snapshot) throw new PortalAccessError("denied", "Atualize as suas ordens antes de enviar uma foto.");
    if (!["image/webp", "image/jpeg", "image/png"].includes(blob.type) || blob.size > 5 * 1024 * 1024 || blob.size === 0) throw new PortalAccessError("validation", "Escolha uma foto JPG, PNG ou WebP de até 5 MB.");
    const extension = blob.type === "image/jpeg" ? "jpg" : blob.type.slice(6);
    try {
      let reservation = reservations.get(blob);
      if (!reservation || reservation.until < Date.now()) {
        const { data, error } = await guest.rpc("mf_portal_prepare_upload", { p_token: token, p_extension: extension }); if (error) throw error;
        const path = data?.path; if (typeof path !== "string" || !isPortalPartnerPath(path, snapshot.partner.id)) throw new PortalAccessError("denied", "Não foi possível preparar o envio desta foto.");
        reservation = { path, until: Date.now() + 9 * 60_000 }; reservations.set(blob, reservation);
      }
      const { error: storageError } = await guest.storage.from(bucket).upload(reservation.path, blob, { contentType: blob.type, upsert: false });
      // A retry after a lost upload response can encounter the same reserved object.
      if (storageError && !["409", "Duplicate"].includes(String(storageError.statusCode ?? (storageError as { error?: string }).error))) throw storageError;
      ensure(); draftPaths.add(reservation.path); return reservation.path;
    } catch (cause) { throw fail(cause); }
  }

  async function removeDraft(path: string) {
    ensure(); if (!snapshot || !draftPaths.has(path) || !isPortalPartnerPath(path, snapshot.partner.id)) return;
    const { error } = await guest.rpc("mf_portal_release_upload", { p_token: token, p_path: path }); if (error) throw fail(error);
    const { error: removeError } = await guest.storage.from(bucket).remove([path]); if (removeError) throw fail(removeError); draftPaths.delete(path);
  }
  async function photoUrls(paths: string[]) {
    ensure(); const requested = [...new Set(paths)]; const output: Record<string, string> = {}; let cursor = 0;
    const currentEpoch = photoEpoch;
    async function resolve(path: string): Promise<string> {
      if (!allowedPaths.has(path)) throw new PortalAccessError("denied", "Essa foto não está disponível neste acesso.");
      const cached = photos.get(path); if (cached && cached.until > Date.now()) return cached.url;
      let task = flights.get(path);
      if (!task) {
        task = (async () => {
          const { data, error } = await guest.storage.from(bucket).download(path); if (error || !data) throw error ?? new PortalAccessError("network", "Não foi possível abrir esta foto.");
          ensure(); if (currentEpoch !== photoEpoch || !allowedPaths.has(path)) throw new PortalAccessError("network", "As fotos precisam ser atualizadas.");
          if (cached) URL.revokeObjectURL(cached.url);
          const url = URL.createObjectURL(data); photos.set(path, { url, until: Date.now() + 45_000 }); return url;
        })(); flights.set(path, task);
      }
      try { return await task; } finally { if (flights.get(path) === task) flights.delete(path); }
    }
    const worker = async () => { while (cursor < requested.length) { const path = requested[cursor++]; output[path] = await resolve(path); } };
    try { await Promise.all(Array.from({ length: Math.min(4, requested.length) }, worker)); return output; }
    catch (cause) { clearPhotos(); throw fail(cause); }
  }

  return { load, submit, upload, removeDraft, photoUrls, clearPhotos, dispose: () => { disposed = true; snapshot = null; allowedPaths.clear(); clearPhotos(); draftPaths.clear(); abort.abort(); } };
}
export function portalRequestId() { return requestUuid(); }
export async function compressPortalImage(file: File): Promise<{ blob: Blob; previewUrl: string }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) throw new PortalAccessError("validation", "Escolha uma foto JPG, PNG ou WebP de até 5 MB.");
  let source = "";
  try { source = URL.createObjectURL(file); const image = new Image(); image.src = source; await image.decode(); const scale = Math.min(1, 1200 / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); const context = canvas.getContext("2d"); if (!context || canvas.width === 0 || canvas.height === 0) throw new Error(); context.drawImage(image, 0, 0, canvas.width, canvas.height); const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error()), "image/webp", .8)); return { blob, previewUrl: URL.createObjectURL(blob) }; }
  catch (cause) { if (cause instanceof PortalAccessError) throw cause; throw new PortalAccessError("validation", "Não foi possível abrir essa foto. Escolha outro arquivo."); }
  finally { if (source) URL.revokeObjectURL(source); }
}
