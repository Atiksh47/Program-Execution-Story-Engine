interface Props {
  locals: Record<string, unknown>
  prevLocals: Record<string, unknown>
}

export function VariableInspector({ locals, prevLocals }: Props) {
  const entries = Object.entries(locals)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-widest">
        Variables
      </div>
      <div className="p-4 min-h-16">
        {entries.length === 0 ? (
          <span className="text-slate-600 text-sm">— empty scope —</span>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map(([k, v]) => {
              const prev = prevLocals[k]
              const changed = JSON.stringify(v) !== JSON.stringify(prev)
              const isNew = !(k in prevLocals)
              return (
                <div key={k} className="flex items-baseline gap-2 text-sm font-mono">
                  <span className={`${isNew ? 'text-emerald-400' : changed ? 'text-amber-300' : 'text-slate-400'}`}>
                    {k}
                  </span>
                  <span className="text-slate-600">=</span>
                  <span className={`${isNew ? 'text-emerald-300' : changed ? 'text-amber-200' : 'text-slate-200'}`}>
                    {JSON.stringify(v)}
                  </span>
                  {isNew && <span className="text-xs text-emerald-600">new</span>}
                  {!isNew && changed && <span className="text-xs text-amber-600">changed</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
