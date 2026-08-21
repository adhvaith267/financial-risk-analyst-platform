import { Link } from "@tanstack/react-router";
import { Mail, PanelsTopLeft } from "lucide-react";
import { RiskoraLogo } from "./logo";

const NAV = [
  { label: "Home", href: "#top" },
  { label: "About", href: "#about" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "How it works", href: "#how-it-works" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[78rem] items-center justify-between gap-6 px-5 sm:px-8">
        <Link to="/" aria-label="Riskora home" className="shrink-0">
          <RiskoraLogo />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="relative text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href="mailto:adhvaith.gv@gmail.com"
            className="hidden items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Contact
          </a>
          <Link
            to="/platform"
            className="inline-flex items-center gap-2 rounded-md bg-lime px-3.5 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <PanelsTopLeft className="h-4 w-4" aria-hidden="true" />
            Open platform
          </Link>
        </div>
      </div>
    </header>
  );
}
