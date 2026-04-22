import { useState } from 'react'

const EXAMPLES: Record<string, string> = {
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
  onSubmit: (code: string) => void
  loading: boolean
}

export function CodeInput({ onSubmit, loading }: Props) {
  const [code, setCode] = useState(EXAMPLES['Factorial'])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-400 uppercase tracking-widest">Examples:</span>
        {Object.keys(EXAMPLES).map(name => (
          <button
            key={name}
            onClick={() => setCode(EXAMPLES[name])}
            className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            {name}
          </button>
        ))}
      </div>

      <textarea
        value={code}
        onChange={e => setCode(e.target.value)}
        className="w-full h-52 bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-slate-100 font-mono resize-none focus:outline-none focus:border-violet-500 transition-colors"
        spellCheck={false}
      />

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
