import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Bot, LayoutDashboard, LineChart, Waves } from "lucide-react";
import { RiskoraLogo } from "@/components/riskora/logo";
import { DashboardView } from "@/components/platform/dashboard-view";
import { CreditRiskView } from "@/components/platform/credit-view";
import { MarketRiskView } from "@/components/platform/market-view";
import { StressTestingView } from "@/components/platform/stress-view";
import { RiskoraAiView } from "@/components/platform/ai-view";
import type { PlatformView } from "@/components/platform/types";

export const Route = createFileRoute("/platform")({
  component: Platform,
});

const NAV: { id: PlatformView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "credit", label: "Credit risk", icon: BarChart3 },
  { id: "market", label: "Market risk", icon: LineChart },
  { id: "stress", label: "Stress testing", icon: Waves },
  { id: "ai", label: "Riskora AI", icon: Bot },
];

function Platform() {
  const [view, setView] = useState<PlatformView>("dashboard");

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="border-b border-hairline bg-forest-deep lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="px-5 py-5">
          <Link to="/" aria-label="Riskora home" className="inline-block">
            <RiskoraLogo subtitle="Workspace home" />
          </Link>
        </div>

        <nav aria-label="Platform views" className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setView(id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  active
                    ? "bg-forest-raised text-lime"
                    : "text-muted-foreground hover:bg-forest hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8">
        {view === "dashboard" ? <DashboardView onNavigate={setView} /> : null}
        {view === "credit" ? <CreditRiskView /> : null}
        {view === "market" ? <MarketRiskView /> : null}
        {view === "stress" ? <StressTestingView /> : null}
        {view === "ai" ? <RiskoraAiView /> : null}
      </main>
    </div>
  );
}
