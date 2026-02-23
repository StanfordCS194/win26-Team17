/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as pipeline from "../pipeline.js";
import type * as reports from "../reports.js";
import type * as services_contentFilter from "../services/contentFilter.js";
import type * as services_devto from "../services/devto.js";
import type * as services_g2 from "../services/g2.js";
import type * as services_gemini from "../services/gemini.js";
import type * as services_hackernews from "../services/hackernews.js";
import type * as services_reddit from "../services/reddit.js";
import type * as services_stackoverflow from "../services/stackoverflow.js";
import type * as testReddit from "../testReddit.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  pipeline: typeof pipeline;
  reports: typeof reports;
  "services/contentFilter": typeof services_contentFilter;
  "services/devto": typeof services_devto;
  "services/g2": typeof services_g2;
  "services/gemini": typeof services_gemini;
  "services/hackernews": typeof services_hackernews;
  "services/reddit": typeof services_reddit;
  "services/stackoverflow": typeof services_stackoverflow;
  testReddit: typeof testReddit;
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
