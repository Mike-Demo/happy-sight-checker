import type { ReactNode } from "react";

import { SiteFooter, WebAwesomeLoader } from "@/design-system/font-awsome-web-awesome-171158";

/**
 * Shared page frame. Mounts the Web Awesome element loader inside routed
 * content (not the root route) and ships the standard site footer once.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell wa-cloak">
      <WebAwesomeLoader />
      <main className="app-shell__main">{children}</main>
      <SiteFooter />
    </div>
  );
}
