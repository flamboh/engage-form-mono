/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as authed_demo from "../authed/demo.js";
import type * as authed_extension from "../authed/extension.js";
import type * as authed_helpers from "../authed/helpers.js";
import type * as authed_purchaseBuilder from "../authed/purchaseBuilder.js";
import type * as internal_purchaseAutosave from "../internal/purchaseAutosave.js";
import type * as purchaseModel from "../purchaseModel.js";
import type * as purchaseValidators from "../purchaseValidators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "authed/demo": typeof authed_demo;
  "authed/extension": typeof authed_extension;
  "authed/helpers": typeof authed_helpers;
  "authed/purchaseBuilder": typeof authed_purchaseBuilder;
  "internal/purchaseAutosave": typeof internal_purchaseAutosave;
  purchaseModel: typeof purchaseModel;
  purchaseValidators: typeof purchaseValidators;
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

export declare const components: {
  debouncer: import("@ikhrustalev/convex-debouncer/_generated/component.js").ComponentApi<"debouncer">;
};
