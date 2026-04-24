import Editor, { useMonaco } from '@monaco-editor/react'
import { useEffect } from 'react'

export const EXAMPLES: Record<string, string> = {
  Factorial: `def factorial(n):
    if n == 1:
        return 1
    return n * factorial(n - 1)

result = factorial(5)`,
  Fibonacci: `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

result = fib(6)`,
  'Bubble Sort': `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

result = bubble_sort([4, 2, 7, 1, 3])`,
  'Binary Search': `def binary_search(arr, target):
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

result = binary_search([1, 3, 5, 7, 9, 11], 7)`,
}

interface Props {
  code: string
  onCodeChange: (code: string) => void
  onSubmit: (code: string) => void
  loading: boolean
}

export function CodeInput({ code, onCodeChange, onSubmit, loading }: Props) {
  const monaco = useMonaco()

  useEffect(() => {
    if (!monaco) return
    monaco.editor.defineTheme('story-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#e2e8f0',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#94a3b8',
        'editor.lineHighlightBackground': '#1e293b80',
        'editorCursor.foreground': '#8b5cf6',
        'editor.selectionBackground': '#4c1d9580',
        'editorIndentGuide.background1': '#1e293b',
      },
    })
    monaco.editor.setTheme('story-dark')
  }, [monaco])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-400 uppercase tracking-widest">Examples:</span>
        {Object.keys(EXAMPLES).map(name => (
          <button
            key={name}
            onClick={() => onCodeChange(EXAMPLES[name])}
            className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            {name}
          </button>
        ))}
      </div>

      <div className="rounded-lg overflow-hidden border border-slate-700 focus-within:border-violet-500 transition-colors">
        <Editor
          height="220px"
          language="python"
          theme="story-dark"
          value={code}
          onChange={val => onCodeChange(val ?? '')}
          loading={
            <div className="h-[220px] bg-[#0d1117] flex items-center justify-center text-slate-500 text-sm font-mono">
              Loading editor…
            </div>
          }
          options={{
            fontSize: 13,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'off',
            tabSize: 4,
            insertSpaces: true,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'line',
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
          }}
        />
      </div>

      <button
        onClick={() => onSubmit(code)}
        disabled={loading || !code.trim()}
        className="self-end px-6 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {loading ? 'Tracing…' : 'Trace →'}
      </button>
    </div>
  )
}
