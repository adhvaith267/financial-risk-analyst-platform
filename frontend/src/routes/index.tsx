import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, BarChart3, Bot, LineChart, MoveRight, Waves } from "lucide-react";
import { SiteHeader } from "@/components/riskora/site-header";
import { SiteFooter } from "@/components/riskora/site-footer";
import { ProductPreview } from "@/components/riskora/product-preview";
import { CursorAura } from "@/components/riskora/cursor-aura";

export const Route = createFileRoute("/")({
  component: Landing,
});

const CAPABILITIES = [
  {
    id: "credit",
    icon: BarChart3,
    title: "Credit Risk",
    copy: "Understand borrower exposure through probability of default, loss given default, exposure at default, expected loss, and risk drivers.",
  },
  {
    id: "market",
    icon: LineChart,
    title: "Market Risk",
    copy: "Review portfolio volatility, value at risk, expected shortfall, drawdown, concentration, and market sensitivity.",
  },
  {
    id: "stress",
    icon: Waves,
    title: "Stress Testing",
    copy: "Model recession, equity, interest-rate, foreign-exchange, and combined shocks to understand how exposure changes under pressure.",
  },
  {
    id: "ai",
    icon: Bot,
    title: "Riskora AI",
    copy: "Ask questions in plain language and receive grounded explanations connected to the relevant engine and evidence.",
  },
];

const STEPS = [
  { n: "01", title: "Frame the question", copy: "Choose a borrower, portfolio, or scenario." },
  { n: "02", title: "Run the engine", copy: "Use the relevant credit, market, or stress engine." },
  {
    n: "03",
    title: "Understand the drivers",
    copy: "Review assumptions, evidence, methodology, and what changed.",
  },
  {
    n: "04",
    title: "Decide with context",
    copy: "Use Riskora AI to connect the analysis to the next decision.",
  },
];

const PRINCIPLES = [
  {
    title: "Grounded",
    copy: "Every result is connected to a calculation, input, or source context.",
  },
  {
    title: "Explainable",
    copy: "Drivers, assumptions, and methodology remain visible behind each assessment.",
  },
  {
    title: "Actionable",
    copy: "Move from exposure to scenario impact and the next decision without losing context.",
  },
];

function Landing() {
  return (
    <div id="top" className="relative min-h-screen bg-background">
      <div className="page-aura" aria-hidden="true">
        <span className="aura-grid" />
        <CursorAura />
      </div>

      <SiteHeader />

      <main className="relative z-10">
        {/* Hero ------------------------------------------------------- */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-[78rem] px-5 py-20 sm:px-8 sm:py-28">
            <div className="rise max-w-3xl">
              <p className="eyebrow">Financial risk intelligence</p>
              <h1 className="mt-6 text-[clamp(3rem,7vw,5.5rem)] font-bold leading-[1.02] text-lime">
                Riskora
              </h1>
              <p className="mt-2 text-[clamp(1.75rem,3.6vw,2.75rem)] font-medium leading-[1.1] text-foreground">
                makes risk clear.
              </p>
              <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                Risk decisions become difficult when signals are scattered, calculations are hard to
                explain, and scenario analysis is disconnected from current exposure. Riskora brings
                credit, market, stress, and AI-assisted analysis into one connected workspace.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-md border border-hairline-strong px-5 py-3 text-sm text-foreground transition-colors hover:bg-forest-raised"
                >
                  Explore Riskora
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* About ------------------------------------------------------ */}
        <section id="about" className="surface-pale">
          <div className="mx-auto max-w-[78rem] px-5 py-24 sm:px-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-forest">
              01 / About Riskora
            </p>
            <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <h2 className="max-w-md text-[clamp(2rem,3.6vw,3rem)] leading-[1.08] text-forest-deep">
                Risk intelligence for decisions that carry weight.
              </h2>
              <div className="space-y-5 text-[15px] leading-relaxed text-forest/85">
                <p>
                  Riskora is a connected financial risk workspace for teams that need to understand
                  exposure before they act. It brings deterministic risk engines and a grounded AI
                  analyst together so every assessment can move from signal to explanation to
                  decision.
                </p>
                <p>
                  Instead of forcing teams to move between disconnected tools, Riskora creates one
                  operating view across borrower risk, portfolio risk, market movement, and scenario
                  impact.
                </p>
              </div>
            </div>

            <dl className="mt-20 grid gap-10 border-t border-forest/15 pt-10 md:grid-cols-3 md:gap-0">
              {PRINCIPLES.map((p, i) => (
                <div key={p.title} className={i > 0 ? "md:border-l md:border-forest/15 md:pl-10" : "md:pr-10"}>
                  <dt className="font-display text-2xl text-forest-deep">{p.title}</dt>
                  <dd className="mt-3 text-sm leading-relaxed text-forest/75">{p.copy}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Capabilities ----------------------------------------------- */}
        <section id="capabilities" className="border-b border-hairline">
          <div className="mx-auto max-w-[78rem] px-5 py-24 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
              <div>
                <p className="eyebrow">02 / The platform</p>
                <h2 className="mt-6 text-[clamp(2rem,3.6vw,3rem)] leading-[1.08]">
                  One workspace. Every angle of risk.
                </h2>
              </div>
              <p className="text-[15px] leading-relaxed text-muted-foreground lg:pb-2">
                Riskora connects focused risk engines with one consistent analytical experience.
              </p>
            </div>

            <ul className="mt-16 border-t border-hairline">
              {CAPABILITIES.map(({ id, icon: Icon, title, copy }) => (
                <li key={id} className="border-b border-hairline">
                  <Link
                    to="/platform"
                    className="group grid gap-4 py-8 transition-colors hover:bg-forest/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:grid-cols-[3rem_minmax(0,15rem)_minmax(0,1fr)_11rem] md:items-center md:gap-8 md:px-4"
                  >
                    <Icon className="h-6 w-6 text-lime" aria-hidden="true" />
                    <span className="font-display text-2xl text-foreground">{title}</span>
                    <span className="text-sm leading-relaxed text-muted-foreground">{copy}</span>
                    <span className="inline-flex items-center gap-2 text-sm text-lime md:justify-end">
                      Explore in platform
                      <MoveRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works ----------------------------------------------- */}
        <section id="how-it-works" className="border-b border-hairline bg-forest/40">
          <div className="mx-auto max-w-[78rem] px-5 py-24 sm:px-8">
            <p className="eyebrow">03 / How it works</p>
            <h2 className="mt-6 max-w-lg text-[clamp(2rem,3.6vw,3rem)] leading-[1.08]">
              From signal to decision.
            </h2>

            <ol className="mt-16 grid gap-10 border-t border-hairline-strong pt-10 md:grid-cols-4 md:gap-0">
              {STEPS.map((s, i) => (
                <li
                  key={s.n}
                  className={`relative rise ${i > 0 ? "md:border-l md:border-hairline md:pl-8" : ""} md:pr-8`}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <span className="absolute -top-[3.05rem] left-0 hidden h-1.5 w-1.5 rounded-full bg-lime md:block" />
                  <p className="num text-sm text-lime">{s.n}</p>
                  <h3 className="mt-3 text-xl text-foreground">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.copy}</p>
                </li>
              ))}
            </ol>

            <div className="mt-20">
              <ProductPreview />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
