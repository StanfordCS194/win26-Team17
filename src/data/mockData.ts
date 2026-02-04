export interface Quote {
  text: string;
  source: "reddit" | "g2";
  author: string;
  date: string;
  url: string;
}

export interface Insight {
  title: string;
  description: string;
  frequency: number;
  quotes: Quote[];
}

export interface AspectScore {
  name: string;
  score: number;
  mentions: number;
  trend: "up" | "down" | "stable";
}

export interface ProductReport {
  productName: string;
  overallScore: number;
  totalMentions: number;
  sourcesAnalyzed: number;
  generatedAt: string;
  summary: string;
  strengths: Insight[];
  issues: Insight[];
  aspects: AspectScore[];
}

export const mockReports: Record<string, ProductReport> = {
  notion: {
    productName: "Notion",
    overallScore: 78,
    totalMentions: 847,
    sourcesAnalyzed: 2,
    generatedAt: new Date().toISOString(),
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
          {
            text: "Database templates have been a game-changer. Set up once, replicate everywhere.",
            source: "reddit",
            author: "notion_power_user",
            date: "2026-01-25",
            url: "https://reddit.com/r/notion/comments/example4",
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
          {
            text: "Started using Notion for personal stuff, now I sell templates on Gumroad as a side hustle. The ecosystem is real.",
            source: "reddit",
            author: "creator_economy",
            date: "2026-02-02",
            url: "https://reddit.com/r/notion/comments/example6",
          },
        ],
      },
    ],
    issues: [
      {
        title: "Performance Issues with Large Workspaces",
        description:
          "Loading times increase significantly as workspace size grows",
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
          {
            text: "Offline mode is basically useless - sync takes forever and often fails. Desktop app is just an Electron wrapper.",
            source: "reddit",
            author: "remote_worker",
            date: "2026-02-01",
            url: "https://reddit.com/r/notion/comments/example8",
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
          {
            text: "The flexibility is both a blessing and curse. You spend more time setting up systems than actually doing work.",
            source: "g2",
            author: "Anna P., Marketing Manager",
            date: "2026-01-23",
            url: "https://g2.com/products/notion/reviews/example5",
          },
          {
            text: "Onboarding new team members to Notion is painful. Every person has their own mental model of how things should be organized.",
            source: "reddit",
            author: "team_lead_struggles",
            date: "2026-01-31",
            url: "https://reddit.com/r/notion/comments/example10",
          },
        ],
      },
      {
        title: "Limited Offline Functionality",
        description:
          "Offline mode is unreliable and sync issues cause data concerns",
        frequency: 98,
        quotes: [
          {
            text: "Lost 2 hours of work because offline mode didn't sync properly. Now I'm paranoid and save everything externally first.",
            source: "reddit",
            author: "data_loss_victim",
            date: "2026-01-26",
            url: "https://reddit.com/r/notion/comments/example11",
          },
          {
            text: "For a 'productivity' tool, the offline experience is embarrassingly bad. Essential for anyone who works on planes or in areas with spotty internet.",
            source: "g2",
            author: "Travel-heavy PM",
            date: "2026-02-02",
            url: "https://g2.com/products/notion/reviews/example6",
          },
          {
            text: "The promise of 'work anywhere' falls flat when you open Notion on the subway and get a loading spinner.",
            source: "reddit",
            author: "commuter_rant",
            date: "2026-01-28",
            url: "https://reddit.com/r/notion/comments/example12",
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
    generatedAt: new Date().toISOString(),
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
          {
            text: "Cursor chat + audio in Figma eliminated 80% of our design sync meetings. Game changer for remote teams.",
            source: "reddit",
            author: "remote_design_team",
            date: "2026-02-01",
            url: "https://reddit.com/r/figma/comments/example2",
          },
        ],
      },
      {
        title: "Browser-Based Accessibility",
        description:
          "No downloads required, works on any device with a modern browser",
        frequency: 298,
        quotes: [
          {
            text: "As someone who switches between Mac and Windows daily, Figma being browser-based is essential. No more file format issues.",
            source: "g2",
            author: "Cross-platform designer",
            date: "2026-01-22",
            url: "https://g2.com/products/figma/reviews/example2",
          },
          {
            text: "Love that developers can open designs without installing anything. Removes so much friction from handoff.",
            source: "reddit",
            author: "frontend_dev",
            date: "2026-01-25",
            url: "https://reddit.com/r/webdev/comments/example3",
          },
          {
            text: "Switched from Sketch and never looked back. Browser = always updated, always accessible.",
            source: "reddit",
            author: "ex_sketch_user",
            date: "2026-01-30",
            url: "https://reddit.com/r/figma/comments/example4",
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
          {
            text: "The VS Code integration lets me see designs right in my editor. Figma understands developers better than any design tool.",
            source: "reddit",
            author: "react_developer",
            date: "2026-02-02",
            url: "https://reddit.com/r/reactjs/comments/example5",
          },
          {
            text: "Design tokens export has made our design system actually maintainable. Finally, single source of truth.",
            source: "reddit",
            author: "design_systems_nerd",
            date: "2026-01-29",
            url: "https://reddit.com/r/figma/comments/example6",
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
            text: "The Adobe acquisition has me nervous. Already seeing features get locked behind higher tiers. Classic embrace-extend-extinguish.",
            source: "reddit",
            author: "worried_designer",
            date: "2026-01-28",
            url: "https://reddit.com/r/figma/comments/example7",
          },
          {
            text: "Dev Mode being a separate paid seat feels like the beginning of Adobe-style nickel and diming.",
            source: "g2",
            author: "Startup Designer",
            date: "2026-01-30",
            url: "https://g2.com/products/figma/reviews/example4",
          },
          {
            text: "Loved Figma because it WASN'T Adobe. Now I'm looking at Penpot and other alternatives just in case.",
            source: "reddit",
            author: "adobe_refugee",
            date: "2026-02-01",
            url: "https://reddit.com/r/design/comments/example8",
          },
        ],
      },
      {
        title: "Large File Performance",
        description:
          "Complex files with many components cause significant lag and crashes",
        frequency: 156,
        quotes: [
          {
            text: "Our design system file has become unusable. 30+ second load times, constant 'Aw, Snap!' crashes in Chrome.",
            source: "reddit",
            author: "enterprise_designer",
            date: "2026-01-26",
            url: "https://reddit.com/r/figma/comments/example9",
          },
          {
            text: "Had to split our product into multiple files because performance tanked. Defeats the purpose of 'everything in one place'.",
            source: "g2",
            author: "Product Design Manager",
            date: "2026-01-29",
            url: "https://g2.com/products/figma/reviews/example5",
          },
          {
            text: "Memory usage is insane - regularly see 8GB+ for a single tab. My laptop fans sound like a jet engine.",
            source: "reddit",
            author: "laptop_on_fire",
            date: "2026-02-02",
            url: "https://reddit.com/r/figma/comments/example10",
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
          {
            text: "Desktop app is just a wrapper - still needs internet. Real offline mode would make Figma perfect.",
            source: "g2",
            author: "Rural designer",
            date: "2026-01-27",
            url: "https://g2.com/products/figma/reviews/example6",
          },
          {
            text: "Lost work during an internet outage. Browser-based is great until it isn't.",
            source: "reddit",
            author: "outage_victim",
            date: "2026-01-31",
            url: "https://reddit.com/r/figma/comments/example12",
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
    generatedAt: new Date().toISOString(),
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
          {
            text: "Switched our 40-person eng team from Jira. Productivity increased measurably just from not waiting on tool loading.",
            source: "reddit",
            author: "eng_director",
            date: "2026-02-01",
            url: "https://reddit.com/r/startups/comments/example2",
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
          {
            text: "Finally a PM tool built for developers. Keyboard shortcuts for everything means I can triage 50 issues in the time Jira loads one.",
            source: "g2",
            author: "Staff Engineer",
            date: "2026-01-30",
            url: "https://g2.com/products/linear/reviews/example2",
          },
          {
            text: "The Vim-style keybindings are *muah*. Linear clearly understands their audience.",
            source: "reddit",
            author: "vim_enthusiast",
            date: "2026-02-02",
            url: "https://reddit.com/r/linear/comments/example4",
          },
        ],
      },
      {
        title: "Beautiful, Opinionated UX",
        description:
          "Clean design and sensible defaults reduce configuration overhead",
        frequency: 176,
        quotes: [
          {
            text: "Linear is proof that B2B software doesn't have to be ugly. Every pixel is considered. It's a joy to use.",
            source: "g2",
            author: "Design-conscious PM",
            date: "2026-01-26",
            url: "https://g2.com/products/linear/reviews/example3",
          },
          {
            text: "The opinionated workflow (Backlog → Todo → In Progress → Done) just works. No 6-month Jira configuration project needed.",
            source: "reddit",
            author: "pragmatic_pm",
            date: "2026-01-28",
            url: "https://reddit.com/r/productmanagement/comments/example5",
          },
          {
            text: "Showed Linear to my non-technical CEO and she immediately understood it. Try that with Jira.",
            source: "reddit",
            author: "startup_cto",
            date: "2026-01-31",
            url: "https://reddit.com/r/startups/comments/example6",
          },
        ],
      },
    ],
    issues: [
      {
        title: "Pricing for Small Teams",
        description:
          "Per-seat pricing adds up quickly for bootstrapped startups",
        frequency: 87,
        quotes: [
          {
            text: "$8/user/month adds up when you're a 5-person bootstrapped team. We love Linear but GitHub Projects is free.",
            source: "reddit",
            author: "bootstrapped_cto",
            date: "2026-01-27",
            url: "https://reddit.com/r/startups/comments/example7",
          },
          {
            text: "Wish there was a startup tier. We're pre-revenue but want Linear's UX. Hard to justify the cost.",
            source: "g2",
            author: "Early-stage founder",
            date: "2026-01-29",
            url: "https://g2.com/products/linear/reviews/example4",
          },
          {
            text: "The free tier is very limited. Would love more seats for early-stage teams to get hooked.",
            source: "reddit",
            author: "indie_hacker",
            date: "2026-02-01",
            url: "https://reddit.com/r/indiehackers/comments/example8",
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
          {
            text: "Would love custom report builders. Current analytics are good for small teams but lack depth for 100+ eng orgs.",
            source: "g2",
            author: "Enterprise PM",
            date: "2026-01-30",
            url: "https://g2.com/products/linear/reviews/example5",
          },
          {
            text: "The cycle reports are nice but I need to export to spreadsheets for any serious analysis.",
            source: "reddit",
            author: "data_driven_lead",
            date: "2026-02-02",
            url: "https://reddit.com/r/linear/comments/example10",
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
          {
            text: "The Cycles concept took our non-technical PMs a while to grok. Great for sprints, less intuitive for others.",
            source: "g2",
            author: "PM Coach",
            date: "2026-01-31",
            url: "https://g2.com/products/linear/reviews/example6",
          },
          {
            text: "Wish there were different view modes for different personas. Engineers love the density, execs want higher-level views.",
            source: "reddit",
            author: "scaling_startup",
            date: "2026-02-01",
            url: "https://reddit.com/r/linear/comments/example12",
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

export const suggestedProducts = [
  "Notion",
  "Figma",
  "Linear",
  "Slack",
  "Airtable",
  "Stripe",
];
