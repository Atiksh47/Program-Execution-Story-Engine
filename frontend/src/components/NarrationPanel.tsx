import type { NarrationResponse } from '../types'

interface Props {
  narration: NarrationResponse | null
  loading: boolean
  currentStep: number
  onRequest: () => void
}

export function NarrationPanel({ narration, loading, currentStep, onRequest }: Props) {
  const label = narration?.step_labels[String(currentStep)]

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-widest">AI Narration</span>
        {!narration && (
          <button
            onClick={onRequest}
            disabled={loading}
            className="px-3 py-1 text-xs rounded bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white transition-colors"
          >
            {loading ? 'Generating…' : '✦ Narrate'}
          </button>
        )}
      </div>
      <div className="p-4 flex flex-col gap-3 text-sm">
        {!narration && !loading && (
          <span className="text-slate-600">Click "Narrate" to add AI annotations.</span>
        )}
        {loading && (
          <span className="text-slate-400 animate-pulse">Asking Claude to interpret the timeline…</span>
        )}
        {narration && (
          <>
            <p className="text-slate-200 leading-relaxed border-l-2 border-violet-500 pl-3">
              {narration.summary}
            </p>
            {label && (
              <div className="flex items-start gap-2">
                <span className="text-violet-400 text-xs uppercase tracking-widest mt-0.5">Step</span>
                <span className="text-slate-200 italic">"{label}"</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
