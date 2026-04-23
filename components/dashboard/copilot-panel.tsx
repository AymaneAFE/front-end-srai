/**
 * @deprecated This component has been replaced by `CopilotSlideOver` in
 * `./copilot-slideover.tsx`.
 *
 * The old `CopilotPanel` was a pushed-aside panel that reflowed the
 * dashboard KPIs when opened (see design critique point #6 - "AI pushes
 * the work sideways"). It also carried action labels that implied
 * execution (e.g. "Initiate rollback", "Run diagnostics"), contradicting
 * the proposes-never-executes governance in CLAUDE.md section 4.3.
 *
 * Everything it used to do now lives in `CopilotSlideOver`:
 *   - Floating overlay (no layout reflow)
 *   - Markdown rendering via `components/ui/markdown`
 *   - Quick-action labels reworded to reading / drafting verbs
 *   - Footer disclaimer matching the full Copilot page
 *
 * This re-export keeps any stale imports compiling during the transition.
 * Safe to `git rm` once every branch has caught up.
 */
export { CopilotSlideOver as CopilotPanel } from "./copilot-slideover"
