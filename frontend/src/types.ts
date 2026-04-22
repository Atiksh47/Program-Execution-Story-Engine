export interface TraceEvent {
  step: number
  event: 'call' | 'line' | 'return'
  line_no: number
  source_line: string
  func_name: string
  locals: Record<string, unknown>
  call_stack: string[]
  depth: number
  return_value: unknown
}

export interface Phase {
  name: string
  start_step: number
  end_step: number
}

export interface NarrationResponse {
  step_labels: Record<string, string>
  phases: Phase[]
  summary: string
}

export interface TraceResponse {
  events: TraceEvent[]
  total_steps: number
  capped: boolean
}
