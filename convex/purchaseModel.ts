import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type Recipient = { name: string; uo95: string; reason: string; value: number };

export type PurchaserRef = { kind: "self" } | { kind: "purchaser"; purchaserId: Id<"purchasers"> };

type Ctx = QueryCtx | MutationCtx;

export type DraftPatch = Partial<{
  organizationId: Id<"organizations"> | null;
  purchaser: PurchaserRef;
  eventPresetId: Id<"eventPresets"> | null;
  eventDate: string;
  vendor: string;
  itemDescription: string;
  totalAmount: number;
  budgetLineItem: string;
  reimbursementReason: string;
  businessPurposeText: string;
  businessPurposeTouched: boolean;
  receiptFileIds: Id<"files">[];
  secondApprovalFileId: Id<"files"> | null;
  publicityFileId: Id<"files"> | null;
  recipients: Recipient[];
}>;

export function ownerFromIdentity(identity: { tokenIdentifier: string }) {
  return identity.tokenIdentifier;
}

export function requireText(value: string, message: string) {
  if (value.trim() === "") throw new Error(message);
}

export async function requireOwnedDoc<
  Table extends
    | "users"
    | "organizations"
    | "files"
    | "purchasers"
    | "eventPresets"
    | "purchaseRequests",
>(ctx: Ctx, table: Table, id: Id<Table & string>, owner: string) {
  void table;
  const doc = await ctx.db.get(id);
  if (doc === null || !("owner" in doc) || doc.owner !== owner) {
    throw new Error("Record not found.");
  }
  return doc;
}

export async function getUserProfile(ctx: Ctx, owner: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .unique();
}

export async function requireUserProfile(ctx: Ctx, owner: string) {
  const user = await getUserProfile(ctx, owner);
  if (user === null) throw new Error("Profile missing.");
  return user;
}

export function applyDraftPatch(
  purchase: Doc<"purchaseRequests">,
  patch: DraftPatch,
): Partial<Doc<"purchaseRequests">> {
  return {
    organizationId:
      patch.organizationId !== undefined ? patch.organizationId : purchase.organizationId,
    purchaser: patch.purchaser !== undefined ? patch.purchaser : purchase.purchaser,
    eventPresetId: patch.eventPresetId !== undefined ? patch.eventPresetId : purchase.eventPresetId,
    eventDate: patch.eventDate !== undefined ? patch.eventDate : purchase.eventDate,
    vendor: patch.vendor !== undefined ? patch.vendor : purchase.vendor,
    itemDescription:
      patch.itemDescription !== undefined ? patch.itemDescription : purchase.itemDescription,
    totalAmount: patch.totalAmount !== undefined ? patch.totalAmount : purchase.totalAmount,
    budgetLineItem:
      patch.budgetLineItem !== undefined ? patch.budgetLineItem : purchase.budgetLineItem,
    reimbursementReason:
      patch.reimbursementReason !== undefined
        ? patch.reimbursementReason
        : purchase.reimbursementReason,
    businessPurposeText:
      patch.businessPurposeText !== undefined
        ? patch.businessPurposeText
        : purchase.businessPurposeText,
    businessPurposeTouched:
      patch.businessPurposeTouched !== undefined
        ? patch.businessPurposeTouched
        : purchase.businessPurposeTouched,
    receiptFileIds:
      patch.receiptFileIds !== undefined ? patch.receiptFileIds : purchase.receiptFileIds,
    secondApprovalFileId:
      patch.secondApprovalFileId !== undefined
        ? patch.secondApprovalFileId
        : purchase.secondApprovalFileId,
    publicityFileId:
      patch.publicityFileId !== undefined ? patch.publicityFileId : purchase.publicityFileId,
    recipients: patch.recipients !== undefined ? patch.recipients : purchase.recipients,
    updatedAt: Date.now(),
  };
}

export function unresolvedToken(value: string) {
  return /\{[A-Za-z][A-Za-z0-9]*\}/.test(value);
}

export async function assemblePurchase(ctx: Ctx, request: Doc<"purchaseRequests">) {
  if (request.organizationId === null) throw new Error("Organization missing.");
  if (request.eventPresetId === null) throw new Error("Event preset missing.");
  if (request.publicityFileId === null) throw new Error("Publicity proof missing.");

  const organization = await requireOwnedDoc(
    ctx,
    "organizations",
    request.organizationId,
    request.owner,
  );
  const eventPreset = await requireOwnedDoc(
    ctx,
    "eventPresets",
    request.eventPresetId,
    request.owner,
  );
  const requester = await requireUserProfile(ctx, request.owner);

  const purchaserIsSelf = request.purchaser.kind === "self";
  const purchaser =
    request.purchaser.kind === "self"
      ? userAsPurchaserPayload(requester)
      : purchaserPayload(
          await requireOwnedDoc(ctx, "purchasers", request.purchaser.purchaserId, request.owner),
        );

  if (purchaserIsSelf && request.secondApprovalFileId === null) {
    throw new Error("Second approval missing.");
  }

  const fileIds = [
    purchaser.idCardFrontFileId,
    purchaser.idCardBackFileId,
    request.publicityFileId,
    request.secondApprovalFileId,
    ...request.receiptFileIds,
  ].filter((id): id is Id<"files"> => id !== null);
  const files = await Promise.all(fileIds.map((id) => purchaseFile(ctx, id, request.owner)));

  return {
    id: request._id,
    status: request.status,
    organization: orgPayload(organization),
    requester: requesterPayload(requester),
    purchaser,
    eventPreset: eventPayload(eventPreset, request.publicityFileId),
    eventDate: request.eventDate,
    vendor: request.vendor,
    itemDescription: request.itemDescription,
    totalAmount: request.totalAmount,
    budgetLineItem: request.budgetLineItem,
    reimbursementReason: request.reimbursementReason,
    businessPurposeText: request.businessPurposeText,
    requesterIsPurchaser: purchaserIsSelf,
    receiptFileIds: request.receiptFileIds,
    secondApprovalFileId: purchaserIsSelf ? request.secondApprovalFileId : null,
    recipients: request.recipients,
    files,
  };
}

export async function assertReady(ctx: Ctx, request: Doc<"purchaseRequests">) {
  const purchase = await assemblePurchase(ctx, request);
  requireText(purchase.eventDate, "Event date missing.");
  requireText(purchase.vendor, "Vendor missing.");
  requireText(purchase.itemDescription, "Item description missing.");
  requireText(purchase.budgetLineItem, "Budget line item missing.");
  requireText(purchase.reimbursementReason, "Reimbursement reason missing.");
  requireText(purchase.businessPurposeText, "Business purpose missing.");
  if (unresolvedToken(purchase.businessPurposeText)) {
    throw new Error("Business purpose has unresolved variables.");
  }
  if (purchase.totalAmount <= 0) throw new Error("Total amount must be greater than zero.");
  if (purchase.receiptFileIds.length === 0) throw new Error("Receipt missing.");
  if (purchase.receiptFileIds.length > 3) throw new Error("Receipts are limited to three.");
  const enteredRecipients = purchase.recipients.filter((recipient) => recipient.value > 0);
  if (enteredRecipients.length === 0) throw new Error("Recipient missing.");

  for (const recipient of enteredRecipients) {
    if (recipient.value >= 50) throw new Error("Recipient value must be under $50.");
    if (recipient.value < 10) continue;
    requireText(recipient.name, "Recipient name missing.");
    requireText(recipient.uo95, "Recipient UO 95 missing.");
    requireText(recipient.reason, "Recipient reason missing.");
  }
}

async function purchaseFile(ctx: Ctx, id: Id<"files">, owner: string) {
  const doc = await requireOwnedDoc(ctx, "files", id, owner);
  return {
    id: doc._id,
    kind: doc.kind,
    filename: doc.filename,
    contentType: doc.contentType,
    size: doc.size,
    storageKey: doc.storageId,
    url: await ctx.storage.getUrl(doc.storageId),
  };
}

function orgPayload(org: Doc<"organizations">) {
  return {
    id: org._id,
    name: org.name,
    indexNumber: org.indexNumber,
    fundLetter: org.fundLetter,
    budgetLines: org.budgetLines,
  };
}

function requesterPayload(user: Doc<"users">) {
  return {
    id: user._id,
    name: user.name,
    email: user.studentEmail,
    phone: user.phone,
    uo95: user.uo95,
    permanentAddress: user.permanentAddress,
    idCardFrontFileId: user.idCardFrontFileId,
    idCardBackFileId: user.idCardBackFileId,
  };
}

function userAsPurchaserPayload(user: Doc<"users">) {
  return {
    id: user._id,
    name: user.name,
    uo95: user.uo95,
    permanentAddress: user.permanentAddress,
    idCardFrontFileId: user.idCardFrontFileId,
    idCardBackFileId: user.idCardBackFileId,
  };
}

function purchaserPayload(purchaser: Doc<"purchasers">) {
  return {
    id: purchaser._id,
    name: purchaser.name,
    uo95: purchaser.uo95,
    permanentAddress: purchaser.permanentAddress,
    idCardFrontFileId: purchaser.idCardFrontFileId,
    idCardBackFileId: purchaser.idCardBackFileId,
  };
}

function eventPayload(eventPreset: Doc<"eventPresets">, publicityFileId: Id<"files">) {
  return {
    id: eventPreset._id,
    name: eventPreset.name,
    scheduleLabel: eventPreset.name,
    time: eventPreset.time,
    location: eventPreset.location,
    estimatedAttendance: eventPreset.estimatedAttendance,
    publicityProofFileId: publicityFileId,
  };
}
