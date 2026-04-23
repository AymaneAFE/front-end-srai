import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Minimal, dependency-free markdown renderer tuned for the Copilot chat
 * surface. The backend replies include **bold**, `inline code`, fenced ```
 * code blocks, and ordered/unordered lists. Before this component they were
 * rendered with `whitespace-pre-wrap`, which dumps the asterisks and backticks
 * as literal characters — giving the assistant a distinctly "raw model
 * output" look that undermined trust.
 *
 * We deliberately stop short of a full markdown pipeline. The attack surface
 * for an assistant rendering arbitrary user-controlled markdown in a
 * security-adjacent UI (incident response) is large enough that we restrict
 * the grammar to what the copilot actually emits. If the content ever needs
 * links, tables, or images, swap this for `react-markdown` with `rehype-sanitize`.
 */

type InlineNode = React.ReactNode

function renderInline(text: string, keyPrefix: string): InlineNode[] {
  // Tokenise by `code` and **bold** without regex backrefs that trip SSR.
  const parts: InlineNode[] = []
  let remaining = text
  let counter = 0
  while (remaining.length) {
    // Inline code first — its delimiters are unambiguous.
    const code = remaining.match(/`([^`]+)`/)
    const bold = remaining.match(/\*\*([^*]+)\*\*/)
    // Pick whichever comes first.
    const match = (() => {
      if (code && bold) return code.index! <= bold.index! ? { m: code, kind: "code" as const } : { m: bold, kind: "bold" as const }
      if (code) return { m: code, kind: "code" as const }
      if (bold) return { m: bold, kind: "bold" as const }
      return null
    })()
    if (!match) {
      parts.push(remaining)
      break
    }
    const before = remaining.slice(0, match.m.index!)
    if (before) parts.push(before)
    const inner = match.m[1]
    const k = `${keyPrefix}-${counter++}`
    parts.push(
      match.kind === "code" ? (
        <code
          key={k}
          className="rounded px-1 py-0.5 text-[0.85em] font-mono bg-muted text-foreground"
        >
          {inner}
        </code>
      ) : (
        <strong key={k} className="font-semibold text-foreground">
          {inner}
        </strong>
      ),
    )
    remaining = remaining.slice(match.m.index! + match.m[0].length)
  }
  return parts
}

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  const lines = content.split("\n")
  const blocks: React.ReactNode[] = []

  let i = 0
  let blockIdx = 0
  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block.
    if (line.trim().startsWith("```")) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i])
        i++
      }
      i++ // consume closing fence (or EOF)
      blocks.push(
        <pre
          key={`pre-${blockIdx++}`}
          className="rounded-md bg-muted px-3 py-2 text-xs font-mono overflow-x-auto my-2 text-foreground"
        >
          <code>{buf.join("\n")}</code>
        </pre>,
      )
      continue
    }

    // Unordered list.
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""))
        i++
      }
      blocks.push(
        <ul
          key={`ul-${blockIdx++}`}
          className="list-disc pl-5 my-1.5 space-y-0.5"
        >
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `li-${idx}`)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // Ordered list.
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""))
        i++
      }
      blocks.push(
        <ol
          key={`ol-${blockIdx++}`}
          className="list-decimal pl-5 my-1.5 space-y-0.5"
        >
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `oi-${idx}`)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // Blank line — paragraph break.
    if (line.trim() === "") {
      i++
      continue
    }

    // Paragraph: collapse consecutive non-empty non-list lines.
    const para: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("```")
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push(
      <p key={`p-${blockIdx++}`} className="my-1 leading-relaxed">
        {renderInline(para.join(" "), `p-${blockIdx}`)}
      </p>,
    )
  }

  return (
    <div className={cn("text-sm text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      {blocks}
    </div>
  )
}
