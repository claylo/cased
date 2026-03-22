import { InlineStyleAnnotation } from '@expressive-code/core'

const FontStyle = { Italic: 1, Bold: 2, Underline: 4, Strikethrough: 8 }

/**
 * Custom expressive-code plugin that uses a pre-built HighlighterCore
 * instead of plugin-shiki's dynamic-import approach.
 */
export function pluginPrebuiltShiki({ highlighter }) {
  const loadedThemes = new Set()

  return {
    name: 'Shiki',
    hooks: {
      performSyntaxAnalysis: async ({ codeBlock, styleVariants }) => {
        const codeLines = codeBlock.getLines()
        const code = codeBlock.code

        // Resolve language — fall back to 'text' if not loaded
        const loadedLangs = highlighter.getLoadedLanguages()
        const langToUse = loadedLangs.includes(codeBlock.language)
          ? codeBlock.language : 'text'

        for (let vi = 0; vi < styleVariants.length; vi++) {
          const theme = styleVariants[vi].theme
          const themeName = theme.name

          // Load theme into highlighter if not already loaded
          if (!loadedThemes.has(themeName)) {
            await highlighter.loadTheme(theme)
            loadedThemes.add(themeName)
          }

          // Tokenize
          const tokenLines = highlighter.codeToTokensBase(code, {
            lang: langToUse,
            theme: themeName,
          })

          // Map tokens to InlineStyleAnnotation
          tokenLines.forEach((line, lineIndex) => {
            if (lineIndex >= codeLines.length) return
            let charIndex = 0
            line.forEach((token) => {
              const len = token.content.length
              const fs = token.fontStyle || 0
              codeLines[lineIndex].addAnnotation(
                new InlineStyleAnnotation({
                  styleVariantIndex: vi,
                  color: token.color || theme.fg,
                  italic: !!(fs & FontStyle.Italic),
                  bold: !!(fs & FontStyle.Bold),
                  underline: !!(fs & FontStyle.Underline),
                  strikethrough: !!(fs & FontStyle.Strikethrough),
                  inlineRange: { columnStart: charIndex, columnEnd: charIndex + len },
                  renderPhase: 'earliest',
                })
              )
              charIndex += len
            })
          })
        }
      },
    },
  }
}
