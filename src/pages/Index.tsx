import { useState, useEffect } from "react";
import Header from "@/components/Header";
import SearchHero from "@/components/SearchHero";
import LoadingState from "@/components/LoadingState";
import Dashboard from "@/components/Dashboard";
import { mockReports, ProductReport } from "@/data/mockData";

type ViewState = "search" | "loading" | "dashboard";

const Index = () => {
  const [view, setView] = useState<ViewState>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [report, setReport] = useState<ProductReport | null>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setView("loading");

    // Simulate API call - check if we have mock data for this product
    setTimeout(() => {
      const normalizedQuery = query.toLowerCase();
      const matchedReport = mockReports[normalizedQuery];

      if (matchedReport) {
        setReport(matchedReport);
      } else {
        // Generate a basic report for unknown products
        setReport({
          productName: query,
          overallScore: Math.floor(Math.random() * 30) + 60,
          totalMentions: Math.floor(Math.random() * 500) + 100,
          sourcesAnalyzed: 2,
          generatedAt: new Date().toISOString(),
          summary: `Based on our analysis of public feedback about ${query}, we found a mix of positive sentiment around core features and some areas for improvement. Users appreciate the product's functionality but have noted opportunities for enhancement in user experience and pricing.`,
          strengths: [
            {
              title: "Core Feature Quality",
              description: "Users consistently praise the main functionality",
              frequency: Math.floor(Math.random() * 100) + 50,
              quotes: [
                {
                  text: `${query} does what it promises really well. The core features are solid and reliable.`,
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
              frequency: Math.floor(Math.random() * 80) + 30,
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
                {
                  text: "Recommended to my team because the learning curve is so manageable.",
                  source: "reddit",
                  author: "team_lead",
                  date: "2026-02-01",
                  url: "https://reddit.com/r/startups/comments/example",
                },
              ],
            },
            {
              title: "Responsive Support",
              description: "Customer support team is helpful and responsive",
              frequency: Math.floor(Math.random() * 60) + 20,
              quotes: [
                {
                  text: "Had an issue and support resolved it within hours. Really impressed.",
                  source: "g2",
                  author: "Happy Customer",
                  date: "2026-01-26",
                  url: "https://g2.com/products/example/reviews",
                },
                {
                  text: "The support team actually knows their product. Rare these days!",
                  source: "reddit",
                  author: "support_experience",
                  date: "2026-01-28",
                  url: "https://reddit.com/r/software/comments/example",
                },
                {
                  text: "Documentation is good but when I needed help, the team was there.",
                  source: "reddit",
                  author: "docs_reader",
                  date: "2026-01-30",
                  url: "https://reddit.com/r/productivity/comments/example",
                },
              ],
            },
          ],
          issues: [
            {
              title: "Pricing Concerns",
              description: "Some users find the pricing model could be more flexible",
              frequency: Math.floor(Math.random() * 80) + 40,
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
                {
                  text: "The free tier is too limited to really evaluate the product properly.",
                  source: "reddit",
                  author: "trial_user",
                  date: "2026-01-31",
                  url: "https://reddit.com/r/software/comments/example",
                },
              ],
            },
            {
              title: "Feature Requests",
              description: "Users have identified specific features they'd like to see",
              frequency: Math.floor(Math.random() * 60) + 30,
              quotes: [
                {
                  text: "Love the core product but really need better integration options.",
                  source: "reddit",
                  author: "integration_seeker",
                  date: "2026-01-28",
                  url: "https://reddit.com/r/software/comments/example",
                },
                {
                  text: "The roadmap looks promising but some features have been 'coming soon' for too long.",
                  source: "g2",
                  author: "Patient User",
                  date: "2026-01-30",
                  url: "https://g2.com/products/example/reviews",
                },
                {
                  text: "Would pay more for better API access and automation capabilities.",
                  source: "reddit",
                  author: "power_user_needs",
                  date: "2026-02-01",
                  url: "https://reddit.com/r/productivity/comments/example",
                },
              ],
            },
            {
              title: "Mobile Experience",
              description: "Mobile app or responsive experience could be improved",
              frequency: Math.floor(Math.random() * 50) + 20,
              quotes: [
                {
                  text: "Desktop experience is great but the mobile app feels like an afterthought.",
                  source: "reddit",
                  author: "mobile_user",
                  date: "2026-01-26",
                  url: "https://reddit.com/r/software/comments/example",
                },
                {
                  text: "Need to be able to do more than just view on mobile.",
                  source: "g2",
                  author: "On-the-go PM",
                  date: "2026-01-29",
                  url: "https://g2.com/products/example/reviews",
                },
                {
                  text: "The mobile web version is usable but definitely not optimized.",
                  source: "reddit",
                  author: "tablet_user",
                  date: "2026-01-31",
                  url: "https://reddit.com/r/productivity/comments/example",
                },
              ],
            },
          ],
          aspects: [
            {
              name: "Features",
              score: Math.floor(Math.random() * 25) + 65,
              mentions: Math.floor(Math.random() * 200) + 100,
              trend: "up" as const,
            },
            {
              name: "UX",
              score: Math.floor(Math.random() * 20) + 70,
              mentions: Math.floor(Math.random() * 150) + 80,
              trend: "stable" as const,
            },
            {
              name: "Pricing",
              score: Math.floor(Math.random() * 25) + 55,
              mentions: Math.floor(Math.random() * 100) + 50,
              trend: "stable" as const,
            },
          ],
        });
      }

      setView("dashboard");
    }, 4500);
  };

  const handleBack = () => {
    setView("search");
    setReport(null);
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {view === "search" && (
        <SearchHero onSearch={handleSearch} isLoading={false} />
      )}

      {view === "loading" && <LoadingState productName={searchQuery} />}

      {view === "dashboard" && report && (
        <Dashboard report={report} onBack={handleBack} />
      )}
    </div>
  );
};

export default Index;
