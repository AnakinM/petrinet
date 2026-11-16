/** The value of `data-prerendered` on the root element of the pre-built guide. */
export const PRERENDER_MARK = "guide";

/**
 * The mark that the build puts on the root element of the pre-built guide. It lives apart from
 * {@link GuideDocument} so the browser loads this check without the build-only page rewriting.
 */
export class PrerenderMark {
  /** Whether `root` already holds the pre-built guide, so the browser should hydrate it. */
  static isOn(root: HTMLElement): boolean {
    return root.dataset.prerendered === PRERENDER_MARK;
  }
}
