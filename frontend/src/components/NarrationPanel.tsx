import type { NarrationResponse, Phase } from '../types'

function currentPhase(phases: Phase[], step: number): Phase | null {
  return phases.find(p => step >= p.start_step && step <= p.end_step) ?? null
}

interface Props {
  narration: NarrationResponse | null
  streamingSummary: string
  loading: boolean
  currentStep: number
  onRequest: () => void
}

export function NarrationPanel({ narration, streamingSummary, loading, currentStep, onRequest }: Props) {
  const label = narration?.step_labels[String(currentStep)]
  const phase = narration ? currentPhase(narration.phases, currentStep) : null

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 uppercase tracking-widest">AI Narration</span>
          {phase && (
            <span className="px-2 py-0.5 rounded text-xs bg-violet-500/20 border border-violet-500/40 text-violet-300">
              {phase.name}
            </span>
          )}
        </div>
        <button
          onClick={onRequest}
          disabled={loading}
          className="px-3 py-1 text-xs rounded bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white transition-colors"
        >
          {loading ? 'Generating…' : narration ? '↺ Re-narrate' : '✦ Narrate'}
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3 text-sm">
        {!narration && !loading && !streamingSummary && (
          <span className="text-slate-600">Click "Narrate" to add AI annotations.</span>
        )}

        {/* Streaming: show progressively revealed summary while loading */}
        {loading && (
          streamingSummary ? (
            <p className="text-slate-300 leading-relaxed border-l-2 border-violet-500/50 pl-3">
              {streamingSummary}
              <span className="inline-block w-1 h-3.5 bg-violet-400 ml-0.5 animate-pulse align-middle" />
            </p>
          ) : (
            <span className="text-slate-400 animate-pulse">Asking local model to interpret the timeline…</span>
          )
        )}

        {narration && (
          <>
            <p className="text-slate-200 leading-relaxed border-l-2 border-violet-500 pl-3">
              {narration.summary}
            </p>
            {label && (
              <div className="flex items-start gap-2">
                <span className="text-violet-400 text-xs uppercase tracking-widest mt-0.5 shrink-0">Step</span>
                <span className="text-slate-200 italic">"{label}"</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
