import type { JSX, ReactNode } from "react";
import { Analytics } from "@/lib/analytics";
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
    <footer className="shrink-0 border-line border-t px-3 py-2">
      <FooterLink href={GUIDE_URL} label="Guide">
        <BookIcon />
      </FooterLink>
      <FooterLink
        href={REPO_URL}
        label="GitHub"
        onClick={() => Analytics.track("Outbound link", { target: "github" })}
      >
        <GitHubIcon />
      </FooterLink>
      <FooterLink
        href={NEW_ISSUE_URL}
        label="Report an issue"
        onClick={() => Analytics.track("Outbound link", { target: "issue" })}
      >
        <BugIcon />
      </FooterLink>
    </footer>
  );
}

function FooterLink({
  href,
  label,
  onClick,
  children,
}: {
  href: string;
  label: string;
  onClick?: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <a
      href={href}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded px-1 py-1 text-fg-subtle text-sm hover:bg-surface-muted hover:text-fg-soft"
    >
      {children}
      {label}
    </a>
  );
}
