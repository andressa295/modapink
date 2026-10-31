import type { DemoState, Model, Order } from "./domain";
const model = (id: string, name: string, reference: string, materialId: string, consumption: number, sizes = ["U"]): Model => ({ id, name, reference, materialId, consumption, sizes, notionsCost: .65, sewingCost: 3.2, finishingCost: .7, notes: "Conferir medidas com a peça-piloto. Revisar costuras, acabamento e aplicação da etiqueta antes de liberar o lote." });
const order = (id: string, modelId: string, materialId: string, quantity: number, stage: Order["stage"], due: string, extra: Partial<Order> = {}): Order => ({ id, modelId, materialId, quantity, variants: [{ size: "U", quantity }], stage, due, team: "Oficina interna", priority: "Normal", reserved: 0, actualConsumption: quantity * .14, materialPrice: 36, approved: 0, rework: 0, lost: 0, created: "2026-10-26", ...extra });
export function makeSeed(): DemoState { return {
  version: 1,
  materials: [
    { id: "mat-black", name: "Suplex premium", category: "Tecido", color: "Preto", hex: "#302b31", lot: "SP-2610-01", supplier: "Fornecedor exemplo A", quantity: 182.5, reserved: 22.4, minimum: 35, unit: "kg", price: 36 },
    { id: "mat-pink", name: "Suplex premium", category: "Tecido", color: "Pink", hex: "#df458c", lot: "SP-2610-02", supplier: "Fornecedor exemplo A", quantity: 89, reserved: 0, minimum: 25, unit: "kg", price: 36 },
    { id: "mat-white", name: "Suplex premium", category: "Tecido", color: "Off-white", hex: "#eee6dc", lot: "SP-2610-03", supplier: "Fornecedor exemplo B", quantity: 32, reserved: 31.2, minimum: 20, unit: "kg", price: 38 },
    { id: "mat-nude", name: "Malha canelada", category: "Tecido", color: "Nude", hex: "#cda799", lot: "MC-2610-01", supplier: "Fornecedor exemplo B", quantity: 18.2, reserved: 0, minimum: 20, unit: "kg", price: 42 },
    { id: "mat-ribana", name: "Ribana de acabamento", category: "Tecido", color: "Preto", hex: "#49434a", lot: "RB-2610-01", supplier: "Fornecedor exemplo C", quantity: 36, reserved: 0, minimum: 15, unit: "m", price: 12 },
    { id: "mat-elastic", name: "Elástico 10 mm", category: "Aviamento", color: "Branco", hex: "#f7f6f5", lot: "EL-2610-01", supplier: "Fornecedor exemplo C", quantity: 210, reserved: 0, minimum: 50, unit: "m", price: .8 },
    { id: "mat-label", name: "Etiqueta Moda Pink", category: "Aviamento", color: "Personalizada", hex: "#efb2cf", lot: "ET-2610-01", supplier: "Fornecedor exemplo C", quantity: 900, reserved: 0, minimum: 200, unit: "un", price: .3 },
  ],
  models: [model("zara", "Body Zara", "MP-001", "mat-pink", .14), model("maya", "Body Maya", "MP-002", "mat-black", .15), model("reto", "Body Reto", "MP-003", "mat-white", .13), model("liz", "Body Liz", "MP-004", "mat-nude", .14), model("babylook", "Body Babylook", "MP-005", "mat-pink", .16), model("bella", "Body Bella", "MP-006", "mat-black", .14), model("amelia", "Body Amélia", "MP-007", "mat-black", .14), model("isis", "Body Isis", "MP-008", "mat-pink", .12)],
  orders: [
    order("OP-1028", "zara", "mat-pink", 480, "Costura", "2026-11-03", { team: "Oficina exemplo A", actualConsumption: 68.4 }),
    order("OP-1027", "maya", "mat-black", 320, "Acabamento", "2026-11-02", { actualConsumption: 49 }),
    order("OP-1026", "reto", "mat-white", 240, "Corte", "2026-11-04", { reserved: 31.2, actualConsumption: null, materialPrice: 38 }),
    order("OP-1025", "liz", "mat-nude", 200, "Qualidade", "2026-10-31", { approved: 178, rework: 8, lost: 4, priority: "Alta", actualConsumption: 29, materialPrice: 42 }),
    order("OP-1024", "babylook", "mat-pink", 400, "Concluído", "2026-10-30", { approved: 392, lost: 8, actualConsumption: 65 }),
    order("OP-1023", "bella", "mat-black", 300, "Concluído", "2026-10-29", { approved: 296, lost: 4, actualConsumption: 42.5 }),
    order("OP-1022", "amelia", "mat-black", 160, "Planejado", "2026-11-06", { reserved: 22.4, actualConsumption: null }),
    order("OP-1021", "isis", "mat-pink", 180, "Costura", "2026-10-30", { team: "Oficina exemplo B", priority: "Alta", actualConsumption: 22.3 }),
  ],
  inspections: [
    { id: "qc-01", orderId: "OP-1025", quantity: 8, result: "Retrabalho", reason: "Costura irregular", notes: "Revisar a costura lateral e reconferir as medidas antes da aprovação.", date: "2026-10-31", resolved: false },
    { id: "qc-02", orderId: "OP-1025", quantity: 4, result: "Perda", reason: "Mancha no tecido", notes: "Peças segregadas. Verificar origem no lote de matéria-prima.", date: "2026-10-31", resolved: false },
    { id: "qc-03", orderId: "OP-1024", quantity: 8, result: "Perda", reason: "Falha no corte", notes: "Registro demonstrativo de perda definitiva.", date: "2026-10-30", resolved: false },
    { id: "qc-04", orderId: "OP-1023", quantity: 4, result: "Perda", reason: "Furo no tecido", notes: "Registro demonstrativo de inspeção final.", date: "2026-10-29", resolved: false },
  ],
  activity: [
    { id: "at-1", title: "Conferência de qualidade", detail: "OP-1025 · 178 peças aprovadas", date: "2026-10-31T14:30:00-03:00" },
    { id: "at-2", title: "Acabamento iniciado", detail: "OP-1027 · Body Maya", date: "2026-10-31T13:15:00-03:00" },
    { id: "at-3", title: "Produção concluída", detail: "OP-1024 · 392 peças liberadas", date: "2026-10-30T16:40:00-03:00" },
  ],
}; }
