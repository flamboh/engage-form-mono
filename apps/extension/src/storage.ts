import type { Purchase } from "@engage-form/domain";

export const READY_PURCHASE_KEY = "readyPurchase";
export const EXTENSION_TOKEN_KEY = "extensionToken";

export type ReadyPurchaseStore = {
  local: {
    get(
      keys: string[],
      callback: (
        items: Partial<
          Record<typeof READY_PURCHASE_KEY, Purchase> & Record<typeof EXTENSION_TOKEN_KEY, string>
        >,
      ) => void,
    ): void;
    set(
      items: Partial<
        Record<typeof READY_PURCHASE_KEY, Purchase> & Record<typeof EXTENSION_TOKEN_KEY, string>
      >,
      callback?: () => void,
    ): void;
  };
};

export function readyPurchaseSummary(purchase: Purchase) {
  const [recipient] = purchase.recipients;
  return {
    title: purchase.itemDescription,
    org: purchase.organization.name,
    amount: `$${purchase.totalAmount.toFixed(2)}`,
    event: `${purchase.eventDate}, ${purchase.eventPreset.time}`,
    recipient: recipient?.name ?? "No recipient",
  };
}

export function parseReadyPurchaseJson(json: string): Purchase | null {
  try {
    const value: unknown = JSON.parse(json);
    if (!isReadyPurchase(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function isReadyPurchase(value: unknown): value is Purchase {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.itemDescription === "string" &&
    typeof value.totalAmount === "number" &&
    Array.isArray(value.files) &&
    isRecord(value.organization) &&
    isRecord(value.purchaser) &&
    isRecord(value.eventPreset) &&
    Array.isArray(value.recipients)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
