import { action } from "./_generated/server";
import { v } from "convex/values";
import { searchPosts, fetchComments } from "./services/reddit";

/**
 * Test action to verify Reddit RSS works from Convex server
 * Run from Convex dashboard: npx convex run testReddit:search '{"query": "notion"}'
 */
export const search = action({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (_ctx, args) => {
    const result = await searchPosts(args.query, { limit: args.limit || 5 });
    return {
      success: true,
      postCount: result.posts.length,
      posts: result.posts.map((p) => ({
        title: p.title,
        author: p.author,
        subreddit: p.subreddit,
        preview: p.content.slice(0, 100) + "...",
      })),
    };
  },
});

export const comments = action({
  args: { permalink: v.string(), limit: v.optional(v.number()) },
  handler: async (_ctx, args) => {
    const result = await fetchComments(args.permalink, { limit: args.limit || 10 });
    return {
      success: true,
      commentCount: result.length,
      comments: result.map((c) => ({
        author: c.author,
        preview: c.content.slice(0, 100) + "...",
      })),
    };
  },
});
