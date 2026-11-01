import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMaterialPrice } from "../lib/material-input.ts";

const cases = [
  ["12,50", 12.5, "vírgula decimal"],
  ["0,00", 0, "custo zero"],
  ["1.234,56", 1234.56, "milhar e centavos"],
  [" 12,5 ", 12.5, "espaços externos e uma casa decimal"],
  ["250", 250, "valor inteiro"],
  ["1.234", 1234, "milhar no formato brasileiro"],
  ["12.50", null, "recusa ponto decimal sem multiplicar o custo"],
  ["1,234", null, "recusa mais de duas casas decimais"],
  ["", null, "recusa campo vazio"],
  ["-12,50", null, "recusa valor negativo"],
  ["1e3", null, "recusa notação científica"],
  ["NaN", null, "recusa NaN"],
  ["12,50abc", null, "recusa texto após o valor"],
  ["1.23,45", null, "recusa agrupamento de milhar incompleto"],
  ["1,2,3", null, "recusa vírgulas repetidas"],
];

for (const [input, expected, description] of cases) {
  test(`custo do material: ${description}`, () => {
    assert.equal(parseMaterialPrice(input), expected);
  });
}
