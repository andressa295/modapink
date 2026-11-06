import { z } from "zod";
export const portalStages = ["Recebido", "Corte", "Costura", "Acabamento", "Conferência", "Pronto para retirada"] as const;
const uuid = z.string().uuid();
const dateTime = z.string().datetime({ offset: true });
const count = z.number().int().nonnegative().max(999999999);
const words = z.string().max(2000).nullable().transform(value => value ?? "");
const notes = z.string().max(4000).nullable().transform(value => value ?? "");
const uuidPath = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const portalPhotoPathSchema = z.string().regex(new RegExp(`^(?:portal/${uuidPath}/${uuidPath}|models/${uuidPath})\\.(?:webp|jpe?g|png)$`, "i"));
export const portalUpdateSchema = z.object({ id: uuid, partnerId: uuid, orderId: uuid, stage: z.enum(portalStages), produced: count, checked: count, defects: count, reporter: z.string().min(1).max(100), notes, defectDescription: words, photos: z.array(portalPhotoPathSchema).max(6), createdAt: dateTime });
export const portalOrderSchema = z.object({ id: uuid, code: z.string().min(1).max(80), model: z.object({ id: z.string().min(1), name: z.string().min(1).max(160), reference: z.string().max(80), image: portalPhotoPathSchema.nullable() }), quantity: count.positive(), variants: z.array(z.object({ size: z.string().max(30), quantity: count })), stage: z.enum(["Planejado", "Corte", "Costura", "Acabamento", "Qualidade", "Concluído"]), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), priority: z.enum(["Normal", "Alta"]) });
export const portalPartnerSchema = z.object({ id: uuid, name: z.string().min(1).max(160), contact: z.string().max(240).nullable().transform(value => value ?? ""), active: z.boolean(), createdAt: dateTime });
export const portalAssignmentSchema = z.object({ orderId: uuid, partnerId: uuid, assignedAt: dateTime });
export const portalLinkSchema = z.object({ id: uuid, partnerId: uuid, createdAt: dateTime, expiresAt: dateTime, revokedAt: dateTime.nullable(), active: z.boolean() });
export const createdPortalLinkSchema = z.object({ id: uuid, partnerId: uuid, token: z.string().regex(/^[0-9a-f]{64}$/), expiresAt: dateTime });
export const ownerPortalStateSchema = z.object({ partners: z.array(portalPartnerSchema), orders: z.array(portalOrderSchema), assignments: z.array(portalAssignmentSchema), links: z.array(portalLinkSchema), updates: z.array(portalUpdateSchema), latestUpdates: z.array(portalUpdateSchema), historyLimit: z.literal(200), createdLink: createdPortalLinkSchema.optional() });
export const guestPortalStateSchema = z.object({ partner: z.object({ id: uuid, name: z.string().min(1).max(160) }), expiresAt: dateTime, orders: z.array(portalOrderSchema), updates: z.array(portalUpdateSchema), latestUpdates: z.array(portalUpdateSchema), historyLimit: z.literal(200) });
export const portalSubmissionSchema = z.object({ orderId: uuid, stage: z.enum(portalStages), produced: count, checked: count, defects: count, reporter: z.string().trim().min(1, "Informe seu nome.").max(100), notes: z.string().trim().max(4000).default(""), defectDescription: z.string().trim().max(2000).default(""), photos: z.array(portalPhotoPathSchema).max(6).default([]) }).superRefine((value, ctx) => {
  if (value.checked > value.produced) ctx.addIssue({ code: "custom", path: ["checked"], message: "A quantidade conferida não pode ultrapassar a produzida." });
  if (value.defects > value.checked) ctx.addIssue({ code: "custom", path: ["defects"], message: "A quantidade com defeito não pode ultrapassar a conferida." });
  if (value.defects > 0 && !value.defectDescription.trim()) ctx.addIssue({ code: "custom", path: ["defectDescription"], message: "Descreva os defeitos encontrados." });
  if (new Set(value.photos).size !== value.photos.length) ctx.addIssue({ code: "custom", path: ["photos"], message: "Não repita a mesma foto." });
});
export const portalSubmissionResultSchema = z.object({ update: portalUpdateSchema, requestId: uuid, replayed: z.boolean() });
export type PortalStage = (typeof portalStages)[number];
export type PortalPartner = z.infer<typeof portalPartnerSchema>;
export type PortalOrder = z.infer<typeof portalOrderSchema>;
export type PortalAssignment = z.infer<typeof portalAssignmentSchema>;
export type PortalLink = z.infer<typeof portalLinkSchema>;
export type PortalUpdate = z.infer<typeof portalUpdateSchema>;
export type CreatedPortalLink = z.infer<typeof createdPortalLinkSchema>;
export type OwnerPortalState = z.infer<typeof ownerPortalStateSchema>;
export type GuestPortalState = z.infer<typeof guestPortalStateSchema>;
export type PortalSubmission = z.infer<typeof portalSubmissionSchema>;
export type PortalSubmissionInput = z.input<typeof portalSubmissionSchema>;
export class PortalAccessError extends Error {
  readonly kind: "denied" | "network" | "validation" | "configuration";
  constructor(kind: PortalAccessError["kind"], message: string) { super(message); this.kind = kind; this.name = "PortalAccessError"; }
}
export function portalTokenFromFragment(hash: string): string {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : "");
  const values = params.getAll("acesso");
  if (values.length !== 1 || !/^[0-9a-f]{64}$/.test(values[0])) throw new PortalAccessError("denied", "Este link está inválido ou incompleto. Peça um novo acesso à Moda Pink.");
  return values[0];
}
export function validatePortalSubmission(input: unknown, order: PortalOrder): PortalSubmission {
  const result = portalSubmissionSchema.safeParse(input);
  if (!result.success) throw new PortalAccessError("validation", result.error.issues[0]?.message || "Confira os dados da atualização.");
  if (result.data.orderId !== order.id || result.data.produced > order.quantity) throw new PortalAccessError("validation", "As quantidades devem respeitar o total desta ordem de produção.");
  if (result.data.stage === "Pronto para retirada" && (result.data.produced !== order.quantity || result.data.checked !== order.quantity)) throw new PortalAccessError("validation", "Para marcar como pronto para retirada, informe todas as peças produzidas e conferidas.");
  return result.data;
}
export function isPortalPartnerPath(path: string, partnerId: string): boolean { return portalPhotoPathSchema.safeParse(path).success && path.startsWith(`portal/${partnerId}/`); }
export function parseGuestPortalState(input: unknown, now = Date.now()): GuestPortalState {
  const parsed = guestPortalStateSchema.safeParse(input);
  if (!parsed.success) throw new PortalAccessError("network", "A resposta da confecção está incompleta. Tente atualizar novamente.");
  const state = parsed.data;
  if (Date.parse(state.expiresAt) <= now) throw new PortalAccessError("denied", "Este link expirou. Peça um novo acesso à Moda Pink.");
  const orders = new Map(state.orders.map(order => [order.id, order]));
  for (const update of [...state.updates, ...state.latestUpdates]) {
    const order = orders.get(update.orderId);
    if (update.partnerId !== state.partner.id || !order || update.produced > order.quantity || update.checked > update.produced || update.defects > update.checked || update.photos.some(path => !isPortalPartnerPath(path, state.partner.id))) {
      throw new PortalAccessError("denied", "Não foi possível validar as ordens deste acesso.");
    }
  }
  return state;
}
export function buildPortalAccessUrl(origin: string, token: string): string {
  portalTokenFromFragment(`#acesso=${token}`);
  const base = new URL(origin);
  if (!["https:", "http:"].includes(base.protocol)) throw new PortalAccessError("configuration", "O endereço da confecção é inválido.");
  const url = new URL("/portal-confeccao", base.origin); url.hash = `acesso=${token}`;
  return url.toString();
}
