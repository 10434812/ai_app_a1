import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)

// Simple HTML escape to avoid circular dependency on md instance during init
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

const md = new MarkdownIt({
  html: false,
  xhtmlOut: false,
  breaks: true,
  linkify: true,
  typographer: true,
  highlight: function (str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs p-4 rounded-lg my-4 overflow-x-auto text-sm"><code>' + hljs.highlight(str, {language: lang, ignoreIllegals: true}).value + '</code></pre>'
      } catch (__) {}
    }

    return '<pre class="hljs p-4 rounded-lg my-4 overflow-x-auto text-sm"><code>' + escapeHtml(str) + '</code></pre>'
  },
})

// Custom link rendering to open in new tab
const defaultRender =
  md.renderer.rules.link_open ||
  function (tokens: any[], idx: number, options: any, env: any, self: any) {
    return self.renderToken(tokens, idx, options)
  }

md.renderer.rules.link_open = function (tokens: any[], idx: number, options: any, env: any, self: any) {
  const aIndex = tokens[idx].attrIndex('target')

  if (aIndex < 0) {
    tokens[idx].attrPush(['target', '_blank'])
  } else {
    tokens[idx].attrs![aIndex][1] = '_blank'
  }

  tokens[idx].attrPush(['rel', 'noopener noreferrer'])

  return defaultRender(tokens, idx, options, env, self)
}

export function renderMarkdown(content: string): string {
  if (!content) return ''
  return md.render(content)
}
