interface Props {
  callStack: string[]
  depth: number
}

export function CallStackView({ callStack, depth }: Props) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-widest">Call Stack</span>
        {depth > 0 && (
          <span className="text-xs text-slate-600 font-mono">depth {depth}</span>
        )}
      </div>
      <div className="p-3 flex flex-col-reverse gap-1 min-h-16">
        {callStack.length === 0 ? (
          <span className="text-slate-600 text-sm px-1">— empty —</span>
        ) : (
          callStack.map((fn, i) => {
            const isTop = i === callStack.length - 1
            const indent = i * 10
            return (
              <div
                key={i}
                style={{ marginLeft: `${indent}px` }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-mono transition-all ${
                  isTop
                    ? 'bg-violet-500/20 border border-violet-500/40 text-violet-200'
                    : 'bg-slate-800/80 border border-slate-700/50 text-slate-400'
                }`}
              >
                <span className="text-slate-600 text-xs w-4 text-right shrink-0">{i}</span>
                <span>{fn}()</span>
                {isTop && (
                  <span className="ml-auto text-xs text-violet-500">executing</span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
