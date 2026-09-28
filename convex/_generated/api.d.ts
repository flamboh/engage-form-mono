/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as authed_board from "../authed/board.js";
import type * as authed_documents from "../authed/documents.js";
import type * as authed_extension from "../authed/extension.js";
import type * as authed_helpers from "../authed/helpers.js";
import type * as authed_previews from "../authed/previews.js";
import type * as authed_purchaseBuilder from "../authed/purchaseBuilder.js";
import type * as businessPurpose from "../businessPurpose.js";
import type * as extraction_apply from "../extraction/apply.js";
import type * as extraction_candidates from "../extraction/candidates.js";
import type * as extraction_jev from "../extraction/jev.js";
import type * as extraction_jobs from "../extraction/jobs.js";
import type * as extraction_pdf from "../extraction/pdf.js";
import type * as extraction_pipeline from "../extraction/pipeline.js";
import type * as extraction_textract from "../extraction/textract.js";
import type * as fileSigning from "../fileSigning.js";
import type * as files from "../files.js";
import type * as purchaseCategories from "../purchaseCategories.js";
import type * as purchaseModel from "../purchaseModel.js";
import type * as purchaseReadiness from "../purchaseReadiness.js";
import type * as purchaseZod from "../purchaseZod.js";
import type * as requestView from "../requestView.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "authed/board": typeof authed_board;
  "authed/documents": typeof authed_documents;
  "authed/extension": typeof authed_extension;
  "authed/helpers": typeof authed_helpers;
  "authed/previews": typeof authed_previews;
  "authed/purchaseBuilder": typeof authed_purchaseBuilder;
  businessPurpose: typeof businessPurpose;
  "extraction/apply": typeof extraction_apply;
  "extraction/candidates": typeof extraction_candidates;
  "extraction/jev": typeof extraction_jev;
  "extraction/jobs": typeof extraction_jobs;
  "extraction/pdf": typeof extraction_pdf;
  "extraction/pipeline": typeof extraction_pipeline;
  "extraction/textract": typeof extraction_textract;
  fileSigning: typeof fileSigning;
  files: typeof files;
  purchaseCategories: typeof purchaseCategories;
  purchaseModel: typeof purchaseModel;
  purchaseReadiness: typeof purchaseReadiness;
  purchaseZod: typeof purchaseZod;
  requestView: typeof requestView;
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
