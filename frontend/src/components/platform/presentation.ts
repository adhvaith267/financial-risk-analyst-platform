export const inputClass =
  "w-full rounded-md border border-input bg-forest-deep px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const buttonClass =
  "inline-flex items-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-px disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const ghostButtonClass =
  "inline-flex items-center gap-2 rounded-md border border-hairline-strong px-4 py-2 text-sm text-foreground transition-colors hover:bg-forest-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const money = (value: number, digits = 2) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const pct = (value: number, digits = 2) => `${(value * 100).toFixed(digits)}%`;

export const asMoney = (value: unknown) =>
  typeof value === "number"
    ? money(value)
    : value === undefined || value === null
      ? "—"
      : String(value);

export const asPct = (value: unknown, digits = 2) =>
  typeof value === "number"
    ? pct(value, digits)
    : value === undefined || value === null
      ? "—"
      : String(value);
