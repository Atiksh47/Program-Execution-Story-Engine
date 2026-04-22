import { useState } from 'react'
import type { TraceEvent, TraceResponse, NarrationResponse } from './types'
import { useTimeline } from './hooks/useTimeline'
import { CodeInput } from './components/CodeInput'
import { SourceHighlighter } from './components/SourceHighlighter'
import { VariableInspector } from './components/VariableInspector'
import { CallStackView } from './components/CallStackView'
import { TimelineScrubber } from './components/TimelineScrubber'
import { NarrationPanel } from './components/NarrationPanel'

const EVENT_BADGE: Record<string, string> = {
  call: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  line: 'bg-slate-700 text-slate-300 border-slate-600',
  return: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
}

export default function App() {
  const [events, setEvents] = useState<TraceEvent[]>([])
  const [submittedCode, setSubmittedCode] = useState('')
  const [capped, setCapped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [narration, setNarration] = useState<NarrationResponse | null>(null)
  const [narrateLoading, setNarrateLoading] = useState(false)

  const { step, current, total, prev, next, goTo, playing, togglePlay, getPrevLocals } = useTimeline(events)

  async function handleTrace(code: string) {
    setLoading(true)
    setError(null)
    setNarration(null)
    setSubmittedCode(code)
    try {
      const res = await fetch('/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail ?? 'Trace failed')
      }
      const data: TraceResponse = await res.json()
      setEvents(data.events)
      setCapped(data.capped)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleNarrate() {
    setNarrateLoading(true)
    try {
      const res = await fetch('/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events, code: submittedCode }),
      })
      if (!res.ok) throw new Error('Narration failed')
      const data: NarrationResponse = await res.json()
      setNarration(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setNarrateLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100 p-6 flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">
          Program Execution Story Engine
        </h1>
        <span className="text-slate-600 text-sm">Python tracer + replay</span>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <CodeInput onSubmit={handleTrace} loading={loading} />
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {capped && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-4 py-3 text-amber-300 text-sm">
          Output capped at 500 steps.
        </div>
      )}

      {total > 0 && (
        <>
          <TimelineScrubber
            step={step}
            total={total}
            events={events}
            phases={narration?.phases}
            onGoTo={goTo}
            onPrev={prev}
            onNext={next}
            onTogglePlay={togglePlay}
            playing={playing}
          />

          {current && (
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 text-xs rounded border font-mono uppercase tracking-wider ${EVENT_BADGE[current.event]}`}>
                {current.event}
              </span>
              <span className="text-slate-300 text-sm font-mono">{current.source_line.trim()}</span>
              <span className="text-slate-600 text-xs ml-auto">line {current.line_no}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SourceHighlighter code={submittedCode} current={current} />
            <div className="flex flex-col gap-4">
              <VariableInspector
                locals={current?.locals ?? {}}
                prevLocals={getPrevLocals()}
              />
              <CallStackView
                callStack={current?.call_stack ?? []}
                depth={current?.depth ?? 0}
              />
              <NarrationPanel
                narration={narration}
                loading={narrateLoading}
                currentStep={step}
                onRequest={handleNarrate}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
