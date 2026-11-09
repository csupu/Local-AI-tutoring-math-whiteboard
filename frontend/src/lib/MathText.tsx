/** Minimal Markdown-lite + KaTeX renderer for AI tutor messages. */

import katex from 'katex';
import 'katex/dist/katex.min.css';

type Part =
  | { kind: 'block'; value: string }
  | { kind: 'inline'; value: string }
  | { kind: 'text'; value: string };

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function richText(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  out = out.replace(/\n/g, '<br/>');
  return out;
}

function blockHtml(m: string): string {
  try {
    return katex.renderToString(m, { displayMode: true, throwOnError: false });
  } catch {
    return `<span class="katex-error">${escapeHtml(m)}</span>`;
  }
}

function inlineHtml(m: string): string {
  try {
    return katex.renderToString(m, { displayMode: false, throwOnError: false });
  } catch {
    return `<span class="katex-error">${escapeHtml(m)}</span>`;
  }
}

function splitMath(text: string): Part[] {
  const parts: Part[] = [];
  const blocks = text.split(/\$\$([\s\S]+?)\$\$/g);
  blocks.forEach((chunk, idx) => {
    if (idx % 2 === 1) {
      parts.push({ kind: 'block', value: chunk });
      return;
    }
    const inlines = chunk.split(/\$([^$\n]+?)\$/g);
    inlines.forEach((piece, jdx) => {
      if (jdx % 2 === 1) {
        parts.push({ kind: 'inline', value: piece });
      } else if (piece.length) {
        parts.push({ kind: 'text', value: piece });
      }
    });
  });
  return parts;
}

export default function MathText({ text }: { text: string }) {
  const parts = splitMath(text);
  return (
    <>
      {parts.map((part, i) => {
        if (part.kind === 'block') {
          return (
            <div
              key={i}
              className="katex-display"
              dangerouslySetInnerHTML={{ __html: blockHtml(part.value.trim()) }}
            />
          );
        }
        if (part.kind === 'inline') {
          return (
            <span key={i} dangerouslySetInnerHTML={{ __html: inlineHtml(part.value) }} />
          );
        }
        return (
          <span key={i} dangerouslySetInnerHTML={{ __html: richText(part.value) }} />
        );
      })}
    </>
  );
}
