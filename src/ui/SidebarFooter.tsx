import type { JSX, ReactNode } from "react";
import { BookIcon, BugIcon, GitHubIcon } from "@/ui/icons";

const GUIDE_URL = "/guide";
const REPO_URL = "https://github.com/AnakinM/petrinet";
const NEW_ISSUE_URL = "https://github.com/AnakinM/petrinet/issues/new";

/**
 * Pinned left-sidebar footer: muted GitHub + report-an-issue links. Rendered as a `shrink-0`
 * sibling after the scrolling (`flex-1`) PropertiesPanel, so it stays anchored to the bottom of
 * the aside in both Build and Simulate. A top border separates it from the properties above.
 */
export function SidebarFooter(): JSX.Element {
  return (
    <footer className="shrink-0 border-slate-200 border-t px-3 py-2">
      <FooterLink href={GUIDE_URL} label="Guide">
        <BookIcon />
      </FooterLink>
      <FooterLink href={REPO_URL} label="GitHub">
        <GitHubIcon />
      </FooterLink>
      <FooterLink href={NEW_ISSUE_URL} label="Report an issue">
        <BugIcon />
      </FooterLink>
    </footer>
  );
}

function FooterLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded px-1 py-1 text-slate-500 text-sm hover:bg-slate-100 hover:text-slate-700"
    >
      {children}
      {label}
    </a>
  );
}
