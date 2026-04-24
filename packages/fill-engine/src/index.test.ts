import { expect, test } from "vite-plus/test";
import { samplePurchase } from "../../domain/src/index.ts";
import { createFillPlan, detectStep } from "./index.ts";

test("detects Engage steps by heading", () => {
  expect(detectStep("SOFS Request Type of purchase")).toBe("purchaseType");
  expect(detectStep("Engage - Review Submission")).toBe("review");
});

test("creates about-page fill plan", () => {
  const plan = createFillPlan("about", samplePurchase);

  expect(plan.actions).toContainEqual({
    type: "text",
    labelIncludes: "Name of Student Organization",
    value: "Album Listening Club",
  });
});
