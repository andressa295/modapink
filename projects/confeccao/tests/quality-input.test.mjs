import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareInspection, qualityLotSnapshot, remainingQuality } from "../lib/quality-input.ts";
const lot = { id: "OP-000001", stage: "Qualidade", quantity: 100, approved: 20, rework: 5, lost: 2 };
const fields = { result: "Aprovadas", quantity: "10", reason: "", notes: "Conferência da manhã" };
test("qualidade: registra somente um resultado e respeita as peças ainda não conferidas", () => {
  assert.equal(remainingQuality(lot), 73);
  assert.deepEqual(prepareInspection(lot, fields), { orderId: lot.id, result: "Aprovadas", quantity: 10, reason: "Conferência aprovada", notes: "Conferência da manhã" });
  assert.equal(prepareInspection(lot, { ...fields, quantity: "73" }).quantity, 73);
  assert.throws(() => prepareInspection(lot, { ...fields, quantity: "74" }), /no máximo/);
});
test("qualidade: rejeita quantidades fracionadas, notação ambígua e lote fora da qualidade", () => {
  for (const quantity of ["", "0", "-1", "1,5", "1.5", "1e2", "Infinity"]) assert.throws(() => prepareInspection(lot, { ...fields, quantity }), /inteira/);
  assert.throws(() => prepareInspection({ ...lot, stage: "Costura" }, fields), /Escolha uma produção/);
  assert.throws(() => prepareInspection(undefined, fields), /Escolha uma produção/);
  assert.throws(() => prepareInspection(lot, { ...fields, result: null }), /Escolha o resultado/);
});
test("qualidade: defeito exige motivo e Outro exige descrição; fotos continuam opcionais", () => {
  assert.throws(() => prepareInspection(lot, { ...fields, result: "Retrabalho" }), /tipo de defeito/);
  assert.throws(() => prepareInspection(lot, { ...fields, result: "Perda", reason: "Outro · detalhar", notes: " " }), /Descreva/);
  const data = prepareInspection(lot, { ...fields, result: "Retrabalho", reason: "Costura irregular", notes: "Revisar a barra." });
  assert.equal(data.result, "Retrabalho"); assert.equal("image" in data, false);
});
test("qualidade: a revisão identifica alteração dos contadores ou da etapa do lote", () => {
  assert.equal(qualityLotSnapshot(lot), qualityLotSnapshot({ ...lot }));
  for (const changed of [{ ...lot, approved: 21 }, { ...lot, rework: 6 }, { ...lot, stage: "Concluído" }]) assert.notEqual(qualityLotSnapshot(lot), qualityLotSnapshot(changed));
});
