export type FundLetter = "I" | "E" | "G" | "N" | "U" | "D" | "T";

export type FileKind =
  | "receipt"
  | "id_front"
  | "id_back"
  | "approval"
  | "publicity"
  | "brand_approval"
  | "recipient_list";

export type PurchaseStatus = "draft" | "ready" | "filled";

export type Organization = {
  id: string;
  name: string;
  indexNumber: string;
  fundLetter: FundLetter;
  defaultBudgetLineItem: string;
};

export type PurchaserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  uo95: string;
  permanentAddress: string;
  idCardFrontFileId: string;
  idCardBackFileId: string;
};

export type EventPreset = {
  id: string;
  name: string;
  scheduleLabel: string;
  time: string;
  location: string;
  estimatedAttendance: number;
  publicityProofFileId: string;
};

export type PurchaseFile = {
  id: string;
  kind: FileKind;
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
};

export type Recipient = {
  name: string;
  uo95: string;
  itemDescription: string;
  value: number;
  reason: string;
};

export type Purchase = {
  id: string;
  status: PurchaseStatus;
  organization: Organization;
  purchaser: PurchaserProfile;
  eventPreset: EventPreset;
  eventDate: string;
  vendor: string;
  itemDescription: string;
  totalAmount: number;
  budgetLineItem: string;
  reimbursementReason: string;
  requesterIsReimbursee: boolean;
  receiptFileIds: string[];
  approvalFileId: string;
  recipients: Recipient[];
  files: PurchaseFile[];
};

export type ReadinessIssue = {
  field: string;
  message: string;
};

export const samplePurchase: Purchase = {
  id: "purchase_mort_garson",
  status: "ready",
  organization: {
    id: "org_alc",
    name: "Album Listening Club",
    indexNumber: "OS353i",
    fundLetter: "I",
    defaultBudgetLineItem: "Event Expenses",
  },
  purchaser: {
    id: "profile_oliver",
    name: "Oliver Boorstein",
    email: "obo@uoregon.edu",
    phone: "9073104429",
    uo95: "952043159",
    permanentAddress: "11337 Our Rd, Anchorage, AK 99516",
    idCardFrontFileId: "file_id_front",
    idCardBackFileId: "file_id_back",
  },
  eventPreset: {
    id: "event_alc_weekly",
    name: "Album Listening Club weekly event",
    scheduleLabel: "Weekly Tuesday event",
    time: "6:30pm",
    location: "McKenzie 240A",
    estimatedAttendance: 50,
    publicityProofFileId: "file_publicity",
  },
  eventDate: "04/21",
  vendor: "Amazon",
  itemDescription: "Mort Garson music vinyl",
  totalAmount: 22.98,
  budgetLineItem: "Event Expenses",
  reimbursementReason: "Other processes are too slow.",
  requesterIsReimbursee: true,
  receiptFileIds: ["file_receipt"],
  approvalFileId: "file_approval",
  recipients: [
    {
      name: "Aidan O'Donnell",
      uo95: "951951840",
      itemDescription: "Mort Garson music vinyl",
      value: 22.98,
      reason: "winning the Kahoot! Trivia",
    },
  ],
  files: [
    file("file_id_front", "id_front", "Oliver_ID_1.jpg", "image/jpeg"),
    file("file_id_back", "id_back", "Oliver_ID_2.jpg", "image/jpeg"),
    file("file_receipt", "receipt", "mort_garson_receipt.pdf", "application/pdf"),
    file("file_approval", "approval", "approval_email.pdf", "application/pdf"),
    file("file_publicity", "publicity", "weekly_event_engage.pdf", "application/pdf"),
  ],
};

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function budgetLineText(purchase: Purchase) {
  return `${formatMoney(purchase.totalAmount)} from ${purchase.budgetLineItem}`;
}

export function reimbursementRecipientText(purchase: Purchase) {
  return `${purchase.purchaser.name}, ${purchase.purchaser.uo95}`;
}

export function recipientValueText(purchase: Purchase) {
  return purchase.recipients
    .map((recipient) => `${recipient.name}, ${formatMoney(recipient.value)}`)
    .join("\n");
}

export function recipientIdText(purchase: Purchase) {
  return purchase.recipients.map((recipient) => `${recipient.name}, ${recipient.uo95}`).join("\n");
}

export function generateBusinessPurpose(purchase: Purchase) {
  const recipient = firstRecipient(purchase);
  return `${purchase.organization.name} wishes to reimburse ${purchase.purchaser.name} because they purchased a ${purchase.itemDescription} from ${purchase.vendor} for ${formatMoney(purchase.totalAmount)}. This ${purchase.itemDescription} was given as a gift to ${recipient.name} (${recipient.uo95}) for ${recipient.reason} during ${purchase.eventPreset.name} which took place on ${purchase.eventDate} at ${purchase.eventPreset.time} in ${purchase.eventPreset.location} with about ${purchase.eventPreset.estimatedAttendance} students in attendance.`;
}

export function validatePurchaseReadiness(purchase: Purchase) {
  const issues: ReadinessIssue[] = [];

  requireText(
    issues,
    "organization.name",
    purchase.organization.name,
    "Organization name missing.",
  );
  requireText(
    issues,
    "organization.indexNumber",
    purchase.organization.indexNumber,
    "Index missing.",
  );
  requireText(issues, "purchaser.name", purchase.purchaser.name, "Purchaser name missing.");
  requireText(issues, "purchaser.email", purchase.purchaser.email, "Purchaser email missing.");
  requireText(issues, "eventDate", purchase.eventDate, "Event date missing.");
  requireText(issues, "vendor", purchase.vendor, "Vendor missing.");
  requireText(issues, "itemDescription", purchase.itemDescription, "Item description missing.");
  requireText(
    issues,
    "reimbursementReason",
    purchase.reimbursementReason,
    "Reimbursement reason missing.",
  );

  if (purchase.totalAmount <= 0) {
    issues.push({ field: "totalAmount", message: "Total amount must be greater than zero." });
  }

  if (purchase.receiptFileIds.length === 0) {
    issues.push({ field: "receiptFileIds", message: "Receipt file missing." });
  }

  requireText(
    issues,
    "purchaser.idCardFrontFileId",
    purchase.purchaser.idCardFrontFileId,
    "ID front missing.",
  );
  requireText(
    issues,
    "purchaser.idCardBackFileId",
    purchase.purchaser.idCardBackFileId,
    "ID back missing.",
  );
  requireText(
    issues,
    "eventPreset.publicityProofFileId",
    purchase.eventPreset.publicityProofFileId,
    "Publicity proof missing.",
  );

  if (purchase.requesterIsReimbursee) {
    requireText(issues, "approvalFileId", purchase.approvalFileId, "Second approval missing.");
  }

  if (purchase.recipients.length === 0) {
    issues.push({ field: "recipients", message: "Recipient missing." });
  }

  for (const recipient of purchase.recipients) {
    requireText(issues, "recipient.name", recipient.name, "Recipient name missing.");
    requireText(issues, "recipient.uo95", recipient.uo95, "Recipient UO 95 missing.");
    if (recipient.value >= 50) {
      issues.push({ field: "recipient.value", message: "Gift value must be under $50." });
    }
  }

  return issues;
}

function firstRecipient(purchase: Purchase) {
  const [recipient] = purchase.recipients;
  if (recipient === undefined) {
    throw new Error("Purchase requires a recipient.");
  }
  return recipient;
}

function requireText(issues: ReadinessIssue[], field: string, value: string, message: string) {
  if (value.trim() === "") {
    issues.push({ field, message });
  }
}

function file(id: string, kind: FileKind, filename: string, contentType: string): PurchaseFile {
  return {
    id,
    kind,
    filename,
    contentType,
    size: 1,
    storageKey: `sample/${filename}`,
  };
}
