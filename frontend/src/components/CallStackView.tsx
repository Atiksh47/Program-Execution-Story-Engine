interface Props {
  callStack: string[]
  depth: number
}

const EVENT_COLORS: Record<string, string> = {
  '<module>': 'text-slate-400',
}

export function CallStackView({ callStack }: Props) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-widest">
        Call Stack
      </div>
      <div className="p-4 flex flex-col-reverse gap-1 min-h-16">
        {callStack.length === 0 ? (
          <span className="text-slate-600 text-sm">— empty —</span>
        ) : (
          callStack.map((fn, i) => {
            const isTop = i === callStack.length - 1
            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-mono transition-all ${
                  isTop
                    ? 'bg-violet-500/20 border border-violet-500/40 text-violet-200'
                    : 'bg-slate-800 text-slate-400'
                }`}
                style={{ marginLeft: `${i * 8}px` }}
              >
                <span className={EVENT_COLORS[fn] ?? 'text-slate-300'}>{fn}()</span>
                {isTop && <span className="ml-auto text-xs text-violet-400">← current</span>}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
