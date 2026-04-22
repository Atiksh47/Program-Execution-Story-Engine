import { useEffect, useRef } from 'react'
import type { TraceEvent } from '../types'

interface Props {
  code: string
  current: TraceEvent | null
}

export function SourceHighlighter({ code, current }: Props) {
  const lines = code.split('\n')
  const activeLine = current?.line_no ?? -1
  const activeRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLPreElement | null>(null)

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current
      const el = activeRef.current
      const elTop = el.offsetTop
      const elBottom = elTop + el.offsetHeight
      const visTop = container.scrollTop
      const visBottom = visTop + container.clientHeight
      if (elTop < visTop + 48 || elBottom > visBottom - 48) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
  }, [activeLine])

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col">
      <div className="px-4 py-2 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-widest shrink-0">
        Source
      </div>
      <pre ref={scrollRef} className="p-4 text-sm leading-6 overflow-auto flex-1">
        {lines.map((line, i) => {
          const lineNo = i + 1
          const isActive = lineNo === activeLine
          return (
            <div
              key={i}
              ref={isActive ? activeRef : null}
              className={`flex gap-4 px-2 rounded transition-colors duration-200 ${
                isActive ? 'bg-violet-500/20 text-violet-200' : 'text-slate-300'
              }`}
            >
              <span className="select-none text-slate-600 w-6 text-right shrink-0">{lineNo}</span>
              <span className={isActive ? 'text-violet-100' : ''}>{line || ' '}</span>
            </div>
          )
        })}
      </pre>
    </div>
  )
}
