import { useMemo, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from "recharts";
import { ProductReport } from "@/types/report";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart3, Radar as RadarIcon, Minus, SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PRODUCT1_COLOR = "hsl(172 66% 50%)";
const PRODUCT2_COLOR = "hsl(222 47% 45%)";
const DIFF_POSITIVE = "hsl(160 84% 39%)";
const DIFF_NEGATIVE = "hsl(4 90% 58%)";
const DIFF_TIE = "hsl(var(--muted-foreground))";

type ChartView = "bar" | "radar" | "difference";
type SortOption = "name" | "score" | "difference";

type CompareChartsProps = {
  r1: ProductReport;
  r2: ProductReport;
  aspectNames: string[];
};

function buildAspectData(
  aspectNames: string[],
  r1: ProductReport,
  r2: ProductReport
) {
  return aspectNames.map((name) => {
    const a1 = r1.aspects.find((a) => a.name === name);
    const a2 = r2.aspects.find((a) => a.name === name);
    const s1 = a1?.score ?? 0;
    const s2 = a2?.score ?? 0;
    return {
      name,
      aspect: name,
      [r1.productName]: s1,
      [r2.productName]: s2,
      diff: s1 - s2,
      fullMark: 100,
    };
  });
}

function sortAspectData(
  data: ReturnType<typeof buildAspectData>,
  sortBy: SortOption,
  r1: ProductReport,
  r2: ProductReport
) {
  const sorted = [...data];
  if (sortBy === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === "score") {
    sorted.sort(
      (a, b) =>
        Math.max(b[r1.productName], b[r2.productName]) -
        Math.max(a[r1.productName], a[r2.productName])
    );
  } else {
    sorted.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }
  return sorted;
}

export function CompareCharts({ r1, r2, aspectNames }: CompareChartsProps) {
  const [chartView, setChartView] = useState<ChartView>("bar");
  const [sortBy, setSortBy] = useState<SortOption>("difference");
  const [focusedProduct, setFocusedProduct] = useState<string | null>(null);
  const [selectedAspects, setSelectedAspects] = useState<string[] | null>(null); // null = all

  const filteredNames = useMemo(() => {
    if (!selectedAspects || selectedAspects.length === 0) return aspectNames;
    return aspectNames.filter((n) => selectedAspects.includes(n));
  }, [aspectNames, selectedAspects]);

  const aspectData = useMemo(
    () => buildAspectData(filteredNames, r1, r2),
    [filteredNames, r1, r2]
  );

  const sortedBarData = useMemo(
    () => sortAspectData(aspectData, sortBy, r1, r2),
    [aspectData, sortBy, r1, r2]
  );

  const sortedRadarData = useMemo(
    () =>
      sortAspectData(aspectData, sortBy, r1, r2).map((d) => ({
        ...d,
        aspect: d.name,
      })),
    [aspectData, sortBy, r1, r2]
  );

  const differenceData = useMemo(() => {
    const sorted = sortAspectData(aspectData, "difference", r1, r2);
    return sorted.map((d) => ({
      name: d.name,
      value: d.diff,
      leader: d.diff > 0 ? r1.productName : d.diff < 0 ? r2.productName : "Tie",
    }));
  }, [aspectData, r1, r2]);

  const diffDomain = useMemo(() => {
    const values = differenceData.map((d) => d.value);
    const maxAbs = Math.max(100, ...values.map(Math.abs), 1);
    return [-maxAbs, maxAbs];
  }, [differenceData]);

  const toggleAspect = useCallback(
    (name: string) => {
      setSelectedAspects((prev) => {
        const next = prev ?? aspectNames;
        if (next.includes(name)) {
          const filtered = next.filter((n) => n !== name);
          return filtered.length === 0 ? null : filtered;
        }
        return [...next, name];
      });
    },
    [aspectNames]
  );

  const selectAllAspects = useCallback(() => {
    setSelectedAspects(null);
  }, []);

  const showP1 = !focusedProduct || focusedProduct === r1.productName;
  const showP2 = !focusedProduct || focusedProduct === r2.productName;

  const leaderCounts = useMemo(() => {
    let p1 = 0,
      p2 = 0,
      tie = 0;
    aspectData.forEach((d) => {
      if (d.diff > 0) p1++;
      else if (d.diff < 0) p2++;
      else tie++;
    });
    return { p1, p2, tie };
  }, [aspectData]);

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow-lg)",
  };

  const hasData = sortedBarData.length > 0;

  return (
    <div className="space-y-6">
      {/* Live insight line */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 border border-border px-4 py-3">
        <Sparkles className="h-4 w-4 text-accent shrink-0" />
        <span className="text-sm text-foreground">
          <strong>{r1.productName}</strong> leads on{" "}
          <span className="text-pulse-positive font-medium">{leaderCounts.p1}</span>{" "}
          {leaderCounts.p1 === 1 ? "aspect" : "aspects"}
          {" · "}
          <strong>{r2.productName}</strong> leads on{" "}
          <span className="text-pulse-negative font-medium">{leaderCounts.p2}</span>{" "}
          {leaderCounts.p2 === 1 ? "aspect" : "aspects"}
          {leaderCounts.tie > 0 && (
            <>
              {" · "}
              <span className="text-muted-foreground">{leaderCounts.tie} tie</span>
            </>
          )}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={chartView} onValueChange={(v) => setChartView(v as ChartView)}>
          <TabsList className="h-10">
            <TabsTrigger value="bar" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Bar
            </TabsTrigger>
            <TabsTrigger value="radar" className="gap-1.5">
              <RadarIcon className="h-4 w-4" />
              Radar
            </TabsTrigger>
            <TabsTrigger value="difference" className="gap-1.5">
              <Minus className="h-4 w-4" />
              Difference
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[160px] h-10">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="score">Sort: Highest score</SelectItem>
            <SelectItem value="difference">Sort: Biggest gap</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 gap-1.5">
              <SlidersHorizontal className="h-4 w-4" />
              Aspects {selectedAspects ? `(${selectedAspects.length})` : "(all)"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Show aspects</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllAspects}>
                All
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {aspectNames.map((name) => (
                <label
                  key={name}
                  className="flex items-center gap-2 cursor-pointer text-sm text-foreground hover:bg-muted/50 rounded px-2 py-1"
                >
                  <Checkbox
                    checked={!selectedAspects || selectedAspects.includes(name)}
                    onCheckedChange={() => toggleAspect(name)}
                  />
                  {name}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {chartView !== "difference" && (
          <span className="text-xs text-muted-foreground">
            Click legend to focus one product
          </span>
        )}
      </div>

      {/* Chart area */}
      <div className="bg-card rounded-2xl border border-border p-5">
        {!hasData ? (
          <div className="h-[360px] flex items-center justify-center text-muted-foreground text-sm">
            Select at least one aspect in the filter above to see charts.
          </div>
        ) : (
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === "bar" && (
              <BarChart
                data={sortedBarData}
                margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number) => [value, ""]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.name ?? ""
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value) => (
                    <span
                      className={cn(
                        "cursor-pointer select-none transition-opacity",
                        (value === r1.productName && !showP1) ||
                          (value === r2.productName && !showP2)
                          ? "opacity-40"
                          : "opacity-100"
                      )}
                      onClick={() =>
                        setFocusedProduct((p) =>
                          p === value ? null : (value as string)
                        )
                      }
                    >
                      {value}
                      {focusedProduct === value && " (focused)"}
                    </span>
                  )}
                />
                {showP1 && (
                  <Bar
                    dataKey={r1.productName}
                    fill={PRODUCT1_COLOR}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={28}
                    name={r1.productName}
                    isAnimationActive
                  />
                )}
                {showP2 && (
                  <Bar
                    dataKey={r2.productName}
                    fill={PRODUCT2_COLOR}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={28}
                    name={r2.productName}
                    isAnimationActive
                  />
                )}
              </BarChart>
            )}

            {chartView === "radar" && (
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="70%"
                data={sortedRadarData}
              >
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="aspect"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                />
                {showP1 && (
                  <Radar
                    name={r1.productName}
                    dataKey={r1.productName}
                    stroke={PRODUCT1_COLOR}
                    fill={PRODUCT1_COLOR}
                    fillOpacity={0.35}
                    strokeWidth={2}
                    isAnimationActive
                  />
                )}
                {showP2 && (
                  <Radar
                    name={r2.productName}
                    dataKey={r2.productName}
                    stroke={PRODUCT2_COLOR}
                    fill={PRODUCT2_COLOR}
                    fillOpacity={0.35}
                    strokeWidth={2}
                    isAnimationActive
                  />
                )}
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value) => (
                    <span
                      className={cn(
                        "cursor-pointer select-none transition-opacity",
                        (value === r1.productName && !showP1) ||
                          (value === r2.productName && !showP2)
                          ? "opacity-40"
                          : "opacity-100"
                      )}
                      onClick={() =>
                        setFocusedProduct((p) =>
                          p === value ? null : (value as string)
                        )
                      }
                    >
                      {value}
                      {focusedProduct === value && " (focused)"}
                    </span>
                  )}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [value, ""]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.aspect ?? ""
                  }
                />
              </RadarChart>
            )}

            {chartView === "difference" && (
              <BarChart
                data={differenceData}
                layout="vertical"
                margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  type="number"
                  domain={diffDomain}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                  tickFormatter={(v) => (v > 0 ? `+${v}` : String(v))}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "hsl(var(--muted))" }}
                  formatter={(value: number, _name, props: { payload: { leader: string } }) => [
                    `${value > 0 ? "+" : ""}${value} (${props.payload.leader})`,
                    "",
                  ]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.name ?? ""
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  payload={[
                    {
                      value: `${r1.productName} ahead`,
                      type: "square",
                      color: DIFF_POSITIVE,
                    },
                    {
                      value: `${r2.productName} ahead`,
                      type: "square",
                      color: DIFF_NEGATIVE,
                    },
                  ]}
                  formatter={(v) => <span className="text-foreground">{v}</span>}
                />
                <Bar dataKey="value" name="Difference" radius={[0, 4, 4, 0]} maxBarSize={32}>
                  {differenceData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.value > 0
                          ? DIFF_POSITIVE
                          : entry.value < 0
                            ? DIFF_NEGATIVE
                            : DIFF_TIE
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        )}
      </div>
    </div>
  );
}
