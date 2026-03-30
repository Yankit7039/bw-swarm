import { useCallback, useEffect, useState } from 'react'

export interface TocItem {
  id: string
  label: string
  /** Optional subtle count shown on the right (e.g. tool count). */
  toolCount?: number
}

export interface TableOfContentsProps {
  items: TocItem[]
}

/**
 * Minimal floating table of contents for docs-style pages.
 * Uses Intersection Observer for active section tracking and smooth scroll on click.
 */
export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (items.length === 0) return

    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting && e.target.id)
        if (visible.length === 0) return
        // Prefer the section whose top is highest in the viewport (reading position)
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        setActiveId(visible[0].target.id)
      },
      {
        root: null,
        rootMargin: '-10% 0px -70% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      }
    )

    for (const el of elements) {
      observer.observe(el)
    }

    return () => observer.disconnect()
  }, [items])

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  if (items.length === 0) return null

  return (
    <nav
      className="hidden xl:block w-52 shrink-0 sticky top-[5.5rem] self-start"
      aria-label="On this page"
    >
      <div className="rounded-xl border border-slate-100 bg-white/70 backdrop-blur-sm shadow-sm px-3 py-4">
        <p className="text-[10px] font-semibold tracking-widest text-slate-400 px-2 mb-2 uppercase">
          On this page
        </p>
        <ul className="max-h-[calc(100vh-12rem)] overflow-y-auto space-y-0.5 pr-1 -mr-1">
          {items.map((item) => {
            const isActive = activeId === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  aria-label={
                    item.toolCount != null
                      ? `${item.label}, ${item.toolCount} tool${item.toolCount === 1 ? '' : 's'}`
                      : item.label
                  }
                  className={`w-full flex items-center gap-1.5 text-left text-[13px] px-2 py-1 rounded-md transition-colors min-w-0 ${
                    isActive
                      ? 'text-primary font-semibold bg-primary/5 border-l-2 border-primary pl-[6px]'
                      : 'text-slate-500 hover:text-slate-800 border-l-2 border-transparent pl-2'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.toolCount != null && (
                    <span
                      className={`shrink-0 tabular-nums text-[11px] font-medium ${
                        isActive ? 'text-primary/50' : 'text-slate-400/90'
                      }`}
                    >
                      {item.toolCount}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
