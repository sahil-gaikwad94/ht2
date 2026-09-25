'use client';
/* ============================================================================
   lib/markdown — the heatt rendering pipeline (spec §6.2)

   unified/remark-parse → mdast → React elements. We deliberately stop at the
   AST and render with our own components instead of injecting HTML, because:
     • nothing unsafe reaches the DOM (no dangerouslySetInnerHTML),
     • every element can be styled by the heatt type scale,
     • images, links and code blocks become *interactive* (in-app routing,
       copy buttons, lazy heat-shimmer placeholders),
     • every block keeps a stable index so the Heat Waveform can light up the
       exact paragraph a reader heated.
   ==========================================================================*/

import * as React from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { slugify } from './util';

export type Node = {
  type: string;
  value?: string;
  depth?: number;
  ordered?: boolean;
  spread?: boolean;
  start?: number;
  lang?: string | null;
  meta?: string | null;
  url?: string;
  alt?: string | null;
  title?: string | null;
  children?: Node[];
  checked?: boolean | null;
  align?: (string | null)[];
  // table cells
  tagName?: string;
};

const processor = unified().use(remarkParse).use(remarkGfm);

export type ParsedDoc = {
  root: Node;
  headings: { id: string; text: string; depth: number; index: number }[];
  blocks: number;
  words: number;
};

export function parseMarkdown(md: string): ParsedDoc {
  const root = processor.parse(md || '') as unknown as Node;
  const headings: ParsedDoc['headings'] = [];
  let words = 0;
  let blocks = 0;
  const walk = (n: Node) => {
    if (n.type === 'text' || n.type === 'inlineCode') words += (n.value ?? '').split(/\s+/).filter(Boolean).length;
    if (n.type === 'heading') {
      const text = textOf(n);
      headings.push({ id: slugify(text) || `h-${headings.length}`, text, depth: n.depth ?? 2, index: blocks });
    }
    if (n.children && n.type !== 'root') n.children.forEach(walk);
    if (n.type !== 'root' && !['text', 'emphasis', 'strong', 'inlineCode', 'link', 'delete', 'break'].includes(n.type)) blocks++;
    if (n.type === 'root') n.children?.forEach(walk);
  };
  walk(root);
  return { root, headings, blocks, words };
}

function textOf(n: Node): string {
  if (n.value) return n.value;
  return (n.children ?? []).map(textOf).join('');
}

/* -------------------------------------------------------------------------- */

export type RenderOpts = {
  /** called with the top-level block index for click-to-heat anchoring */
  onBlockRef?: (index: number, el: HTMLElement | null) => void;
  /** per-block crowd heat 0..1 for the waveform glow */
  blockHeat?: (index: number) => number;
  /** internal dev.to path router */
  onInternalLink?: (path: string) => void;
  compact?: boolean;
};

const INTERNAL_HOSTS = ['dev.to'];

/** Render-scope options. remark's AST walk is synchronous, so one module-level
 *  reference is safe and keeps the recursive helpers free of prop threading. */
let OPTS: RenderOpts = {};

export function Markdown({ doc, opts = {} }: { doc: ParsedDoc; opts?: RenderOpts }) {
  OPTS = opts;
  const out: React.ReactNode[] = [];
  let i = 0;

  const block = (node: Node, key: number) => {
    const heat = opts.blockHeat?.(key) ?? 0;
    const style = heat > 0.02 ? ({ ['--bh' as string]: heat } as React.CSSProperties) : undefined;
    const cls =
      'ht-block' + (heat > 0.15 ? ' ht-block--warm' : '') + (heat > 0.5 ? ' ht-block--hot' : '');
    return (
      <div
        key={`b${key}`}
        data-block={key}
        className={cls}
        style={style}
        ref={(el) => opts.onBlockRef?.(key, el)}
      >
        {render(node, key)}
      </div>
    );
  };

  for (const child of doc.root.children ?? []) {
    if (child.type === 'yaml' || child.type === 'definition') continue;
    out.push(block(child, i));
    i++;
  }
  return <>{out}</>;
}

function inline(nodes: Node[] = [], keyBase = 'i'): React.ReactNode[] {
  return nodes.map((n, idx) => {
    const key = `${keyBase}-${idx}`;
    switch (n.type) {
      case 'text':
        return <React.Fragment key={key}>{n.value}</React.Fragment>;
      case 'break':
        return <br key={key} />;
      case 'emphasis':
        return <em key={key}>{inline(n.children, key)}</em>;
      case 'strong':
        return <strong key={key}>{inline(n.children, key)}</strong>;
      case 'delete':
        return <del key={key}>{inline(n.children, key)}</del>;
      case 'inlineCode':
        return <code key={key}>{n.value}</code>;
      case 'footnoteReference':
        return (
          <sup key={key} className="text-ember-300">
            [{n.value}]
          </sup>
        );
      case 'image':
        return <InlineImage key={key} src={n.url ?? ''} alt={n.alt ?? ''} />;
      case 'link': {
        const href = n.url ?? '';
        const internal =
          href.startsWith('/') || (INTERNAL_HOSTS.some((h) => href.includes(h)) && !OPTS.compact);
        return (
          <a
            key={key}
            href={href || '#'}
            onClick={(e) => {
              if (internal && OPTS.onInternalLink && href.startsWith('/')) {
                e.preventDefault();
                OPTS.onInternalLink(href);
              }
            }}
            {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {inline(n.children, key)}
          </a>
        );
      }
      case 'html':
        // raw HTML is intentionally flattened to text — safety over fidelity
        return <React.Fragment key={key}>{stripTags(n.value ?? '')}</React.Fragment>;
      default:
        return <React.Fragment key={key}>{inline(n.children, key)}</React.Fragment>;
    }
  });
}

function stripTags(s: string) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:div|p|section|article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function InlineImage({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} loading="lazy" decoding="async" />;
}

function render(n: Node, key: React.Key): React.ReactNode {
  switch (n.type) {
    case 'heading': {
      const id = slugify(textOf(n)) || `h${key}`;
      const Tag = (`h${Math.min(4, n.depth ?? 2)}`) as 'h2';
      return (
        <Tag id={id} key={key}>
          {inline(n.children, `${key}h`)}
        </Tag>
      );
    }
    case 'paragraph':
      return <p key={key}>{inline(n.children, `${key}p`)}</p>;
    case 'thematicBreak':
      return <hr key={key} />;
    case 'blockquote':
      return (
        <blockquote key={key}>
          {(n.children ?? []).map((c, i) => (
            <React.Fragment key={i}>{render(c, `${key}q${i}`)}</React.Fragment>
          ))}
        </blockquote>
      );
    case 'list':
      return n.ordered ? (
        <ol key={key} start={n.start ?? 1}>
          {(n.children ?? []).map((c, i) => (
            <li key={i}>{listContent(c, `${key}li${i}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key}>
          {(n.children ?? []).map((c, i) => (
            <li key={i}>{listContent(c, `${key}lu${i}`)}</li>
          ))}
        </ul>
      );
    case 'code':
      return <CodeBlock key={key} lang={n.lang ?? 'text'} code={(n.value ?? '').replace(/\n$/, '')} />;
    case 'html': {
      const txt = stripTags(n.value ?? '');
      if (!txt) return null;
      return <p key={key}>{txt}</p>;
    }
    case 'table':
      return (
        <table key={key}>
          <thead>
            <tr>
              {(n.children?.[0]?.children ?? []).map((c, i) => (
                <th key={i}>{inline(c.children, `${key}th${i}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(n.children ?? []).slice(1).map((row, r) => (
              <tr key={r}>
                {(row.children ?? []).map((c, i) => (
                  <td key={i}>{inline(c.children, `${key}td${r}-${i}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'image':
      return <InlineImage src={n.url ?? ''} alt={n.alt ?? ''} key={key} />;
    case 'paragraphGroup':
      return null;
    default:
      return <p key={String(key)}>{inline([n], `${key}d`)}</p>;
  }
}

function listContent(item: Node, key: string): React.ReactNode {
  const kids = item.children ?? [];
  const boxes = kids.filter((k) => k.type === 'listItem' || k.type === 'list');
  const main = kids.filter((k) => k.type !== 'listItem' && k.type !== 'list');
  return (
    <>
      {item.checked !== null && item.checked !== undefined ? (
        <span className={item.checked ? 'text-ember-300' : 'text-ink-mute'}>{item.checked ? '☑ ' : '☐ '}</span>
      ) : null}
      {main.map((k, i) => (
        <React.Fragment key={i}>{render(k, `${key}-${i}`)}</React.Fragment>
      ))}
      {boxes.length > 0 && (
        <ul>
          {boxes.flatMap((b) =>
            (b.children ?? []).map((c, i) => (
              <li key={i}>{listContent(c, `${key}-n${i}`)}</li>
            ))
          )}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ code UI */

export function CodeBlock({ lang, code, caption }: { lang: string; code: string; caption?: string }) {
  const [copied, setCopied] = React.useState(false);
  const [wrap, setWrap] = React.useState(false);
  const lines = code.split('\n');
  return (
    <figure className="ht-codegroup">
      <div className="ht-codebar">
        <span className="ht-codelang">{lang}</span>
        {caption ? <span className="ht-codecap">{caption}</span> : null}
        <span className="flex-1" />
        <button type="button" className="ht-codebtn" onClick={() => setWrap((w) => !w)}>
          {wrap ? 'no wrap' : 'wrap'}
        </button>
        <button
          type="button"
          className="ht-codebtn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            } catch {/* clipboard blocked */}
          }}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className={wrap ? 'ht-pre-wrap' : ''}>
        <code className={`language-${lang}`}>
          {lines.map((l, i) => (
            <span key={i} className="ht-line">
              <span className="ht-lineno">{i + 1}</span>
              <span className="ht-linetext">{l || ' '}</span>
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

/** tiny, dependency-free syntax tokenizer for the highlight classes in CSS */
export function highlight(code: string, lang: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const kw =
    /\b(const|let|var|function|return|async|await|if|else|for|while|of|in|new|class|extends|import|from|export|default|type|interface|enum|implements|public|private|readonly|static|null|undefined|true|false|this|super|try|catch|finally|throw|switch|case|break|continue|typeof|instanceof|as|void|yield|def|self|lambda|print|elif|range|len|pub|fn|mut|struct|impl|match|use|mod|crate|package|func|nil|err|go|defer|select|chan|goroutine|let|in|module|open|private)\b/g;
  let out = esc(code);
  out = out.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '§S0§$1§S1§');
  out = out.replace(/(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g, '§C0§$1§C1§');
  out = out.replace(kw, '§K§$&§/K§');
  out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, '§N§$1§/N§');
  if (/^(ts|js|tsx|jsx|java|go|rust|rs|c|cpp|swift|kotlin|py|python)$/.test(lang)) {
    out = out.replace(/\b([A-Z][A-Za-z0-9_]*)\b/g, '§T§$1§/T§');
  }
  out = out
    .replace(/§S0§([\s\S]*?)§S1§/g, '<span class="hljs-string">$1</span>')
    .replace(/§C0§([\s\S]*?)§C1§/g, '<span class="hljs-comment">$1</span>')
    .replace(/§K§/g, '<span class="hljs-keyword">')
    .replace(/§\/K§/g, '</span>')
    .replace(/§N§/g, '<span class="hljs-number">')
    .replace(/§\/N§/g, '</span>')
    .replace(/§T§/g, '<span class="hljs-title">')
    .replace(/§\/T§/g, '</span>');
  return out;
}
