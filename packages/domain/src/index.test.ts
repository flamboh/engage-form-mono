import { expect, test } from "vite-plus/test";
import {
  generateBusinessPurpose,
  recipientIdText,
  recipientValueText,
  samplePurchase,
  validatePurchaseReadiness,
} from "./index.ts";

test("sample purchase is ready", () => {
  expect(validatePurchaseReadiness(samplePurchase)).toEqual([]);
});

test("generates business purpose for the observed flow", () => {
  expect(generateBusinessPurpose(samplePurchase)).toContain(
    "Album Listening Club wishes to reimburse Oliver Boorstein",
  );
  expect(generateBusinessPurpose(samplePurchase)).toContain("Aidan O'Donnell (951951840)");
});

test("blocks unresolved business purpose tokens", () => {
  expect(
    validatePurchaseReadiness({
      ...samplePurchase,
      businessPurposeText: "Reimburse {purchaser} for {item}.",
    }),
  ).toContainEqual({
    field: "businessPurposeText",
    message: "Business purpose has unresolved variables.",
  });
});

test("requires recipient reasons for reportable gifts", () => {
  expect(
    validatePurchaseReadiness({
      ...samplePurchase,
      recipients: [{ ...samplePurchase.recipients[0], reason: "", value: 10 }],
    }),
  ).toEqual(
    expect.arrayContaining([{ field: "recipient.reason", message: "Recipient reason missing." }]),
  );
});

test("does not require or report recipient details for gifts under $10", () => {
  const purchase = {
    ...samplePurchase,
    totalAmount: 8,
    recipients: [{ name: "", uo95: "", reason: "", itemDescription: "Sticker", value: 8 }],
  };

  expect(validatePurchaseReadiness(purchase)).not.toEqual(
    expect.arrayContaining([
      { field: "recipient.name", message: "Recipient name missing." },
      { field: "recipient.uo95", message: "Recipient UO 95 missing." },
      { field: "recipient.reason", message: "Recipient reason missing." },
      { field: "recipients.value", message: "Recipient values must equal total." },
    ]),
  );
  expect(recipientValueText(purchase)).toBe("");
  expect(recipientIdText(purchase)).toBe("");
});

test("requires second approval only for requester purchases", () => {
  expect(
    validatePurchaseReadiness({ ...samplePurchase, secondApprovalFileId: null }),
  ).toContainEqual({
    field: "secondApprovalFileId",
    message: "Second approval missing.",
  });

  expect(
    validatePurchaseReadiness({
      ...samplePurchase,
      requesterIsPurchaser: false,
      purchaser: { ...samplePurchase.purchaser, id: "person_someone_else" },
      secondApprovalFileId: null,
    }),
  ).not.toContainEqual({
    field: "secondApprovalFileId",
    message: "Second approval missing.",
  });
});
