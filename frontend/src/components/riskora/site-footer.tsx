import { Github, Mail } from "lucide-react";
import { RiskoraLogo } from "./logo";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-hairline bg-forest-deep">
      <div className="mx-auto flex max-w-[78rem] flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
        {/* Brand + copyright */}
        <div className="flex flex-col gap-2">
          <RiskoraLogo />
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            © {year} Riskora. All rights reserved.
          </p>
        </div>

        {/* Contact, social and legal in one row */}
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-foreground/80"
        >
          <a
            href="mailto:adhvaith.gv@gmail.com"
            className="inline-flex items-center gap-2 transition-colors hover:text-lime"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Contact
          </a>

          <a
            href="https://github.com/"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Riskora on GitHub"
            className="inline-flex items-center gap-2 transition-colors hover:text-lime"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
            GitHub
          </a>

          <span className="hidden h-4 w-px bg-hairline md:block" aria-hidden="true" />

          <a href="#top" className="transition-colors hover:text-lime">
            Terms of use
          </a>
          <a href="#top" className="transition-colors hover:text-lime">
            Privacy
          </a>
          <a href="#top" className="transition-colors hover:text-lime">
            Disclaimer
          </a>
        </nav>
      </div>
    </footer>
  );
}
