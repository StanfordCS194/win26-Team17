/**
 * Pre-cached demo reports for MVP (Notion, Figma, Linear).
 * Matches frontend ProductReport shape for dashboard compatibility.
 */

function withGeneratedAt(report) {
  return {
    ...report,
    generatedAt: new Date().toISOString(),
  };
}

const demoReports = {
  notion: {
    productName: "Notion",
    overallScore: 78,
    totalMentions: 847,
    sourcesAnalyzed: 2,
    generatedAt: null,
    summary:
      "Notion enjoys strong positive sentiment for its flexibility and all-in-one workspace approach. Users praise the powerful database features and template ecosystem. However, performance concerns persist, especially with larger workspaces, and the learning curve remains a common pain point for new users.",
    strengths: [
      {
        title: "Flexible All-in-One Workspace",
        description:
          "Users love combining notes, docs, databases, and project management in one tool",
        frequency: 234,
        quotes: [
          {
            text: "Notion replaced 5 different tools for me - Evernote, Trello, Google Docs, Airtable, and even parts of Slack. The flexibility is unmatched.",
            source: "reddit",
            author: "productivitynerd_42",
            date: "2026-01-15",
            url: "https://reddit.com/r/notion/comments/example1",
          },
          {
            text: "The ability to build custom workflows with databases, relations, and rollups is incredibly powerful for our small team.",
            source: "g2",
            author: "Sarah M., Product Manager",
            date: "2026-01-22",
            url: "https://g2.com/products/notion/reviews/example1",
          },
          {
            text: "I've tried Obsidian, Roam, Coda... nothing matches Notion's balance of power and usability for knowledge management.",
            source: "reddit",
            author: "knowledge_worker",
            date: "2026-01-28",
            url: "https://reddit.com/r/productivity/comments/example2",
          },
        ],
      },
      {
        title: "Powerful Database Features",
        description:
          "Database views, relations, formulas, and rollups enable complex workflows",
        frequency: 189,
        quotes: [
          {
            text: "The database functionality is what sets Notion apart. Relations, rollups, formulas - it's like having a no-code Airtable built into your notes app.",
            source: "g2",
            author: "James K., Startup Founder",
            date: "2026-01-18",
            url: "https://g2.com/products/notion/reviews/example2",
          },
          {
            text: "Built our entire company wiki, CRM, and project tracker using Notion databases. Saves us $500/month vs separate tools.",
            source: "reddit",
            author: "bootstrapped_founder",
            date: "2026-02-01",
            url: "https://reddit.com/r/startups/comments/example3",
          },
        ],
      },
      {
        title: "Rich Template Ecosystem",
        description:
          "Community templates and official gallery accelerate setup for common use cases",
        frequency: 156,
        quotes: [
          {
            text: "The template gallery saved me weeks of setup. Found a perfect project management template and customized it in an afternoon.",
            source: "g2",
            author: "Michael R., Agency Owner",
            date: "2026-01-20",
            url: "https://g2.com/products/notion/reviews/example3",
          },
          {
            text: "Love how the Notion community shares templates. r/notion alone has helped me discover workflows I never would have built myself.",
            source: "reddit",
            author: "template_collector",
            date: "2026-01-30",
            url: "https://reddit.com/r/notion/comments/example5",
          },
        ],
      },
    ],
    issues: [
      {
        title: "Performance Issues with Large Workspaces",
        description: "Loading times increase significantly as workspace size grows",
        frequency: 178,
        quotes: [
          {
            text: "Our team workspace has become painfully slow. Pages take 5-10 seconds to load. It's killing our productivity.",
            source: "reddit",
            author: "frustrated_pm",
            date: "2026-01-29",
            url: "https://reddit.com/r/notion/comments/example7",
          },
          {
            text: "Love Notion but the performance degradation with larger databases is a real concern. Had to split our workspace into multiple.",
            source: "g2",
            author: "David L., Engineering Lead",
            date: "2026-01-25",
            url: "https://g2.com/products/notion/reviews/example4",
          },
        ],
      },
      {
        title: "Steep Learning Curve",
        description:
          "New users struggle to understand the block-based system and advanced features",
        frequency: 134,
        quotes: [
          {
            text: "It took me 3 weeks to really 'get' Notion. My team gave up after a few days - too complex compared to simple tools like Todoist.",
            source: "reddit",
            author: "trying_notion",
            date: "2026-01-27",
            url: "https://reddit.com/r/productivity/comments/example9",
          },
        ],
      },
      {
        title: "Limited Offline Functionality",
        description: "Offline mode is unreliable and sync issues cause data concerns",
        frequency: 98,
        quotes: [
          {
            text: "Lost 2 hours of work because offline mode didn't sync properly. Now I'm paranoid and save everything externally first.",
            source: "reddit",
            author: "data_loss_victim",
            date: "2026-01-26",
            url: "https://reddit.com/r/notion/comments/example11",
          },
        ],
      },
    ],
    aspects: [
      { name: "Features", score: 85, mentions: 423, trend: "up" },
      { name: "UX", score: 72, mentions: 312, trend: "stable" },
      { name: "Pricing", score: 68, mentions: 156, trend: "down" },
    ],
  },
  figma: {
    productName: "Figma",
    overallScore: 86,
    totalMentions: 1243,
    sourcesAnalyzed: 2,
    generatedAt: null,
    summary:
      "Figma leads the design tool market with exceptional real-time collaboration and browser-based accessibility. Designers praise the developer handoff features and component systems. Concerns center around pricing after the Adobe acquisition announcement and performance with very large files.",
    strengths: [
      {
        title: "Real-Time Collaboration",
        description:
          "Multiple designers can work on the same file simultaneously with zero conflicts",
        frequency: 387,
        quotes: [
          {
            text: "Figma's multiplayer feature changed how our design team works. We went from version control nightmares to true real-time collaboration.",
            source: "reddit",
            author: "design_lead_sf",
            date: "2026-01-20",
            url: "https://reddit.com/r/figma/comments/example1",
          },
          {
            text: "The fact that I can share a link and have clients comment directly in context is worth the subscription alone.",
            source: "g2",
            author: "Jessica T., UX Designer",
            date: "2026-01-28",
            url: "https://g2.com/products/figma/reviews/example1",
          },
        ],
      },
      {
        title: "Browser-Based Accessibility",
        description: "No downloads required, works on any device with a modern browser",
        frequency: 298,
        quotes: [
          {
            text: "As someone who switches between Mac and Windows daily, Figma being browser-based is essential. No more file format issues.",
            source: "g2",
            author: "Cross-platform designer",
            date: "2026-01-22",
            url: "https://g2.com/products/figma/reviews/example2",
          },
        ],
      },
      {
        title: "Developer Handoff Excellence",
        description:
          "Inspect mode, CSS export, and design tokens streamline design-to-code workflows",
        frequency: 245,
        quotes: [
          {
            text: "Dev Mode in Figma is exactly what we needed. Developers can grab CSS, see spacing, export assets - all self-serve.",
            source: "g2",
            author: "Design Systems Lead",
            date: "2026-01-27",
            url: "https://g2.com/products/figma/reviews/example3",
          },
        ],
      },
    ],
    issues: [
      {
        title: "Pricing Concerns Post-Adobe",
        description:
          "Users worry about price increases and feature paywalls after Adobe acquisition",
        frequency: 201,
        quotes: [
          {
            text: "The Adobe acquisition has me nervous. Already seeing features get locked behind higher tiers.",
            source: "reddit",
            author: "worried_designer",
            date: "2026-01-28",
            url: "https://reddit.com/r/figma/comments/example7",
          },
        ],
      },
      {
        title: "Large File Performance",
        description: "Complex files with many components cause significant lag and crashes",
        frequency: 156,
        quotes: [
          {
            text: "Our design system file has become unusable. 30+ second load times, constant crashes in Chrome.",
            source: "reddit",
            author: "enterprise_designer",
            date: "2026-01-26",
            url: "https://reddit.com/r/figma/comments/example9",
          },
        ],
      },
      {
        title: "Limited Offline Capabilities",
        description:
          "Browser-based approach means no true offline mode for working without internet",
        frequency: 112,
        quotes: [
          {
            text: "The one thing I miss from Sketch: being able to work on a plane without worrying about connectivity.",
            source: "reddit",
            author: "frequent_flyer",
            date: "2026-01-24",
            url: "https://reddit.com/r/figma/comments/example11",
          },
        ],
      },
    ],
    aspects: [
      { name: "Features", score: 91, mentions: 567, trend: "up" },
      { name: "UX", score: 88, mentions: 445, trend: "stable" },
      { name: "Pricing", score: 62, mentions: 289, trend: "down" },
    ],
  },
  linear: {
    productName: "Linear",
    overallScore: 91,
    totalMentions: 634,
    sourcesAnalyzed: 2,
    generatedAt: null,
    summary:
      "Linear has earned exceptional praise for its speed, keyboard-first design, and developer-focused experience. Users consistently highlight the polished UX as a differentiator from Jira and Asana. Minor concerns exist around pricing for smaller teams and feature requests for more advanced reporting.",
    strengths: [
      {
        title: "Lightning Fast Performance",
        description:
          "Instant UI responses and smooth animations make work feel effortless",
        frequency: 245,
        quotes: [
          {
            text: "Linear is stupidly fast. After years of Jira's 3-second page loads, Linear feels like using a native app.",
            source: "reddit",
            author: "jira_refugee",
            date: "2026-01-25",
            url: "https://reddit.com/r/programming/comments/example1",
          },
          {
            text: "The attention to performance is incredible. Every interaction is instant. This is how software should feel.",
            source: "g2",
            author: "Engineering Manager",
            date: "2026-01-29",
            url: "https://g2.com/products/linear/reviews/example1",
          },
        ],
      },
      {
        title: "Keyboard-First Design",
        description:
          "Extensive keyboard shortcuts enable power users to work without touching the mouse",
        frequency: 198,
        quotes: [
          {
            text: "CMD+K in Linear is chef's kiss. Create issues, assign, change status - all without leaving the keyboard.",
            source: "reddit",
            author: "keyboard_warrior",
            date: "2026-01-27",
            url: "https://reddit.com/r/linear/comments/example3",
          },
        ],
      },
      {
        title: "Beautiful, Opinionated UX",
        description: "Clean design and sensible defaults reduce configuration overhead",
        frequency: 176,
        quotes: [
          {
            text: "Linear is proof that B2B software doesn't have to be ugly. Every pixel is considered. It's a joy to use.",
            source: "g2",
            author: "Design-conscious PM",
            date: "2026-01-26",
            url: "https://g2.com/products/linear/reviews/example3",
          },
        ],
      },
    ],
    issues: [
      {
        title: "Pricing for Small Teams",
        description: "Per-seat pricing adds up quickly for bootstrapped startups",
        frequency: 87,
        quotes: [
          {
            text: "$8/user/month adds up when you're a 5-person bootstrapped team. We love Linear but GitHub Projects is free.",
            source: "reddit",
            author: "bootstrapped_cto",
            date: "2026-01-27",
            url: "https://reddit.com/r/startups/comments/example7",
          },
        ],
      },
      {
        title: "Limited Advanced Reporting",
        description:
          "Analytics and custom reporting features lag behind enterprise competitors",
        frequency: 65,
        quotes: [
          {
            text: "Linear's insights are improving but still basic compared to Jira's dashboards. Need better velocity tracking.",
            source: "reddit",
            author: "metrics_pm",
            date: "2026-01-28",
            url: "https://reddit.com/r/linear/comments/example9",
          },
        ],
      },
      {
        title: "Learning Curve for Non-Engineers",
        description:
          "Developer-focused design can feel intimidating to non-technical team members",
        frequency: 54,
        quotes: [
          {
            text: "Our engineering team loves Linear. Marketing and support find it confusing and stick to Asana.",
            source: "reddit",
            author: "cross_functional_pm",
            date: "2026-01-26",
            url: "https://reddit.com/r/productmanagement/comments/example11",
          },
        ],
      },
    ],
    aspects: [
      { name: "Features", score: 88, mentions: 312, trend: "up" },
      { name: "UX", score: 95, mentions: 287, trend: "stable" },
      { name: "Pricing", score: 71, mentions: 98, trend: "stable" },
    ],
  },
};

const suggestions = [
  "Notion",
  "Figma",
  "Linear",
  "Slack",
  "Airtable",
  "Stripe",
];

/** Normalize product name to cache key (e.g. "Notion" -> "notion") */
function toProductKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Get cached demo report by key, or null. Always sets generatedAt. */
export function getCachedReport(key) {
  const report = demoReports[key];
  if (!report) return null;
  return withGeneratedAt(report);
}

/** Get report: cached for notion/figma/linear, otherwise generic. */
export function getReport(productName) {
  const key = toProductKey(productName);
  const cached = getCachedReport(key);
  if (cached) return cached;
  return buildGenericReport(productName);
}

/** Build a generic report for products without cached data (demo placeholder). */
export function buildGenericReport(productName) {
  const name = (productName || "Unknown").trim() || "Unknown";
  return withGeneratedAt({
    productName: name,
    overallScore: 62 + Math.floor(Math.random() * 20),
    totalMentions: 100 + Math.floor(Math.random() * 400),
    sourcesAnalyzed: 2,
    generatedAt: null,
    summary: `Based on our analysis of public feedback about ${name}, we found a mix of positive sentiment around core features and some areas for improvement. Users appreciate the product's functionality but have noted opportunities for enhancement in user experience and pricing.`,
    strengths: [
      {
        title: "Core Feature Quality",
        description: "Users consistently praise the main functionality",
        frequency: 50 + Math.floor(Math.random() * 50),
        quotes: [
          {
            text: `${name} does what it promises really well. The core features are solid and reliable.`,
            source: "reddit",
            author: "satisfied_user",
            date: "2026-01-28",
            url: "https://reddit.com/r/software/comments/example",
          },
          {
            text: "Been using this for 6 months now and it's become essential to my workflow.",
            source: "g2",
            author: "Power User",
            date: "2026-01-25",
            url: "https://g2.com/products/example/reviews",
          },
          {
            text: "Compared alternatives and this one consistently delivers on its promises.",
            source: "reddit",
            author: "comparison_reviewer",
            date: "2026-01-30",
            url: "https://reddit.com/r/productivity/comments/example",
          },
        ],
      },
      {
        title: "Ease of Setup",
        description: "Quick onboarding and intuitive initial experience",
        frequency: 30 + Math.floor(Math.random() * 50),
        quotes: [
          {
            text: "Got started in under 10 minutes. Very straightforward setup process.",
            source: "g2",
            author: "Quick Starter",
            date: "2026-01-27",
            url: "https://g2.com/products/example/reviews",
          },
          {
            text: "The onboarding flow is really well designed. Felt productive immediately.",
            source: "reddit",
            author: "new_user_review",
            date: "2026-01-29",
            url: "https://reddit.com/r/software/comments/example",
          },
        ],
      },
      {
        title: "Responsive Support",
        description: "Customer support team is helpful and responsive",
        frequency: 20 + Math.floor(Math.random() * 40),
        quotes: [
          {
            text: "Had an issue and support resolved it within hours. Really impressed.",
            source: "g2",
            author: "Happy Customer",
            date: "2026-01-26",
            url: "https://g2.com/products/example/reviews",
          },
        ],
      },
    ],
    issues: [
      {
        title: "Pricing Concerns",
        description: "Some users find the pricing model could be more flexible",
        frequency: 40 + Math.floor(Math.random() * 40),
        quotes: [
          {
            text: "Great product but the per-seat pricing adds up quickly for larger teams.",
            source: "reddit",
            author: "budget_conscious",
            date: "2026-01-29",
            url: "https://reddit.com/r/startups/comments/example",
          },
          {
            text: "Wish there was a more affordable tier for small teams or startups.",
            source: "g2",
            author: "Startup Founder",
            date: "2026-01-27",
            url: "https://g2.com/products/example/reviews",
          },
        ],
      },
      {
        title: "Feature Requests",
        description: "Users have identified specific features they'd like to see",
        frequency: 30 + Math.floor(Math.random() * 30),
        quotes: [
          {
            text: "Love the core product but really need better integration options.",
            source: "reddit",
            author: "integration_seeker",
            date: "2026-01-28",
            url: "https://reddit.com/r/software/comments/example",
          },
        ],
      },
      {
        title: "Mobile Experience",
        description: "Mobile app or responsive experience could be improved",
        frequency: 20 + Math.floor(Math.random() * 30),
        quotes: [
          {
            text: "Desktop experience is great but the mobile app feels like an afterthought.",
            source: "reddit",
            author: "mobile_user",
            date: "2026-01-26",
            url: "https://reddit.com/r/software/comments/example",
          },
        ],
      },
    ],
    aspects: [
      { name: "Features", score: 65 + Math.floor(Math.random() * 25), mentions: 100 + Math.floor(Math.random() * 100), trend: "up" },
      { name: "UX", score: 70 + Math.floor(Math.random() * 20), mentions: 80 + Math.floor(Math.random() * 70), trend: "stable" },
      { name: "Pricing", score: 55 + Math.floor(Math.random() * 25), mentions: 50 + Math.floor(Math.random() * 50), trend: "stable" },
    ],
  });
}

export function getSuggestions() {
  return suggestions;
}
