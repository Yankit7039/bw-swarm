/** Inner HTML for one YAML line (no wrapper). */
export function highlightYAMLLine(line: string): string {
  let highlighted = line
    .replace(/#.*$/g, '<span class="text-slate-400 italic">$&</span>')
    .replace(
      /^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)(:)/g,
      '$1<span class="text-violet-600 font-semibold">$2</span><span class="text-slate-600">$3</span>'
    )
    .replace(/: (true|false)/g, ': <span class="text-indigo-600 font-semibold">$1</span>')
    .replace(/: (\d+)/g, ': <span class="text-amber-600">$1</span>')
    .replace(/: ([a-zA-Z_][a-zA-Z0-9_-]*)/g, ': <span class="text-emerald-600">$1</span>')
    .replace(/: "([^"]*)"/g, ': <span class="text-emerald-700">"$1"</span>')
    .replace(/: '([^']*)'/g, ': <span class="text-emerald-700">\'$1\'</span>')
  return highlighted
}

/** Full document as concatenated line divs (wrap-friendly; display only). */
export function highlightYAML(yaml: string): string {
  return yaml
    .split('\n')
    .map((line) => {
      const inner = highlightYAMLLine(line) || '&nbsp;'
      return `<div class="leading-relaxed min-h-[1.625rem] whitespace-pre-wrap break-words">${inner}</div>`
    })
    .join('')
}
