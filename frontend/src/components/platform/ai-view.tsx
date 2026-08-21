import { useEffect, useRef, useState, type FormEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { askAgent, RiskoraApiError } from "@/lib/riskora-api";
import { ErrorState, Panel, ResultBlock, buttonClass, inputClass } from "./ui";

type AgentResponse = Record<string, unknown> & {
  title?: string;
  summary?: string;
  points?: { label?: string; value?: string }[];
  recommendation?: string;
  answer?: string;
  response?: string;
  trace?: unknown;
  evidence?: unknown;
  methodology?: unknown;
};

function Answer({ data }: { data: AgentResponse }) {
  const text = data.summary ?? data.answer ?? data.response;
  const points = Array.isArray(data.points) ? data.points : [];
  const evidence = Array.isArray(data.evidence) ? (data.evidence as unknown[]) : null;

  return (
    <div className="space-y-5 rounded-lg border border-hairline bg-forest p-5">
      {data.title ? <h3 className="text-lg text-foreground">{data.title}</h3> : null}
      {text ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{text}</p>
      ) : null}

      {points.length > 0 ? (
        <ul className="space-y-2.5">
          {points.map((p, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-lime" />
              <span className="text-foreground/90">
                <span className="text-foreground">{p.label}</span>
                {p.label && p.value ? " — " : ""}
                <span className="num">{p.value}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {data.recommendation ? (
        <p className="rounded-md border border-lime/30 bg-forest-raised p-4 text-sm leading-relaxed text-foreground/90">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-lime">
            Recommendation
          </span>
          <span className="mt-2 block">{data.recommendation}</span>
        </p>
      ) : null}

      {evidence ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Evidence sources
          </p>
          <ol className="mt-3 space-y-1.5">
            {evidence.map((e, i) => (
              <li key={i} className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
                <span className="num text-lime">{String(i + 1).padStart(2, "0")}</span>
                <span>{String(e)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "riskora"; data: AgentResponse };

const STARTERS = [
  "Assess borrower B1001 and explain the major factors driving the risk.",
  "What is the current market risk of portfolio P001?",
  "What happens to P001 if we hit a recession?",
  "Show the impact of a 25% equity market decline on B1005.",
];

export function RiskoraAiView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { id: Date.now(), role: "user", text: question }]);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const data = await askAgent<AgentResponse>({ question });
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "riskora", data }]);
    } catch (err) {
      setError(err instanceof RiskoraApiError ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col">
      <div className="border-b border-hairline pb-6">
        <h1 className="text-3xl leading-none text-foreground">Riskora AI</h1>
        <p className="mt-2 text-sm text-muted-foreground">Grounded financial analysis</p>
      </div>

      <div className="flex-1 space-y-6 py-8">
        {empty ? (
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl text-foreground">What would you like to investigate?</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Ask about a borrower, portfolio, or scenario. Riskora connects the question to the
              relevant engine and shows the evidence behind the answer.
            </p>
            <ul className="mt-8 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => setInput(s)}
                    className="h-full w-full rounded-lg border border-hairline bg-forest p-4 text-left text-sm leading-relaxed text-foreground/85 transition-colors hover:border-lime/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-lg rounded-br-sm bg-forest-raised px-4 py-3 text-sm leading-relaxed text-foreground">
                    {m.text}
                  </p>
                </div>
              ) : (
                <article key={m.id} className="space-y-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-lime">
                    Riskora AI
                  </p>
                  <Answer data={m.data} />
                  {m.data.trace ? <Panel title="Agent trace"><ResultBlock data={m.data.trace} /></Panel> : null}
                  {m.data.evidence && !Array.isArray(m.data.evidence) ? (
                    <Panel title="Evidence"><ResultBlock data={m.data.evidence} /></Panel>
                  ) : null}
                  {m.data.methodology ? (
                    <Panel title="Methodology"><ResultBlock data={m.data.methodology} /></Panel>
                  ) : null}
                </article>
              ),
            )}
            {loading ? (
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Riskora is working through the question…
              </p>
            ) : null}
            {error ? <ErrorState message={error} /> : null}
            <div ref={endRef} />
          </div>
        )}
        {empty && error ? (
          <div className="mx-auto max-w-2xl">
            <ErrorState message={error} />
          </div>
        ) : null}
      </div>

      <form
        onSubmit={send}
        className="sticky bottom-0 mx-auto w-full max-w-3xl border-t border-hairline bg-background pb-6 pt-4"
      >
        <div className="flex items-end gap-3">
          <input
            className={inputClass}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a borrower, portfolio, or scenario"
            aria-label="Ask Riskora AI"
          />
          <button type="submit" className={buttonClass} disabled={loading || !input.trim()}>
            <SendHorizontal className="h-4 w-4" aria-hidden="true" />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
