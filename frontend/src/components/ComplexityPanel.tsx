import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FitResult {
  label: string
  r2: number
}

interface ComplexityResult {
  sizes: number[]
  times_ms: number[]
  fit_values: number[]
  best: FitResult
  all_fits: FitResult[]
  param_name: string
}

// ── Colour helpers ────────────────────────────────────────────────────────────

const COMPLEXITY_COLOR: Record<string, string> = {
  'O(1)':       '#34d399', // emerald
  'O(log n)':   '#6ee7b7',
  'O(n)':       '#60a5fa', // blue
  'O(n log n)': '#a78bfa', // violet
  'O(n²)':      '#f59e0b', // amber
  'O(2ⁿ)':      '#f87171', // red
}

function badgeColor(label: string) {
  return COMPLEXITY_COLOR[label] ?? '#94a3b8'
}

// ── Confidence bar ────────────────────────────────────────────────────────────

function ConfidenceBar({ r2 }: { r2: number }) {
  const pct = Math.round(r2 * 100)
  const color = pct >= 90 ? '#34d399' : pct >= 70 ? '#a78bfa' : '#f59e0b'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  )
}

// ── Convention hint ───────────────────────────────────────────────────────────

const HINT = `Add \`n = <integer>\` or \`arr = [...]\` at module level so the analyzer knows which variable to sweep.

Example:
  n = 10          # ← analyzer replaces this with 2, 3, … 20
  result = factorial(n)`

// ── Example snippets that already follow the convention ──────────────────────

const COMPLEXITY_EXAMPLES: Record<string, string> = {
  'Factorial (O(n))': `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

n = 10
result = factorial(n)`,

  'Bubble Sort (O(n²))': `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

arr = list(range(10, 0, -1))
result = bubble_sort(arr)`,

  'Binary Search (O(log n))': `def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1

n = 15
arr = list(range(n))
result = binary_search(arr, n // 2)`,
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
      <p className="text-slate-400 mb-1">n = {label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value} ms
        </p>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  code: string
  onLoadExample?: (code: string) => void
}

export function ComplexityPanel({ code, onLoadExample }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComplexityResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    setResult(null)
    setOpen(true)
    try {
      const res = await fetch('/analyze-complexity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, max_n: 20 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Analysis failed')
      setResult(data as ComplexityResult)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const chartData = result
    ? result.sizes.map((n, i) => ({
        n,
        Measured: parseFloat(result.times_ms[i].toFixed(4)),
        'Best fit': parseFloat(result.fit_values[i].toFixed(4)),
      }))
    : []

  const accent = result ? badgeColor(result.best.label) : '#8b5cf6'

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header row — always visible */}
      <div className="flex items-center gap-3 px-5 py-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Toggle complexity panel"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-medium uppercase tracking-widest">Complexity Analysis</span>
        </button>

        {/* Active badge — show best result inline even when collapsed */}
        {result && !open && (
          <span className="text-sm font-bold font-mono" style={{ color: accent }}>
            {result.best.label}
            <span className="text-slate-500 text-xs font-normal ml-1">
              · {Math.round(result.best.r2 * 100)}% confidence
            </span>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleAnalyze}
            disabled={loading || !code.trim()}
            className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
          >
            {loading ? 'Analyzing…' : 'Analyze →'}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-slate-700 p-5 flex flex-col gap-5">

          {/* Convention hint + example buttons */}
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-3">
              <svg className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">{HINT}</pre>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">Load example:</span>
              {Object.entries(COMPLEXITY_EXAMPLES).map(([name, snippet]) => (
                <button
                  key={name}
                  onClick={() => onLoadExample?.(snippet)}
                  className="px-2.5 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="flex flex-col gap-3 animate-pulse">
              <div className="h-8 bg-slate-700/50 rounded w-48" />
              <div className="h-52 bg-slate-700/30 rounded" />
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="flex flex-col gap-5">

              {/* Classification badge */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl font-bold font-mono" style={{ color: accent }}>
                    {result.best.label}
                  </span>
                  <span className="text-slate-400 text-sm">
                    empirical classification · swept <code className="text-violet-300">{result.param_name}</code> from {result.sizes[0]} to {result.sizes[result.sizes.length - 1]}
                  </span>
                </div>
                <ConfidenceBar r2={result.best.r2} />
              </div>

              {/* Chart */}
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 16, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="n"
                      stroke="#334155"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      label={{ value: 'n (input size)', position: 'insideBottom', offset: -8, fill: '#475569', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#334155"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={v => v < 0.01 ? v.toExponential(0) : v.toFixed(2)}
                      label={{ value: 'ms', angle: -90, position: 'insideLeft', offset: 12, fill: '#475569', fontSize: 11 }}
                      width={48}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }}
                    />
                    {/* Measured data — dots only, faint connecting line */}
                    <Line
                      type="monotone"
                      dataKey="Measured"
                      stroke="#8b5cf6"
                      strokeWidth={0.5}
                      strokeOpacity={0.4}
                      dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                    {/* Best-fit curve — solid line, no dots */}
                    <Line
                      type="monotone"
                      dataKey="Best fit"
                      stroke={accent}
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="5 3"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* All-fits comparison */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500 uppercase tracking-widest">All model fits (R²)</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {result.all_fits.map(fit => {
                    const isBest = fit.label === result.best.label
                    const c = badgeColor(fit.label)
                    return (
                      <div
                        key={fit.label}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                          isBest
                            ? 'border-opacity-50 bg-opacity-10'
                            : 'border-slate-700 bg-slate-900/40 text-slate-500'
                        }`}
                        style={isBest ? { borderColor: c + '80', backgroundColor: c + '15', color: c } : undefined}
                      >
                        <span>{fit.label}</span>
                        <span className="tabular-nums">{Math.round(fit.r2 * 100)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
