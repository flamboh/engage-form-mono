import { expect, test } from "vite-plus/test";
import { generateBusinessPurpose, samplePurchase, validatePurchaseReadiness } from "./index.ts";

test("sample purchase is ready", () => {
  expect(validatePurchaseReadiness(samplePurchase)).toEqual([]);
});

test("generates business purpose for the observed flow", () => {
  expect(generateBusinessPurpose(samplePurchase)).toContain(
    "Album Listening Club wishes to reimburse Oliver Boorstein",
  );
  expect(generateBusinessPurpose(samplePurchase)).toContain("Aidan O'Donnell (951951840)");
});
