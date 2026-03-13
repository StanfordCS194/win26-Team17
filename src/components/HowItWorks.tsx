import {
  Search,
  Filter,
  Tags,
  Calculator,
  FileText,
  Database,
  ArrowDown,
  ChevronDown,
  MessageSquare,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Mock data representing the visual flow                            */
/* ------------------------------------------------------------------ */

const mockMentions = [
  { text: "The UI is super intuitive, switched from Jira last month", source: "Reddit", sentiment: "positive" as const },
  { text: "Pricing is way too high for small teams", source: "HackerNews", sentiment: "negative" as const },
  { text: "Rock solid -- haven't had a single crash in 2 years", source: "Stack Overflow", sentiment: "positive" as const },
  { text: "Not worth the price compared to free alternatives", source: "Dev.to", sentiment: "negative" as const },
];

const mockLabeled = [
  { text: "The UI is super intuitive...", score: 82, aspects: ["Usability"], sentiment: "positive" as const },
  { text: "Pricing is way too high...", score: 22, aspects: ["Price"], sentiment: "negative" as const },
  { text: "Rock solid -- no crashes...", score: 91, aspects: ["Quality", "Durability"], sentiment: "positive" as const },
  { text: "Not worth the price...", score: 18, aspects: ["Price"], sentiment: "negative" as const },
];

const sentimentColor = {
  positive: "border-pulse-positive/40 bg-pulse-positive-light",
  negative: "border-pulse-negative/40 bg-pulse-negative-light",
  neutral: "border-border bg-secondary",
};

const sentimentDot = {
  positive: "bg-pulse-positive",
  negative: "bg-pulse-negative",
  neutral: "bg-pulse-neutral",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const HowItWorks = () => {
  return (
    <section className="px-4 pb-20 pt-8">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">
          How It Works
        </h2>
        <p className="text-muted-foreground text-center mb-14">
          From product name to actionable intelligence in six stages
        </p>

        {/* ============================================= */}
        {/*  STAGE 1 -- Collect                           */}
        {/* ============================================= */}
        <div className="relative">
          {/* Stage header */}
          <StageHeader icon={Search} number={1} title="Collect" subtitle="Search multiple platforms for product discussions" />

          {/* Visual: single query fans out to multiple sources */}
          <div className="mt-6 flex flex-col items-center">
            {/* Search pill */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-card border border-border shadow-sm">
              <Search className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-foreground">notion</span>
            </div>

            {/* Fan-out arrow */}
            <div className="flex justify-center mt-3 mb-3">
              <ChevronDown className="w-5 h-5 text-accent" />
            </div>

            {/* Source platform cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-3xl">
              {[
                { name: "Reddit", detail: "Subreddits, posts, comments" },
                { name: "HackerNews", detail: "Stories and discussions" },
                { name: "Stack Overflow", detail: "Questions and answers" },
                { name: "Dev.to", detail: "Articles and comments" },
              ].map((src) => (
                <div key={src.name} className="bg-card rounded-lg border border-border px-4 py-3 text-center">
                  <div className="text-xs text-foreground font-semibold">{src.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{src.detail}</div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground mt-2">All sources fetched in parallel</p>

            {/* Fan-in arrow */}
            <div className="flex justify-center mt-3 mb-3">
              <ChevronDown className="w-5 h-5 text-accent" />
            </div>

            {/* Raw mentions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {mockMentions.map((m, i) => (
                <div key={i} className="bg-card rounded-lg border border-border px-3 py-2.5 flex gap-2 items-start">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-foreground leading-relaxed truncate">{m.text}</p>
                    <span className="text-[10px] text-muted-foreground">{m.source}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Raw posts and comments collected</p>
          </div>

          <StageDivider />

          {/* ============================================= */}
          {/*  STAGE 2 -- Deduplicate                       */}
          {/* ============================================= */}
          <StageHeader icon={Filter} number={2} title="Deduplicate" subtitle="Remove near-identical and short content" />

          <div className="mt-6 flex flex-col items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {mockMentions.map((m, i) => {
                const isDupe = i === 3;
                return (
                  <div
                    key={i}
                    className={`rounded-lg border px-3 py-2.5 flex gap-2 items-start transition-opacity ${
                      isDupe
                        ? "bg-pulse-negative-light border-pulse-negative/20 opacity-50 line-through"
                        : "bg-card border-border"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-foreground leading-relaxed truncate">{m.text}</p>
                      {isDupe && <span className="text-[10px] text-pulse-negative font-medium">Overlaps with mention #2</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Exact matches, substring overlaps, and short text filtered out</p>
          </div>

          <StageDivider />

          {/* ============================================= */}
          {/*  STAGE 3 -- Classify (parallel fan-out)       */}
          {/* ============================================= */}
          <StageHeader icon={Tags} number={3} title="Classify" subtitle="LLM labels each mention in parallel" />

          <div className="mt-6 flex flex-col items-center">
            {/* Parallel processing visual */}
            <div className="w-full max-w-3xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {mockLabeled.slice(0, 3).map((m, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    {/* Input mention (compact) */}
                    <div className="bg-card rounded-lg border border-border px-3 py-2 w-full">
                      <p className="text-xs text-muted-foreground truncate">{m.text}</p>
                    </div>

                    {/* Processing arrow */}
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="text-[10px] text-accent font-medium px-2 py-0.5 rounded bg-accent/10">
                        LLM
                      </div>
                      <ArrowDown className="w-3.5 h-3.5 text-accent" />
                    </div>

                    {/* Output: labeled card */}
                    <div className={`rounded-lg border px-3 py-2.5 w-full ${sentimentColor[m.sentiment]}`}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className={`w-2 h-2 rounded-full ${sentimentDot[m.sentiment]}`} />
                        <span className="text-xs font-semibold text-foreground">{m.score}/100</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{m.sentiment}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {m.aspects.map((a) => (
                          <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* "and more" indicator */}
              <div className="flex justify-center mt-3">
                <span className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                  ... all mentions classified in parallel batches of 10
                </span>
              </div>
            </div>
          </div>

          <StageDivider />

          {/* ============================================= */}
          {/*  STAGE 4 -- Score (fan-in / aggregate)        */}
          {/* ============================================= */}
          <StageHeader icon={Calculator} number={4} title="Score" subtitle="Deterministic formulas on classified data -- no LLM" />

          <div className="mt-6 flex flex-col items-center">
            {/* Convergence visual: labeled mentions -> formulas -> scores */}
            <div className="w-full max-w-3xl">
              {/* Small mention pills converging */}
              <div className="flex justify-center gap-2 flex-wrap mb-3">
                {mockLabeled.map((m, i) => (
                  <div key={i} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${sentimentColor[m.sentiment]}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${sentimentDot[m.sentiment]}`} />
                    <span className="text-[10px] font-medium text-foreground">{m.score}</span>
                  </div>
                ))}
                <span className="inline-flex items-center text-[10px] text-muted-foreground">... +46 more</span>
              </div>

              <div className="flex justify-center mb-3">
                <ArrowDown className="w-4 h-4 text-accent" />
              </div>

              {/* Formula cards in 2x2 grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormulaCard
                  title="Overall Score"
                  formula="50 + ((pos - neg) / total) x 50"
                  example="50 + ((36 - 12) / 60) x 50 = 70"
                  result="70"
                  colorClass="text-pulse-positive"
                  scale={["0", "50", "100"]}
                  scaleLabels={["Negative", "Neutral", "Positive"]}
                />
                <FormulaCard
                  title="Aspect Scores"
                  formula="Same formula, scoped per aspect"
                  aspects={["Price", "Quality", "Durability", "Usability"]}
                  example="Price: 50 + ((14 - 4) / 20) x 50 = 75"
                  result="75"
                  colorClass="text-pulse-positive"
                />
                <FormulaCard
                  title="Issue Radar"
                  formula="(mentions / total) x (100 - score)"
                  example="(40 / 100) x (100 - 25) = 30"
                  result="30"
                  colorClass="text-pulse-negative"
                  note="Frequent + negative = high radar score"
                />
                <FormulaCard
                  title="Data Confidence"
                  formula="coverage x agreement x diversity"
                  example="1.0 x 0.75 x 0.75 = 56%"
                  result="56%"
                  colorClass="text-accent"
                  note="Coverage: enough data per aspect. Agreement: sentiment consistency. Diversity: unique authors."
                />
              </div>
            </div>
          </div>

          <StageDivider />

          {/* ============================================= */}
          {/*  STAGE 5 -- Synthesize                        */}
          {/* ============================================= */}
          <StageHeader icon={FileText} number={5} title="Synthesize" subtitle="LLM generates narrative from scores + quotes" />

          <div className="mt-6 flex flex-col items-center">
            <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Input side */}
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Input</div>
                <div className="space-y-1.5 text-xs text-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Classified mentions with quotes
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Pre-computed scores
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Aspect breakdown
                  </div>
                </div>
              </div>

              {/* Output side */}
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Output</div>
                <div className="space-y-2">
                  <div className="bg-secondary/70 rounded-lg px-3 py-2">
                    <span className="text-[10px] text-muted-foreground">Executive Summary</span>
                    <p className="text-xs text-foreground mt-0.5">2-3 sentence overview of the product sentiment...</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-pulse-positive-light rounded-lg px-2.5 py-2 border border-pulse-positive/20">
                      <span className="text-[10px] text-pulse-positive font-medium">Strengths</span>
                      <p className="text-[10px] text-foreground mt-0.5">2-4 themes with linked quotes</p>
                    </div>
                    <div className="flex-1 bg-pulse-negative-light rounded-lg px-2.5 py-2 border border-pulse-negative/20">
                      <span className="text-[10px] text-pulse-negative font-medium">Issues</span>
                      <p className="text-[10px] text-foreground mt-0.5">2-4 themes with linked quotes</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <StageDivider />

          {/* ============================================= */}
          {/*  STAGE 6 -- Assemble                          */}
          {/* ============================================= */}
          <StageHeader icon={Database} number={6} title="Assemble" subtitle="Everything saved as your final report" />

          <div className="mt-6 flex flex-col items-center">
            <div className="bg-card rounded-xl border-2 border-accent/30 shadow-glow p-5 w-full max-w-lg text-center">
              <div className="text-sm font-semibold text-foreground mb-3">Your Report</div>
              <div className="flex flex-wrap justify-center gap-2 text-[10px]">
                {[
                  "Overall Score",
                  "Aspect Scores",
                  "Issue Radar",
                  "Confidence",
                  "Executive Summary",
                  "Strengths + Quotes",
                  "Issues + Quotes",
                  "Source Breakdown",
                ].map((item) => (
                  <span key={item} className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-medium">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StageHeader({ icon: Icon, number, title, subtitle }: {
  icon: typeof Search;
  number: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-accent-foreground" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-accent font-semibold">Stage {number}</span>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function StageDivider() {
  return (
    <div className="flex flex-col items-center my-6">
      <div className="w-px h-6 bg-border" />
      <ArrowDown className="w-4 h-4 text-accent" />
      <div className="w-px h-6 bg-border" />
    </div>
  );
}

function FormulaCard({ title, formula, example, result, colorClass, scale, scaleLabels, aspects, note }: {
  title: string;
  formula: string;
  example: string;
  result: string;
  colorClass: string;
  scale?: string[];
  scaleLabels?: string[];
  aspects?: string[];
  note?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">{title}</h4>
        <span className={`text-lg font-bold ${colorClass}`}>{result}</span>
      </div>
      <div className="bg-secondary/70 rounded-md px-3 py-1.5 mb-2">
        <code className="text-[11px] text-foreground">{formula}</code>
      </div>
      <div className="bg-secondary/40 rounded-md px-3 py-1.5 mb-2">
        <code className="text-[10px] text-muted-foreground">{example}</code>
      </div>
      {scale && scaleLabels && (
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          {scale.map((s, i) => (
            <span key={s}>{s} {scaleLabels[i]}</span>
          ))}
        </div>
      )}
      {aspects && (
        <div className="flex flex-wrap gap-1 mt-1">
          {aspects.map((a) => (
            <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">{a}</span>
          ))}
        </div>
      )}
      {note && <p className="text-[10px] text-muted-foreground mt-1">{note}</p>}
    </div>
  );
}

export default HowItWorks;
