import { describe, it, expect, vi, afterEach } from "vitest";
import type { IRedditClient, RedditPostWithComments } from "../../convex/services/reddit";
import type { IHackerNewsClient, HNStoryWithComments, HNSearchResult, HNComment } from "../../convex/services/hackernews";
import type { IStackOverflowClient, SOQuestionWithAnswers, SOSearchResult, SOAnswer } from "../../convex/services/stackoverflow";
import type { IDevToClient, DevToArticleWithComments, DevToSearchResult, DevToComment } from "../../convex/services/devto";

// Helper to create mock Reddit posts with software-relevant content
function makeRedditResult(id: string, title: string, content: string): RedditPostWithComments {
  return {
    post: {
      id,
      title,
      content,
      author: "test_user",
      subreddit: "software",
      createdAt: "2024-01-15T10:00:00Z",
      permalink: `https://reddit.com/r/software/comments/${id}/test/`,
    },
    comments: [
      {
        id: `c_${id}`,
        content: `Great discussion about ${title} as a software tool`,
        author: "commenter",
        createdAt: "2024-01-15T11:00:00Z",
        permalink: `https://reddit.com/r/software/comments/${id}/test/c_${id}/`,
        postId: id,
      },
    ],
  };
}

describe("searchSoftwareProduct (Reddit)", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("should search product subreddit first, then software subreddits", async () => {
    const searchCalls: string[] = [];

    const mockClient: IRedditClient = {
      searchPosts: vi.fn(),
      fetchComments: vi.fn(),
      searchWithComments: vi.fn().mockImplementation((_query, opts) => {
        searchCalls.push(opts?.subreddit || "global");
        return Promise.resolve([
          makeRedditResult("1", "Notion review app", "This software tool is great"),
        ]);
      }),
    };

    const { searchSoftwareProduct } = await import("../../convex/services/reddit");
    await searchSoftwareProduct(mockClient, "Notion", { postLimit: 5 });

    // First call should be to product-specific subreddit
    expect(searchCalls[0]).toBe("notion");
    // Subsequent calls should be to software subreddits
    expect(searchCalls.length).toBeGreaterThan(1);
  });

  it("should deduplicate posts by ID across searches", async () => {
    const sharedResult = makeRedditResult("shared", "Notion review app", "This software tool is great");

    const mockClient: IRedditClient = {
      searchPosts: vi.fn(),
      fetchComments: vi.fn(),
      searchWithComments: vi.fn().mockResolvedValue([sharedResult]),
    };

    const { searchSoftwareProduct } = await import("../../convex/services/reddit");
    const results = await searchSoftwareProduct(mockClient, "Notion", { postLimit: 20 });

    // Even though multiple searches return the same post, it should appear only once
    const ids = results.map((r) => r.post.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("should stop searching when postLimit is reached", async () => {
    let callCount = 0;
    const mockClient: IRedditClient = {
      searchPosts: vi.fn(),
      fetchComments: vi.fn(),
      searchWithComments: vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(
          Array.from({ length: 5 }, (_, i) =>
            makeRedditResult(`${callCount}_${i}`, "Notion review app", "Great software tool")
          )
        );
      }),
    };

    const { searchSoftwareProduct } = await import("../../convex/services/reddit");
    const results = await searchSoftwareProduct(mockClient, "Notion", { postLimit: 5 });

    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("should gracefully handle product subreddit failure", async () => {
    let firstCall = true;
    const mockClient: IRedditClient = {
      searchPosts: vi.fn(),
      fetchComments: vi.fn(),
      searchWithComments: vi.fn().mockImplementation(() => {
        if (firstCall) {
          firstCall = false;
          return Promise.reject(new Error("Subreddit not found"));
        }
        return Promise.resolve([
          makeRedditResult("1", "Notion review app", "This software tool is great"),
        ]);
      }),
    };

    const { searchSoftwareProduct } = await import("../../convex/services/reddit");
    const results = await searchSoftwareProduct(mockClient, "Notion", { postLimit: 5 });

    // Should still return results from other subreddits
    expect(results.length).toBeGreaterThan(0);
  });

  it("should fall back to unfiltered when too few pass content filter", async () => {
    // Return posts that might not pass isLikelySoftwareContent
    const mockClient: IRedditClient = {
      searchPosts: vi.fn(),
      fetchComments: vi.fn(),
      searchWithComments: vi.fn().mockResolvedValue([
        {
          post: {
            id: "1",
            title: "Random cooking recipe",
            content: "How to make pasta",
            author: "chef",
            subreddit: "cooking",
            createdAt: "2024-01-15T10:00:00Z",
            permalink: "https://reddit.com/r/cooking/comments/1/test/",
          },
          comments: [],
        },
      ]),
    };

    const { searchSoftwareProduct } = await import("../../convex/services/reddit");
    const results = await searchSoftwareProduct(mockClient, "Notion", { postLimit: 5 });

    // Even if nothing matches, should still return results (unfiltered fallback)
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("searchSoftwareProductHN (HackerNews)", () => {
  afterEach(() => {
    vi.resetModules();
  });

  function makeHNResult(id: number, title: string): HNStoryWithComments {
    return {
      story: {
        id,
        title,
        url: null,
        author: "hn_user",
        points: 50,
        numComments: 10,
        createdAt: "2024-01-15T10:00:00Z",
        storyText: `Discussion about ${title} as a software product tool`,
      },
      comments: [
        {
          id: id + 1000,
          text: `I use ${title} daily as an app platform`,
          author: "commenter",
          createdAt: "2024-01-15T11:00:00Z",
          storyId: id,
        },
      ],
    };
  }

  it("should deduplicate stories across search passes", async () => {
    const shared = makeHNResult(100, "Notion review");
    const mockClient: IHackerNewsClient = {
      searchStories: vi.fn().mockResolvedValue({ stories: [shared.story], query: "Notion" } as HNSearchResult),
      fetchComments: vi.fn().mockResolvedValue(shared.comments as HNComment[]),
      searchWithComments: vi.fn().mockResolvedValue([shared]),
    };

    const { searchSoftwareProductHN } = await import("../../convex/services/hackernews");
    const results = await searchSoftwareProductHN(mockClient, "Notion", { storyLimit: 20 });

    const ids = results.map((r) => r.story.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("should respect storyLimit", async () => {
    const stories = Array.from({ length: 15 }, (_, i) => makeHNResult(i, `Notion story ${i} app`));
    const mockClient: IHackerNewsClient = {
      searchStories: vi.fn().mockResolvedValue({ stories: stories.map((s) => s.story), query: "Notion" }),
      fetchComments: vi.fn().mockResolvedValue([]),
      searchWithComments: vi.fn().mockResolvedValue(stories),
    };

    const { searchSoftwareProductHN } = await import("../../convex/services/hackernews");
    const results = await searchSoftwareProductHN(mockClient, "Notion", { storyLimit: 5 });

    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("should handle all search passes failing gracefully", async () => {
    const mockClient: IHackerNewsClient = {
      searchStories: vi.fn().mockRejectedValue(new Error("Network error")),
      fetchComments: vi.fn().mockRejectedValue(new Error("Network error")),
      searchWithComments: vi.fn().mockRejectedValue(new Error("Network error")),
    };

    const { searchSoftwareProductHN } = await import("../../convex/services/hackernews");
    const results = await searchSoftwareProductHN(mockClient, "Notion");

    expect(results).toHaveLength(0);
  });
});

describe("searchSoftwareProductSO (StackOverflow)", () => {
  afterEach(() => {
    vi.resetModules();
  });

  function makeSOResult(id: number, title: string): SOQuestionWithAnswers {
    return {
      question: {
        id,
        title,
        body: `How do I use ${title} as a software tool in my workflow?`,
        author: "so_user",
        score: 10,
        answerCount: 1,
        createdAt: "2024-01-15T10:00:00Z",
        url: `https://stackoverflow.com/questions/${id}`,
        tags: ["notion"],
      },
      answers: [
        {
          id: id + 1000,
          body: `You can use the ${title} api platform integration for this.`,
          author: "so_answerer",
          score: 5,
          isAccepted: true,
          createdAt: "2024-01-16T10:00:00Z",
          questionId: id,
        },
      ],
    };
  }

  it("should deduplicate questions across query variations", async () => {
    const shared = makeSOResult(100, "Notion API");
    const mockClient: IStackOverflowClient = {
      searchQuestions: vi.fn().mockResolvedValue({ questions: [shared.question], query: "Notion" } as SOSearchResult),
      fetchAnswers: vi.fn().mockResolvedValue(shared.answers as SOAnswer[]),
      searchWithAnswers: vi.fn().mockResolvedValue([shared]),
    };

    const { searchSoftwareProductSO } = await import("../../convex/services/stackoverflow");
    const results = await searchSoftwareProductSO(mockClient, "Notion", { questionLimit: 20 });

    const ids = results.map((r) => r.question.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("should respect questionLimit", async () => {
    const questions = Array.from({ length: 15 }, (_, i) => makeSOResult(i, `Notion Q${i} app`));
    const mockClient: IStackOverflowClient = {
      searchQuestions: vi.fn(),
      fetchAnswers: vi.fn(),
      searchWithAnswers: vi.fn().mockResolvedValue(questions),
    };

    const { searchSoftwareProductSO } = await import("../../convex/services/stackoverflow");
    const results = await searchSoftwareProductSO(mockClient, "Notion", { questionLimit: 5 });

    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("should handle all searches failing gracefully", async () => {
    const mockClient: IStackOverflowClient = {
      searchQuestions: vi.fn().mockRejectedValue(new Error("fail")),
      fetchAnswers: vi.fn().mockRejectedValue(new Error("fail")),
      searchWithAnswers: vi.fn().mockRejectedValue(new Error("fail")),
    };

    const { searchSoftwareProductSO } = await import("../../convex/services/stackoverflow");
    const results = await searchSoftwareProductSO(mockClient, "Notion");

    expect(results).toHaveLength(0);
  });

  it("should fall back to unfiltered when too few pass content filter", async () => {
    const irrelevant = {
      question: {
        id: 1,
        title: "How to cook pasta",
        body: "What is the best recipe for pasta?",
        author: "chef",
        score: 5,
        answerCount: 1,
        createdAt: "2024-01-15T10:00:00Z",
        url: "https://stackoverflow.com/questions/1",
        tags: ["cooking"],
      },
      answers: [],
    };

    const mockClient: IStackOverflowClient = {
      searchQuestions: vi.fn(),
      fetchAnswers: vi.fn(),
      searchWithAnswers: vi.fn().mockResolvedValue([irrelevant]),
    };

    const { searchSoftwareProductSO } = await import("../../convex/services/stackoverflow");
    const results = await searchSoftwareProductSO(mockClient, "Notion", { questionLimit: 5 });

    // Even irrelevant results should be returned (unfiltered fallback when < 3 pass filter)
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("searchSoftwareProductDevTo (Dev.to)", () => {
  afterEach(() => {
    vi.resetModules();
  });

  function makeDevToResult(id: number, title: string): DevToArticleWithComments {
    return {
      article: {
        id,
        title,
        description: `An article about ${title} software`,
        body: `This is a detailed review of the ${title} app and its features as a platform tool.`,
        author: "devto_user",
        url: `https://dev.to/user/${id}`,
        publishedAt: "2024-01-15T10:00:00Z",
        positiveReactions: 20,
        commentsCount: 1,
        tags: ["notion"],
      },
      comments: [
        {
          id: id + 1000,
          body: `Great article about ${title} software platform integration`,
          author: "commenter",
          createdAt: "2024-01-16T10:00:00Z",
          articleId: id,
        },
      ],
    };
  }

  it("should deduplicate articles across query variations", async () => {
    const shared = makeDevToResult(100, "Notion");
    const mockClient: IDevToClient = {
      searchArticles: vi.fn().mockResolvedValue({ articles: [shared.article], query: "Notion" } as DevToSearchResult),
      fetchComments: vi.fn().mockResolvedValue(shared.comments as DevToComment[]),
      searchWithComments: vi.fn().mockResolvedValue([shared]),
    };

    const { searchSoftwareProductDevTo } = await import("../../convex/services/devto");
    const results = await searchSoftwareProductDevTo(mockClient, "Notion", { articleLimit: 20 });

    const ids = results.map((r) => r.article.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("should respect articleLimit", async () => {
    const articles = Array.from({ length: 15 }, (_, i) => makeDevToResult(i, `Notion ${i}`));
    const mockClient: IDevToClient = {
      searchArticles: vi.fn(),
      fetchComments: vi.fn(),
      searchWithComments: vi.fn().mockResolvedValue(articles),
    };

    const { searchSoftwareProductDevTo } = await import("../../convex/services/devto");
    const results = await searchSoftwareProductDevTo(mockClient, "Notion", { articleLimit: 5 });

    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("should handle all searches failing gracefully", async () => {
    const mockClient: IDevToClient = {
      searchArticles: vi.fn().mockRejectedValue(new Error("fail")),
      fetchComments: vi.fn().mockRejectedValue(new Error("fail")),
      searchWithComments: vi.fn().mockRejectedValue(new Error("fail")),
    };

    const { searchSoftwareProductDevTo } = await import("../../convex/services/devto");
    const results = await searchSoftwareProductDevTo(mockClient, "Notion");

    expect(results).toHaveLength(0);
  });

  it("should fall back to unfiltered when too few pass content filter", async () => {
    const irrelevant: DevToArticleWithComments = {
      article: {
        id: 1,
        title: "How to cook pasta",
        description: "A cooking guide",
        body: "Step 1: boil water. Step 2: add pasta.",
        author: "chef",
        url: "https://dev.to/chef/pasta",
        publishedAt: "2024-01-15T10:00:00Z",
        positiveReactions: 5,
        commentsCount: 0,
        tags: ["cooking"],
      },
      comments: [],
    };

    const mockClient: IDevToClient = {
      searchArticles: vi.fn(),
      fetchComments: vi.fn(),
      searchWithComments: vi.fn().mockResolvedValue([irrelevant]),
    };

    const { searchSoftwareProductDevTo } = await import("../../convex/services/devto");
    const results = await searchSoftwareProductDevTo(mockClient, "Notion", { articleLimit: 5 });

    expect(results.length).toBeGreaterThan(0);
  });
});
