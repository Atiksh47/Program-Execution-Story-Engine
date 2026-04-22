import type { TraceEvent } from '../types'

interface Props {
  code: string
  current: TraceEvent | null
}

export function SourceHighlighter({ code, current }: Props) {
  const lines = code.split('\n')
  const activeLine = current?.line_no ?? -1

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-auto">
      <div className="px-4 py-2 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-widest">
        Source
      </div>
      <pre className="p-4 text-sm leading-6 overflow-x-auto">
        {lines.map((line, i) => {
          const lineNo = i + 1
          const isActive = lineNo === activeLine
          return (
            <div
              key={i}
              className={`flex gap-4 px-2 rounded transition-colors ${
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
