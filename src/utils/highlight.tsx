/**
 * Syntax highlighting for diff lines.
 *
 * lowlight produces a hast tree, which we convert to React elements directly.
 * We never use `dangerouslySetInnerHTML`: repository content is untrusted, and
 * React escapes every text node, so markup in source files renders as text.
 */
import React from 'react';
import { createLowlight } from 'lowlight';
import type { ElementContent, Root } from 'hast';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import makefile from 'highlight.js/lib/languages/makefile';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const lowlight = createLowlight({
  bash, c, cpp, csharp, css, go, ini, java, javascript, json, kotlin, makefile,
  markdown, python, ruby, rust, scss, sql, swift, typescript, xml, yaml,
});

const EXT: Record<string, string> = {
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
  c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp',
  cs: 'csharp', css: 'css', go: 'go', ini: 'ini', toml: 'ini', cfg: 'ini', gitconfig: 'ini',
  java: 'java', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', jsonc: 'json', kt: 'kotlin', kts: 'kotlin', mk: 'makefile',
  md: 'markdown', markdown: 'markdown', py: 'python', rb: 'ruby', rs: 'rust',
  scss: 'scss', sass: 'scss', sql: 'sql', swift: 'swift', ts: 'typescript', tsx: 'typescript',
  mts: 'typescript', cts: 'typescript', html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml', vue: 'xml',
  yml: 'yaml', yaml: 'yaml',
};

const NAMES: Record<string, string> = { makefile: 'makefile', gnumakefile: 'makefile', dockerfile: 'bash' };

export function languageForPath(path: string): string | null {
  const base = path.split(/[\\/]/).pop()?.toLowerCase() ?? '';
  if (NAMES[base]) return NAMES[base];
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot + 1) : base.replace(/^\./, '');
  return EXT[ext] ?? null;
}

/** Lines longer than this are shown as plain text (highlighting them is slow and rarely useful). */
const MAX_HIGHLIGHT_LINE = 400;

function toReact(nodes: ElementContent[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}.${i}`;
    if (node.type === 'text') return node.value;
    if (node.type === 'element') {
      const cls = node.properties?.className;
      const className = Array.isArray(cls) ? cls.join(' ') : typeof cls === 'string' ? cls : undefined;
      return (
        <span key={key} className={className}>
          {toReact(node.children, key)}
        </span>
      );
    }
    return null;
  });
}

export function highlightCode(code: string, language: string | null): React.ReactNode {
  if (!language || code.length > MAX_HIGHLIGHT_LINE || !lowlight.registered(language)) return code;
  try {
    const tree: Root = lowlight.highlight(language, code);
    return toReact(tree.children as ElementContent[], 'h');
  } catch {
    return code;
  }
}
