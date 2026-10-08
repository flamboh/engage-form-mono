/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as approvalMessage from "../approvalMessage.js";
import type * as authed_approvers from "../authed/approvers.js";
import type * as authed_board from "../authed/board.js";
import type * as authed_budget from "../authed/budget.js";
import type * as authed_checks from "../authed/checks.js";
import type * as authed_documents from "../authed/documents.js";
import type * as authed_events from "../authed/events.js";
import type * as authed_extension from "../authed/extension.js";
import type * as authed_extensionSessions from "../authed/extensionSessions.js";
import type * as authed_helpers from "../authed/helpers.js";
import type * as authed_previews from "../authed/previews.js";
import type * as authed_purchaseBuilder from "../authed/purchaseBuilder.js";
import type * as budget from "../budget.js";
import type * as businessPurpose from "../businessPurpose.js";
import type * as checks_candidates from "../checks/candidates.js";
import type * as checks_load from "../checks/load.js";
import type * as checks_requestChecks from "../checks/requestChecks.js";
import type * as events from "../events.js";
import type * as extension from "../extension.js";
import type * as extensionTokens from "../extensionTokens.js";
import type * as extraction_apply from "../extraction/apply.js";
import type * as extraction_candidates from "../extraction/candidates.js";
import type * as extraction_facts from "../extraction/facts.js";
import type * as extraction_jev from "../extraction/jev.js";
import type * as extraction_jobs from "../extraction/jobs.js";
import type * as extraction_pdf from "../extraction/pdf.js";
import type * as extraction_pipeline from "../extraction/pipeline.js";
import type * as extraction_textract from "../extraction/textract.js";
import type * as fileSigning from "../fileSigning.js";
import type * as files from "../files.js";
import type * as funds from "../funds.js";
import type * as fundsMigration from "../fundsMigration.js";
import type * as http from "../http.js";
import type * as lifecycle from "../lifecycle.js";
import type * as purchaseCategories from "../purchaseCategories.js";
import type * as purchaseModel from "../purchaseModel.js";
import type * as purchaseReadiness from "../purchaseReadiness.js";
import type * as purchaseZod from "../purchaseZod.js";
import type * as requestView from "../requestView.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  approvalMessage: typeof approvalMessage;
  "authed/approvers": typeof authed_approvers;
  "authed/board": typeof authed_board;
  "authed/budget": typeof authed_budget;
  "authed/checks": typeof authed_checks;
  "authed/documents": typeof authed_documents;
  "authed/events": typeof authed_events;
  "authed/extension": typeof authed_extension;
  "authed/extensionSessions": typeof authed_extensionSessions;
  "authed/helpers": typeof authed_helpers;
  "authed/previews": typeof authed_previews;
  "authed/purchaseBuilder": typeof authed_purchaseBuilder;
  budget: typeof budget;
  businessPurpose: typeof businessPurpose;
  "checks/candidates": typeof checks_candidates;
  "checks/load": typeof checks_load;
  "checks/requestChecks": typeof checks_requestChecks;
  events: typeof events;
  extension: typeof extension;
  extensionTokens: typeof extensionTokens;
  "extraction/apply": typeof extraction_apply;
  "extraction/candidates": typeof extraction_candidates;
  "extraction/facts": typeof extraction_facts;
  "extraction/jev": typeof extraction_jev;
  "extraction/jobs": typeof extraction_jobs;
  "extraction/pdf": typeof extraction_pdf;
  "extraction/pipeline": typeof extraction_pipeline;
  "extraction/textract": typeof extraction_textract;
  fileSigning: typeof fileSigning;
  files: typeof files;
  funds: typeof funds;
  fundsMigration: typeof fundsMigration;
  http: typeof http;
  lifecycle: typeof lifecycle;
  purchaseCategories: typeof purchaseCategories;
  purchaseModel: typeof purchaseModel;
  purchaseReadiness: typeof purchaseReadiness;
  purchaseZod: typeof purchaseZod;
  requestView: typeof requestView;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
