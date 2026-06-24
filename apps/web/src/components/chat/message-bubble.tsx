"use client";

import { useState, useCallback } from "react";
import {
  User,
  Bot,
  Sparkles,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn, Badge, Avatar, AvatarFallback } from "@flowmind/ui";
import type { Message } from "@/hooks/chat-store";

interface MessageBubbleProps {
  message: Message;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="group relative my-2 rounded-lg border border-border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
        <span className="text-[11px] text-muted-foreground font-mono">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-accent transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-sm">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 text-sm font-mono text-foreground">
      {children}
    </code>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolCallSection({ toolCalls }: { toolCalls: NonNullable<Message["toolCalls"]> }) {
  const [expanded, setExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState<Record<string, boolean>>({});

  if (!toolCalls.length) return null;

  return (
    <div className="mt-3 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Terminal className="h-3.5 w-3.5" />
        <span>{toolCalls.length} tool call{toolCalls.length > 1 ? "s" : ""}</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
      {expanded && (
        <div className="space-y-2 pl-4 border-l-2 border-border">
          {toolCalls.map((tc) => (
            <div key={tc.id} className="text-xs">
              <div className="flex items-center gap-1.5 text-foreground font-medium mb-1">
                <Terminal className="h-3 w-3 text-primary" />
                <span>{tc.name}</span>
              </div>
              <div className="mb-1 rounded bg-muted/50 p-2 font-mono text-muted-foreground">
                {tc.arguments}
              </div>
              {tc.result && (
                <>
                  <button
                    onClick={() =>
                      setResultExpanded((prev) => ({
                        ...prev,
                        [tc.id]: !prev[tc.id],
                      }))
                    }
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors mb-1"
                  >
                    {resultExpanded[tc.id] ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Result
                  </button>
                  {resultExpanded[tc.id] && (
                    <div className="rounded bg-muted/50 p-2 font-mono text-muted-foreground">
                      {tc.result}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`)|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    if (m[1]) {
      parts.push(<InlineCode key={m.index}>{m[1].slice(1, -1)}</InlineCode>);
    } else if (m[2]) {
      parts.push(<strong key={m.index} className="font-semibold">{m[3]}</strong>);
    } else if (m[4]) {
      parts.push(<em key={m.index}>{m[5]}</em>);
    } else if (m[6]) {
      parts.push(
        <a
          key={m.index}
          href={m[8]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {m[7]}
        </a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
}

function renderPlainText(text: string): React.ReactNode {
  const parts = renderInline(text);
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

interface BlockPosition {
  start: number;
  end: number;
  node: React.ReactNode;
}

function extractCodeBlocks(content: string): { blocks: BlockPosition[]; text: string } {
  const blocks: BlockPosition[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(content)) !== null) {
    blocks.push({
      start: m.index,
      end: m.index + m[0].length,
      node: <CodeBlock key={`cb-${m.index}`} code={m[2] ?? ""} language={m[1] || undefined} />,
    });
  }

  return { blocks, text: content };
}

function extractTableBlocks(
  content: string,
  excludeRanges: Array<{ start: number; end: number }>
): BlockPosition[] {
  const blocks: BlockPosition[] = [];
  const regex = /^\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)*)/gm;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(content)) !== null) {
    const inExcluded = excludeRanges.some(
      (r) => m!.index >= r.start && m!.index < r.end
    );
    if (inExcluded) continue;

    const headers = (m[1] ?? "").split("|").map((h) => h.trim()).filter(Boolean);
    const rows: string[][] = [];
    const rowLines = (m[2] ?? "").trim().split("\n");
    for (const line of rowLines) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length) rows.push(cells);
    }

    blocks.push({
      start: m.index,
      end: m.index + m[0].length,
      node: <Table key={`tbl-${m.index}`} headers={headers} rows={rows} />,
    });
  }

  return blocks;
}

function processTextBlock(text: string, idx: number): React.ReactNode | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const headingMatch = trimmed.match(/^(#{1,3})\s/);
  if (headingMatch) {
    const level = headingMatch[1]!.length;
    const content = trimmed.replace(/^#{1,3}\s/, "");
    const Tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
    return (
      <Tag key={`h-${idx}`} className="font-semibold mt-4 mb-2 text-foreground first:mt-0">
        {renderPlainText(content)}
      </Tag>
    );
  }

  return (
    <p key={`p-${idx}`} className="text-foreground leading-relaxed">
      {renderPlainText(trimmed)}
    </p>
  );
}

function processListBlock(
  lines: string[],
  startIdx: number
): { node: React.ReactNode; consumed: number } {
  const items: string[] = [];
  const firstLine = lines[startIdx] ?? "";
  const isOrdered = /^\d+\.\s/.test(firstLine);
  let i = startIdx;

  while (i < lines.length) {
    const line = lines[i]!;
    if (/^\d+\.\s/.test(line) || /^[-*]\s/.test(line)) {
      items.push(line.replace(/^\d+\.\s|^[-*]\s/, ""));
      i++;
    } else {
      break;
    }
  }

  const ListTag = isOrdered ? "ol" : "ul";
  const node = (
    <ListTag
      key={`list-${startIdx}`}
      className={`my-2 pl-6 ${isOrdered ? "list-decimal" : "list-disc"} space-y-1`}
    >
      {items.map((item, j) => (
        <li key={j} className="text-foreground leading-relaxed">
          {renderPlainText(item)}
        </li>
      ))}
    </ListTag>
  );

  return { node, consumed: i - startIdx };
}

function renderMarkdown(content: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];

  const codeBlocks = extractCodeBlocks(content);
  const excludeRanges = codeBlocks.blocks.map((b) => ({ start: b.start, end: b.end }));
  const tableBlocks = extractTableBlocks(content, excludeRanges);

  const allBlocks = [...codeBlocks.blocks, ...tableBlocks].sort(
    (a, b) => a.start - b.start
  );

  const lines = content.split("\n");

  function processLines(
    sourceLines: string[],
    lineOffset: number
  ): React.ReactNode[] {
    const result: React.ReactNode[] = [];
    let i = 0;
    while (i < sourceLines.length) {
      const line = sourceLines[i]!;
      if (/^\d+\.\s/.test(line) || /^[-*]\s/.test(line)) {
        const res = processListBlock(sourceLines, i);
        result.push(res.node);
        i += res.consumed;
      } else if (line.trim()) {
        const node = processTextBlock(line, lineOffset + i);
        if (node) result.push(node);
        i++;
      } else {
        i++;
      }
    }
    return result;
  }

  if (allBlocks.length === 0) {
    return processLines(lines, 0);
  }

  let cursor = 0;
  for (const block of allBlocks) {
    if (block.start > cursor) {
      const text = content.slice(cursor, block.start);
      const sectionLines = text.split("\n");
      blocks.push(...processLines(sectionLines, cursor));
    }
    blocks.push(block.node);
    cursor = block.end;
  }

  if (cursor < content.length) {
    const text = content.slice(cursor);
    const sectionLines = text.split("\n");
    blocks.push(...processLines(sectionLines, cursor));
  }

  return blocks;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex gap-3 max-w-[85%] px-4 py-3 rounded-2xl",
          isUser ? "bg-primary/10" : "bg-surface border border-border"
        )}
      >
        {!isUser && (
          <Avatar className="h-8 w-8 mt-0.5">
            <AvatarFallback
              className={
                isAssistant
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }
            >
              {isAssistant ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <Terminal className="h-4 w-4" />
              )}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-foreground">
              {isUser ? "You" : isAssistant ? "FlowMind" : message.role === "system" ? "System" : "Tool"}
            </span>
            {isAssistant && (
              <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                AI
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {formatTime(message.timestamp)}
            </span>
          </div>

          <div className="space-y-1 text-sm">
            {renderMarkdown(message.content)}
          </div>

          {message.toolCalls && message.toolCalls.length > 0 && (
            <ToolCallSection toolCalls={message.toolCalls} />
          )}
        </div>

        {isUser && (
          <Avatar className="h-8 w-8 mt-0.5 order-last">
            <AvatarFallback className="bg-primary/20 text-primary">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
