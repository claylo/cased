import { createHighlighterCore } from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'

// Static grammar imports — bundleable by rolldown
import langRust from '@shikijs/langs/rust'
import langJavaScript from '@shikijs/langs/javascript'
import langTypeScript from '@shikijs/langs/typescript'
import langPython from '@shikijs/langs/python'
import langGo from '@shikijs/langs/go'
import langJava from '@shikijs/langs/java'
import langC from '@shikijs/langs/c'
import langCpp from '@shikijs/langs/cpp'
import langRuby from '@shikijs/langs/ruby'
import langPhp from '@shikijs/langs/php'
import langSwift from '@shikijs/langs/swift'
import langKotlin from '@shikijs/langs/kotlin'
import langToml from '@shikijs/langs/toml'
import langYaml from '@shikijs/langs/yaml'
import langJson from '@shikijs/langs/json'
import langBash from '@shikijs/langs/bash'
import langShell from '@shikijs/langs/shellscript'
import langSql from '@shikijs/langs/sql'
import langCss from '@shikijs/langs/css'
import langHtml from '@shikijs/langs/html'
import langMarkdown from '@shikijs/langs/markdown'
import langDockerfile from '@shikijs/langs/dockerfile'
import langMake from '@shikijs/langs/make'
import langXml from '@shikijs/langs/xml'

const LANGS = [
  langRust, langJavaScript, langTypeScript, langPython, langGo,
  langJava, langC, langCpp, langRuby, langPhp, langSwift, langKotlin,
  langToml, langYaml, langJson, langBash, langShell, langSql,
  langCss, langHtml, langMarkdown, langDockerfile, langMake, langXml,
]

let highlighterPromise = null

/**
 * Get or create the shared highlighter instance.
 * Lazy-initialized, cached. Safe to call multiple times.
 */
export function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [],
      langs: LANGS,
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighterPromise
}

// Extension-to-language map
const EXT_MAP = {
  '.rs': 'rust', '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'tsx', '.jsx': 'jsx',
  '.py': 'python', '.go': 'go', '.java': 'java',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
  '.rb': 'ruby', '.php': 'php', '.swift': 'swift', '.kt': 'kotlin',
  '.toml': 'toml', '.yaml': 'yaml', '.yml': 'yaml',
  '.json': 'json', '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
  '.sql': 'sql', '.css': 'css', '.html': 'html', '.htm': 'html',
  '.md': 'markdown', '.xml': 'xml',
}

/**
 * Infer Shiki language identifier from a file path.
 * Returns 'text' if unrecognized.
 */
export function inferLangFromPath(filePath) {
  if (!filePath) return 'text'
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return 'text'
  const ext = filePath.slice(dot).toLowerCase()
  return EXT_MAP[ext] || 'text'
}
