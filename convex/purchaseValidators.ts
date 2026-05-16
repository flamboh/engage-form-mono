import { v } from "convex/values";

export const fundLetter = v.union(
  v.literal("I"),
  v.literal("E"),
  v.literal("G"),
  v.literal("N"),
  v.literal("U"),
  v.literal("D"),
  v.literal("T"),
);

export const fileKind = v.union(
  v.literal("receipt"),
  v.literal("id_front"),
  v.literal("id_back"),
  v.literal("second_approval"),
  v.literal("publicity"),
  v.literal("brand_approval"),
  v.literal("recipient_list"),
);

export const recipient = v.object({
  name: v.string(),
  uo95: v.string(),
  reason: v.string(),
  value: v.number(),
});

export const draftPatch = v.object({
  organizationId: v.optional(v.union(v.id("organizations"), v.null())),
  purchaserPersonId: v.optional(v.union(v.id("people"), v.null())),
  eventPresetId: v.optional(v.union(v.id("eventPresets"), v.null())),
  eventDate: v.optional(v.string()),
  vendor: v.optional(v.string()),
  itemDescription: v.optional(v.string()),
  totalAmount: v.optional(v.number()),
  budgetLineItem: v.optional(v.string()),
  reimbursementReason: v.optional(v.string()),
  businessPurposeText: v.optional(v.string()),
  businessPurposeTouched: v.optional(v.boolean()),
  receiptFileIds: v.optional(v.array(v.id("files"))),
  secondApprovalFileId: v.optional(v.union(v.id("files"), v.null())),
  publicityFileId: v.optional(v.union(v.id("files"), v.null())),
  recipients: v.optional(v.array(recipient)),
});
