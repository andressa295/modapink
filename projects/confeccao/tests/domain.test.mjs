import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSeed } from "../lib/seed.ts";
import { advanceOrder, available, createOrder, directCost, inspectOrder, moveMaterial, resolveInspection } from "../lib/domain.ts";
const input = { modelId: "zara", materialId: "mat-pink", variants: [{ size: "U", quantity: 100 }], due: "2026-11-10", team: "Equipe demonstrativa", priority: "Normal" };
test("a criação reserva tecido sem consumir o saldo físico", () => {
  const seed = makeSeed(); const next = createOrder(seed, input); const material = next.materials.find(m => m.id === "mat-pink");
  assert.equal(material.quantity, 89); assert.equal(material.reserved, 14); assert.equal(available(material), 75); assert.equal(next.orders[0].id, "OP-1029"); assert.equal(seed.materials.find(m => m.id === "mat-pink").reserved, 0);
});
test("quantidades inválidas, grades duplicadas e tecido incompatível são rejeitados", () => {
  const seed = makeSeed();
  assert.throws(() => createOrder(seed, { ...input, variants: [{ size: "U", quantity: 10000 }] }), /insuficiente/);
  assert.throws(() => createOrder(seed, { ...input, variants: [{ size: "U", quantity: 1.5 }] }), /inteira/);
  assert.throws(() => createOrder(seed, { ...input, variants: [{ size: "U", quantity: 1 }, { size: "U", quantity: 1 }] }), /única/);
  assert.throws(() => createOrder(seed, { ...input, materialId: "mat-ribana" }), /compatível/);
});
test("o corte baixa o consumo efetivo e libera somente a reserva da ordem", () => {
  let state = createOrder(makeSeed(), input); state = advanceOrder(state, "OP-1029"); state = advanceOrder(state, "OP-1029", 15.2);
  const m = state.materials.find(m => m.id === "mat-pink"); const o = state.orders.find(o => o.id === "OP-1029");
  assert.equal(m.quantity, 73.8); assert.equal(m.reserved, 0); assert.equal(o.actualConsumption, 15.2); assert.equal(o.stage, "Costura");
});
test("o consumo não pode usar tecido reservado por outras produções", () => {
  let state = createOrder(makeSeed(), input); state = createOrder(state, input); state = advanceOrder(state, "OP-1029");
  assert.throws(() => advanceOrder(state, "OP-1029", 76), /ultrapassa/);
});
test("perdas manuais preservam as reservas e entradas não mudam a reserva", () => {
  const seed = makeSeed(); assert.throws(() => moveMaterial(seed, "mat-white", 1, "Perda", "Teste"), /reservado/);
  const state = moveMaterial(seed, "mat-white", 10, "Entrada", "Recebimento exemplo"); assert.equal(state.materials.find(m => m.id === "mat-white").reserved, 31.2); assert.equal(state.materials.find(m => m.id === "mat-white").quantity, 42);
});
test("a qualidade impede dupla contagem e conclusão com retrabalho pendente", () => {
  const seed = makeSeed(); assert.throws(() => advanceOrder(seed, "OP-1025"), /Confira/);
  assert.throws(() => inspectOrder(seed, { orderId: "OP-1025", quantity: 11, result: "Aprovadas", reason: "OK", notes: "" }), /Restam 10/);
  assert.throws(() => inspectOrder(seed, { orderId: "OP-1028", quantity: 1, result: "Aprovadas", reason: "OK", notes: "" }), /etapa de qualidade/);
});
test("a reconferência aprova o retrabalho uma única vez e libera o encerramento", () => {
  let state = inspectOrder(makeSeed(), { orderId: "OP-1025", quantity: 10, result: "Aprovadas", reason: "OK", notes: "" });
  state = resolveInspection(state, "qc-01"); assert.throws(() => resolveInspection(state, "qc-01"), /resolvido/);
  state = advanceOrder(state, "OP-1025"); const order = state.orders.find(o => o.id === "OP-1025");
  assert.equal(order.approved, 196); assert.equal(order.rework, 0); assert.equal(order.lost, 4); assert.equal(order.stage, "Concluído");
  assert.equal(order.approved + order.lost, order.quantity);
});
test("o custo realizado usa o consumo efetivo e o preço do tecido na ordem", () => {
  const state = makeSeed(); const order = state.orders.find(o => o.id === "OP-1024"); const model = state.models.find(m => m.id === order.modelId);
  assert.equal(directCost(state, order, true), 65 * 36 + 400 * (model.notionsCost + model.sewingCost + model.finishingCost));
  const newState = { ...state, materials: state.materials.map(m => ({ ...m, price: 999 })) };
  assert.equal(directCost(newState, order, true), directCost(state, order, true));
});
test("a ordem preserva custos e consumo da ficha capturada na abertura", () => {
  const seed = makeSeed(); const original = seed.models.find(m => m.id === 'babylook');
  const order = { ...seed.orders.find(o => o.id === 'OP-1024'), consumptionPerPiece: original.consumption, modelSnapshot: { consumption: original.consumption, notionsCost: original.notionsCost, sewingCost: original.sewingCost, finishingCost: original.finishingCost } };
  const before = directCost(seed, order, true);
  const changed = { ...seed, models: seed.models.map(m => m.id === original.id ? { ...m, consumption: 99, sewingCost: 999 } : m) };
  assert.equal(directCost(changed, order, true), before);
});
