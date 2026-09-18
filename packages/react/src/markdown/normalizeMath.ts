/**
 * Display-math normalization before parsing:
 *  - `\(...\)` → `$...$` (remark-math only knows the $ dialect; models emit
 *    LaTeX delimiters when trained on LaTeX-heavy corpora)
 *  - `\[...\]` (single- or multi-line) and single-line `$$...$$` → the flow
 *    form (`$$` alone on its lines) — remark-math renders only flow math as
 *    display.
 * Code fences and inline-code spans are left untouched.
 */
export function normalizeLatexDelimiters(content: string): string {
  const out: string[] = []
  let inFence = false
  let inBracketMath = false

  for (const line of content.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }
    if (inBracketMath) {
      const closeIdx = line.indexOf('\\]')
      if (closeIdx === -1) {
        out.push(line)
        continue
      }
      inBracketMath = false
      const before = line.slice(0, closeIdx).trim()
      if (before) out.push(before)
      out.push('$$')
      const after = transformProse(line.slice(closeIdx + 2))
      if (after.trim()) out.push(...after.split('\n'))
      continue
    }
    out.push(...transformLine(line).split('\n'))
  }
  return out.join('\n')

  function transformProse(seg: string): string {
    let s = seg.replace(/\\\(/g, '$').replace(/\\\)/g, '$')
    // Complete \[ ... \] pairs on one line (loop: several per line).
    for (;;) {
      const m = /^(.*?)\\\[\s*([^\n]*?)\s*\\\](.*)$/.exec(s)
      if (!m) break
      s = `${m[1]}\n$$\n${m[2]}\n$$\n${m[3]}`
    }
    // An opener with no closer on this line starts a multi-line flow block.
    const opener = /^(.*?)\\\[\s*$/.exec(s)
    if (opener) {
      inBracketMath = true
      s = opener[1] ? `${opener[1]}\n$$` : '$$'
    }
    // Single-line $$...$$ also becomes flow form (display);
    // already-flow `$$` lines have no inline content to match.
    s = s.replace(/\$\$([^\n$]+)\$\$/g, (_all, inner: string) => `\n$$\n${inner}\n$$\n`)
    return s
  }

  function transformLine(line: string): string {
    return line
      .split(/(`[^`]*`)/g)
      .map(seg => (seg.startsWith('`') ? seg : transformProse(seg)))
      .join('')
  }
}
