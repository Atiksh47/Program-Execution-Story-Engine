export interface TraceEvent {
  step: number
  event: 'call' | 'line' | 'return'
  line_no: number
  source_line: string
  func_name: string
  locals: Record<string, unknown>
  call_stack: string[]
  depth: number
  return_value: string | null
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

export interface CallTreeNode {
  id: number
  func_name: string
  args: Record<string, string>
  return_value: string | null
  start_step: number
  end_step: number | null
  depth: number
  children: CallTreeNode[]
}

export interface TraceResponse {
  events: TraceEvent[]
  total_steps: number
  capped: boolean
  stdout: string
  trace_id?: string
  code?: string
  call_tree?: CallTreeNode | null
}
