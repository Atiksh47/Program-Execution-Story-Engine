import { useState } from 'react'
import type { TraceEvent, TraceResponse, NarrationResponse } from './types'
import { useTimeline } from './hooks/useTimeline'
import { CodeInput } from './components/CodeInput'
import { SourceHighlighter } from './components/SourceHighlighter'
import { VariableInspector } from './components/VariableInspector'
import { CallStackView } from './components/CallStackView'
import { TimelineScrubber } from './components/TimelineScrubber'
import { NarrationPanel } from './components/NarrationPanel'

const EVENT_BADGE: Record<string, { cls: string; label: string; desc: string }> = {
  call:   { cls: 'bg-violet-500/20 text-violet-300 border-violet-500/40',   label: 'CALL',   desc: 'entering function' },
  line:   { cls: 'bg-slate-700 text-slate-300 border-slate-600',             label: 'LINE',   desc: 'executing line' },
  return: { cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', label: 'RETURN', desc: 'function returning' },
}

export default function App() {
  const [events, setEvents] = useState<TraceEvent[]>([])
  const [submittedCode, setSubmittedCode] = useState('')
  const [capped, setCapped] = useState(false)
  const [stdout, setStdout] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [narration, setNarration] = useState<NarrationResponse | null>(null)
  const [narrateLoading, setNarrateLoading] = useState(false)
  const [traced, setTraced] = useState(false)
  const [speed, setSpeed] = useState(800)

  const { step, current, total, prev, next, goTo, playing, togglePlay, getPrevLocals } = useTimeline(events, speed)

  async function handleTrace(code: string) {
    setLoading(true)
    setError(null)
    setNarration(null)
    setStdout('')
    setTraced(false)
    setSubmittedCode(code)
    try {
      const res = await fetch('/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail ?? 'Trace failed')
      }
      const typed: TraceResponse = data
      setEvents(typed.events)
      setCapped(typed.capped)
      setStdout(typed.stdout ?? '')
      setTraced(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setEvents([])
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Narration failed')
      setNarration(data as NarrationResponse)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setNarrateLoading(false)
    }
  }

  const badge = current ? EVENT_BADGE[current.event] : null
  const prevLocals = getPrevLocals()

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
          Output capped at 500 steps. Your program may have run longer.
        </div>
      )}

      {traced && total === 0 && !error && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-400 text-sm">
          No execution steps were recorded. Make sure your code contains executable statements.
        </div>
      )}

      {stdout && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-widest">
            Output
          </div>
          <pre className="p-4 text-sm font-mono text-slate-200 whitespace-pre-wrap">{stdout}</pre>
        </div>
      )}

      {total > 0 && (
        <>
          <TimelineScrubber
            step={step}
            total={total}
            events={events}
            phases={narration?.phases}
            speed={speed}
            onGoTo={goTo}
            onPrev={prev}
            onNext={next}
            onTogglePlay={togglePlay}
            onSpeedChange={setSpeed}
            playing={playing}
            loading={loading}
          />

          {/* Step header — what's happening right now */}
          {current && badge && (
            current.event === 'return' && current.return_value !== null && current.func_name !== '<module>'
              ? (
                /* RETURN: make the result the centrepiece */
                <div className="bg-emerald-950/40 border border-emerald-700/40 rounded-lg px-4 py-3 flex flex-col gap-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span title="RETURN — function finished and yielded a value back to its caller" className="px-2.5 py-1 text-xs rounded border font-mono uppercase tracking-wider shrink-0 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 cursor-help">
                      RETURN
                    </span>
                    <span className="font-mono text-base">
                      <span className="text-slate-400">{current.func_name}(</span>
                      {Object.entries(current.locals).slice(0, 4).map(([k, v], i) => (
                        <span key={k}>
                          {i > 0 && <span className="text-slate-600">, </span>}
                          <span className="text-slate-300">{k}</span>
                          <span className="text-slate-600">=</span>
                          <span className="text-violet-300">{JSON.stringify(v)}</span>
                        </span>
                      ))}
                      <span className="text-slate-400">)</span>
                      <span className="text-slate-500 mx-2">→</span>
                      <span className="text-emerald-300 font-bold text-lg">{current.return_value}</span>
                    </span>
                  </div>
                  <span className="text-slate-500 text-xs font-mono">
                    {current.source_line.trim()} · line {current.line_no}
                  </span>
                </div>
              )
              : current.event === 'call' && current.func_name !== '<module>'
              ? (
                /* CALL: show which function we're entering with its args */
                <div className="bg-violet-950/30 border border-violet-700/30 rounded-lg px-4 py-3 flex flex-col gap-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span title="CALL — execution is entering a new function frame" className="px-2.5 py-1 text-xs rounded border font-mono uppercase tracking-wider shrink-0 bg-violet-500/20 text-violet-300 border-violet-500/40 cursor-help">
                      CALL
                    </span>
                    <span className="font-mono text-base">
                      <span className="text-violet-200">{current.func_name}(</span>
                      {Object.entries(current.locals).slice(0, 4).map(([k, v], i) => (
                        <span key={k}>
                          {i > 0 && <span className="text-slate-600">, </span>}
                          <span className="text-slate-300">{k}</span>
                          <span className="text-slate-600">=</span>
                          <span className="text-amber-300">{JSON.stringify(v)}</span>
                        </span>
                      ))}
                      <span className="text-violet-200">)</span>
                    </span>
                  </div>
                  <span className="text-slate-500 text-xs font-mono">
                    entering function · line {current.line_no}
                  </span>
                </div>
              )
              : (
                /* LINE: standard display */
                <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 flex items-center gap-3">
                  <span title={`LINE — ${badge.desc}`} className={`px-2.5 py-1 text-xs rounded border font-mono uppercase tracking-wider shrink-0 cursor-help ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-slate-100 text-sm font-mono truncate">{current.source_line.trim()}</span>
                    <span className="text-slate-500 text-xs">{badge.desc} · {current.func_name}() · line {current.line_no}</span>
                  </div>
                </div>
              )
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SourceHighlighter code={submittedCode} current={current} />
            <div className="flex flex-col gap-4">
              <VariableInspector
                locals={current?.locals ?? {}}
                prevLocals={prevLocals}
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
