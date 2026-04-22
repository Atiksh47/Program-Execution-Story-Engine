interface Props {
  locals: Record<string, unknown>
  prevLocals: Record<string, unknown>
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const aObj = a as Record<string, unknown>
  const bObj = b as Record<string, unknown>
  const aKeys = Object.keys(aObj).sort()
  const bKeys = Object.keys(bObj).sort()
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((k, i) => bKeys[i] === k && deepEqual(aObj[k], bObj[k]))
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.length > 0 && v.length <= 60 && v.every(x => typeof x === 'number')
}

/** Find integer locals that fall within a valid index range for arr — used to highlight compared/active bars. */
function getActiveIndices(arr: number[], allLocals: Record<string, unknown>): Set<number> {
  const active = new Set<number>()
  for (const v of Object.values(allLocals)) {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < arr.length) {
      active.add(v)
    }
  }
  return active
}

function ArrayBars({
  arr,
  prevArr,
  allLocals,
}: {
  arr: number[]
  prevArr: unknown
  allLocals: Record<string, unknown>
}) {
  const prev = isNumberArray(prevArr) ? prevArr : null
  const max = Math.max(...arr, 1)
  const active = getActiveIndices(arr, allLocals)
  const showLabels = arr.length <= 24

  return (
    <div className={`flex items-end gap-px mt-2 ${showLabels ? 'mb-4' : ''}`} style={{ height: '52px', position: 'relative' }}>
      {arr.map((v, i) => {
        const changed = prev !== null && prev[i] !== v
        const isActive = !changed && active.has(i)
        const heightPx = Math.max(4, Math.round((v / max) * 48))
        const barColor = changed
          ? 'bg-amber-400'
          : isActive
          ? 'bg-sky-400'
          : 'bg-violet-500/60'
        const labelColor = changed ? 'text-amber-400' : isActive ? 'text-sky-400' : 'text-slate-600'

        return (
          <div
            key={i}
            title={`[${i}] = ${v}${changed ? ` (was ${prev![i]})` : ''}`}
            className="flex-1 min-w-[6px] relative"
            style={{ height: '52px' }}
          >
            {/* bar grows from bottom */}
            <div
              className={`absolute bottom-0 w-full rounded-t-sm transition-all duration-300 ${barColor}`}
              style={{ height: `${heightPx}px` }}
            />
            {/* label below container */}
            {showLabels && (
              <span
                className={`absolute text-[9px] leading-none font-mono w-full text-center ${labelColor}`}
                style={{ bottom: '-14px' }}
              >
                {v}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatValue(v: unknown): string {
  if (typeof v === 'string') return `"${v}"`
  return JSON.stringify(v)
}

export function VariableInspector({ locals, prevLocals }: Props) {
  const entries = Object.entries(locals)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-widest">
        Variables
      </div>
      <div className="p-4 min-h-16 flex flex-col gap-3">
        {entries.length === 0 ? (
          <span className="text-slate-600 text-sm">— empty scope —</span>
        ) : (
          entries.map(([k, v]) => {
            const prev = prevLocals[k]
            const isNew = !(k in prevLocals)
            const changed = !isNew && !deepEqual(v, prev)
            const isArr = isNumberArray(v)

            return (
              <div key={k} className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-2 text-sm font-mono">
                  {/* variable name */}
                  <span className={`${isNew ? 'text-emerald-400' : changed ? 'text-amber-300' : 'text-slate-400'}`}>
                    {k}
                  </span>
                  <span className="text-slate-600">=</span>
                  {/* value — for arrays show just the type label here, bars below */}
                  {isArr ? (
                    <span className="text-slate-500 text-xs">[{v.length} numbers]</span>
                  ) : (
                    <span className={`${isNew ? 'text-emerald-300' : changed ? 'text-amber-200' : 'text-slate-200'}`}>
                      {formatValue(v)}
                    </span>
                  )}
                  {/* change badge */}
                  {isNew && <span className="text-xs text-emerald-600 ml-auto">new</span>}
                  {!isNew && changed && !isArr && (
                    <span className="text-xs text-slate-600 ml-auto">
                      was <span className="text-amber-600/80">{formatValue(prev)}</span>
                    </span>
                  )}
                </div>

                {/* bar chart for number arrays */}
                {isArr && (
                  <ArrayBars arr={v} prevArr={prev} allLocals={locals} />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
