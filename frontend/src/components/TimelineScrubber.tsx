import type { TraceEvent, Phase } from '../types'

const SPEEDS = [
  { label: 'Slow', ms: 1400 },
  { label: 'Normal', ms: 800 },
  { label: 'Fast', ms: 250 },
]

interface Props {
  step: number
  total: number
  events: TraceEvent[]
  phases?: Phase[]
  speed: number
  onGoTo: (n: number) => void
  onPrev: () => void
  onNext: () => void
  onTogglePlay: () => void
  onSpeedChange: (ms: number) => void
  playing: boolean
}

const EVENT_COLOR: Record<string, string> = {
  call: 'bg-violet-500',
  line: 'bg-slate-500',
  return: 'bg-emerald-500',
}

export function TimelineScrubber({
  step, total, events, phases, speed, onGoTo, onPrev, onNext, onTogglePlay, onSpeedChange, playing,
}: Props) {
  if (total === 0) return null

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex flex-col gap-3">
      {/* Phase labels */}
      {phases && phases.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {phases.map(p => {
            const active = step >= p.start_step && step <= p.end_step
            return (
              <span
                key={p.name}
                onClick={() => onGoTo(p.start_step)}
                className={`px-2 py-0.5 rounded text-xs cursor-pointer transition-colors ${
                  active
                    ? 'bg-violet-500/30 border border-violet-500/60 text-violet-200'
                    : 'bg-slate-800 border border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
              >
                {p.name}
              </span>
            )
          })}
        </div>
      )}

      {/* Tick track */}
      <div className="flex gap-px h-4 items-end overflow-hidden rounded">
        {events.map((e, i) => (
          <div
            key={i}
            onClick={() => onGoTo(i)}
            title={`Step ${i}: ${e.event} in ${e.func_name}`}
            className={`flex-1 cursor-pointer rounded-sm transition-opacity ${EVENT_COLOR[e.event] ?? 'bg-slate-600'} ${
              i === step ? 'opacity-100 h-4' : 'opacity-30 h-2 hover:opacity-60'
            }`}
          />
        ))}
      </div>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={total - 1}
        value={step}
        onChange={e => onGoTo(Number(e.target.value))}
        className="w-full accent-violet-500"
      />

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onPrev}
          disabled={step === 0}
          className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-sm transition-colors"
        >
          ‹ Prev
        </button>
        <button
          onClick={onTogglePlay}
          className="px-4 py-1 rounded bg-violet-600 hover:bg-violet-500 text-sm transition-colors min-w-[80px]"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={onNext}
          disabled={step === total - 1}
          className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-sm transition-colors"
        >
          Next ›
        </button>

        {/* Speed control */}
        <div className="flex items-center gap-1 ml-2">
          <span className="text-xs text-slate-500">Speed:</span>
          {SPEEDS.map(s => (
            <button
              key={s.label}
              onClick={() => onSpeedChange(s.ms)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                speed === s.ms
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-slate-500 font-mono">
          step {step + 1} / {total}
        </span>
      </div>
    </div>
  )
}
