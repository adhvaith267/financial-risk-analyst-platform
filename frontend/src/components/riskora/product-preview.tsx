import { BarChart3, Bot, LayoutDashboard, LineChart, Waves } from "lucide-react";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Credit risk", icon: BarChart3, active: true },
  { label: "Market risk", icon: LineChart },
  { label: "Stress testing", icon: Waves },
  { label: "Riskora AI", icon: Bot },
];

const DRIVERS = [
  { label: "Leverage", weight: 82 },
  { label: "Coverage ratio", weight: 64 },
  { label: "Sector outlook", weight: 47 },
  { label: "Payment history", weight: 31 },
];

/** Static structural preview of the Riskora workspace — layout only, no invented figures. */
export function ProductPreview() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-hairline bg-forest"
      role="img"
      aria-label="Preview of the Riskora workspace: navigation, dashboard summary, risk driver chart, evidence panel and Riskora AI conversation"
    >
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-lime/70" />
        <span className="h-2 w-2 rounded-full bg-mint/25" />
        <span className="h-2 w-2 rounded-full bg-mint/25" />
        <span className="num ml-3 text-[11px] text-muted-foreground">riskora / platform</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
        <div className="hidden flex-col gap-1 border-r border-hairline p-3 sm:flex">
          {NAV.map(({ label, icon: Icon, active }) => (
            <span
              key={label}
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-[12px] ${
                active ? "bg-forest-raised text-lime" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-3">
            {["Exposure", "Expected loss", "Risk grade"].map((label) => (
              <div key={label} className="rounded-md border border-hairline p-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  {label}
                </p>
                <div className="mt-3 h-2 w-3/4 rounded-full bg-mint/20" />
              </div>
            ))}
          </div>

          <div className="rounded-md border border-hairline p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Risk drivers
            </p>
            <div className="mt-3 space-y-2.5">
              {DRIVERS.map((d) => (
                <div key={d.label} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[11px] text-foreground/75">{d.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-forest-raised">
                    <span
                      className="block h-full rounded-full bg-lime/70"
                      style={{ width: `${d.weight}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-hairline p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Evidence
              </p>
              <div className="mt-3 space-y-2">
                <div className="h-1.5 w-full rounded-full bg-mint/15" />
                <div className="h-1.5 w-5/6 rounded-full bg-mint/12" />
                <div className="h-1.5 w-2/3 rounded-full bg-mint/10" />
              </div>
            </div>
            <div className="rounded-md border border-hairline p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Riskora AI
              </p>
              <div className="mt-3 space-y-2">
                <div className="ml-auto h-5 w-2/3 rounded-md bg-forest-raised" />
                <div className="h-1.5 w-full rounded-full bg-mint/15" />
                <div className="h-1.5 w-4/5 rounded-full bg-mint/12" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
