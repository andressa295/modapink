import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPortalAccessUrl, isPortalPartnerPath, ownerPortalStateSchema, parseGuestPortalState, portalPhotoPathSchema, portalTokenFromFragment, validatePortalSubmission } from "../lib/partner-portal-contract.ts";

const partnerId = "1093a45e-651f-44d9-a9d1-1f7822faec13";
const otherPartnerId = "a7c00a46-ad6c-4be9-b495-714c3056a709";
const orderId = "871c853b-0f59-430e-bbf3-945d706b8716";
const imageId = "3effd41a-592f-4682-8cbb-80f77d29001b";
const token = "1a".repeat(32);
const image = `portal/${partnerId}/${imageId}.webp`;
const order = { id: orderId, code: "OP-125", model: { id: "MOD-1", name: "Vestido", reference: "REF-1", image: `models/${imageId}.webp` }, quantity: 100, variants: [{ size: "M", quantity: 100 }], stage: "Costura", due: "2026-12-10", priority: "Normal" };
const update = { id: imageId, partnerId, orderId, stage: "Conferência", produced: 70, checked: 60, defects: 2, reporter: "Ana", notes: null, defectDescription: "Costura lateral", photos: [image], createdAt: "2026-11-01T10:00:00+00:00" };
const state = () => ({ partner: { id: partnerId, name: "Confecção parceira" }, expiresAt: "2026-12-01T10:00:00+00:00", orders: [structuredClone(order)], updates: [structuredClone(update)], latestUpdates: [structuredClone(update)], historyLimit: 200 });
const report = () => ({ orderId, stage: "Costura", produced: 80, checked: 70, defects: 0, reporter: " Ana ", photos: [] });
const denied = cause => cause?.kind === "denied";
const validation = cause => cause?.kind === "validation";

test("acesso é aceito somente como fragmento único e não aparece nas mensagens de erro", () => {
  assert.equal(portalTokenFromFragment(`#acesso=${token}`), token);
  for (const fragment of ["", `?acesso=${token}`, `#acesso=${token}&acesso=${token}`, `#acesso=${token.toUpperCase()}`, `#acesso=${token.slice(1)}`]) {
    assert.throws(() => portalTokenFromFragment(fragment), cause => denied(cause) && !cause.message.includes(token));
  }
  const url = new URL(buildPortalAccessUrl("https://pink.example/ordens?next=https://outside.example#old", token));
  assert.equal(url.origin, "https://pink.example"); assert.equal(url.pathname, "/portal-confeccao"); assert.equal(url.search, ""); assert.equal(url.hash, `#acesso=${token}`);
  assert.throws(() => buildPortalAccessUrl("javascript:alert(1)", token));
});

test("fotos aceitam somente caminhos canônicos privados, e evidência pertence à parceira", () => {
  assert.ok(isPortalPartnerPath(image, partnerId));
  assert.equal(isPortalPartnerPath(image, otherPartnerId), false);
  assert.ok(portalPhotoPathSchema.safeParse(`models/${imageId}.png`).success);
  for (const path of ["https://outside.example/photo.png", `${image}?token=secret`, `portal/${partnerId}/../${imageId}.webp`, `portal/${partnerId}/${imageId}.svg`, `models/${imageId}.webp/extra`]) assert.equal(portalPhotoPathSchema.safeParse(path).success, false);
});

test("totais acumulados exigem nome, limites inteiros, conferência consistente e descrição do defeito", () => {
  assert.equal(validatePortalSubmission(report(), order).reporter, "Ana");
  for (const change of [{ reporter: "  " }, { produced: 101 }, { produced: 2.5 }, { checked: 81 }, { defects: 71, defectDescription: "Avesso" }, { defects: 1 }, { orderId: otherPartnerId }, { photos: [image, image] }]) assert.throws(() => validatePortalSubmission({ ...report(), ...change }, order), validation);
  assert.equal(validatePortalSubmission({ ...report(), produced: 10, checked: 8, defects: 1, defectDescription: "Barra desalinhada", photos: [image] }, order).produced, 10);
});

test("pronto para retirada exige lote todo produzido e conferido, com foto opcional", () => {
  assert.throws(() => validatePortalSubmission({ ...report(), stage: "Pronto para retirada", produced: 100, checked: 99 }, order), validation);
  const value = validatePortalSubmission({ ...report(), stage: "Pronto para retirada", produced: 100, checked: 100, defects: 1, defectDescription: "Costura para revisão", photos: [] }, order);
  assert.equal(value.stage, "Pronto para retirada"); assert.equal(value.defects, 1); assert.deepEqual(value.photos, []);
});

test("resposta de convidada falha fechada para vínculo, OP, foto e acesso expirado", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  assert.equal(parseGuestPortalState(state(), now).updates[0].notes, "");
  for (const mutate of [value => { value.updates[0].partnerId = otherPartnerId; }, value => { value.latestUpdates[0].orderId = otherPartnerId; }, value => { value.latestUpdates[0].photos = [`portal/${otherPartnerId}/${imageId}.webp`]; }, value => { value.updates[0].checked = 90; }, value => { value.expiresAt = "2026-11-01T11:00:00Z"; }]) { const value = state(); mutate(value); assert.throws(() => parseGuestPortalState(value, now), denied); }
});

test("snapshot atual continua disponível fora do limite de histórico e campos financeiros não entram no contrato", () => {
  const value = state(); value.updates = []; value.orders[0].cost = 9000; value.orders[0].model.supplier = "Privado"; value.partner.bankAccount = "Privado";
  const parsed = parseGuestPortalState(value, Date.parse("2026-11-01T12:00:00Z"));
  assert.equal(parsed.updates.length, 0); assert.equal(parsed.latestUpdates[0].produced, 70); assert.equal(parsed.historyLimit, 200);
  assert.equal("cost" in parsed.orders[0], false); assert.equal("supplier" in parsed.orders[0].model, false); assert.equal("bankAccount" in parsed.partner, false);
});

test("notas válidas de 4000 caracteres do banco não bloqueiam convidada nem painel interno", () => {
  const value = state(); value.updates[0].notes = "a".repeat(4000); value.latestUpdates[0].notes = "a".repeat(4000);
  assert.equal(parseGuestPortalState(value, Date.parse("2026-11-01T12:00:00Z")).updates[0].notes.length, 4000);
  const owner = ownerPortalStateSchema.parse({ partners: [{ id: partnerId, name: "Parceira", contact: "", active: true, createdAt: update.createdAt }], orders: value.orders, assignments: [], links: [], updates: value.updates, latestUpdates: value.latestUpdates, historyLimit: 200 });
  assert.equal(owner.latestUpdates[0].notes.length, 4000);
  assert.equal(validatePortalSubmission({ ...report(), notes: "b".repeat(4000) }, order).notes.length, 4000);
  assert.throws(() => validatePortalSubmission({ ...report(), reporter: "a".repeat(101) }, order), validation);
});
