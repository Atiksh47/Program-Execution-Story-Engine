import { useMemo, useEffect, useRef } from 'react'
import type { JSX } from 'react'
import type { CallTreeNode } from '../types'

// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_W = 124
const NODE_H = 62
const H_GAP  = 18
const V_STEP = 100
const PAD    = 28

// ── Layout types ──────────────────────────────────────────────────────────────
interface LayoutNode {
  id: number
  x: number   // center x in canvas space
  y: number   // center y in canvas space
  node: CallTreeNode
  children: LayoutNode[]
}

// ── Layout algorithm ──────────────────────────────────────────────────────────

function subtreeWidth(node: CallTreeNode): number {
  if (node.children.length === 0) return NODE_W + H_GAP
  return Math.max(
    NODE_W + H_GAP,
    node.children.reduce((sum, c) => sum + subtreeWidth(c), 0),
  )
}

function buildLayout(node: CallTreeNode, cx: number, cy: number): LayoutNode {
  const children: LayoutNode[] = []
  if (node.children.length > 0) {
    const total = node.children.reduce((s, c) => s + subtreeWidth(c), 0)
    let x = cx - total / 2
    for (const child of node.children) {
      const w = subtreeWidth(child)
      children.push(buildLayout(child, x + w / 2, cy + V_STEP))
      x += w
    }
  }
  return { id: node.id, x: cx, y: cy, node, children }
}

function getBounds(layout: LayoutNode): { minX: number; maxX: number; maxY: number } {
  let minX = layout.x - NODE_W / 2
  let maxX = layout.x + NODE_W / 2
  let maxY = layout.y + NODE_H / 2
  for (const child of layout.children) {
    const b = getBounds(child)
    minX = Math.min(minX, b.minX)
    maxX = Math.max(maxX, b.maxX)
    maxY = Math.max(maxY, b.maxY)
  }
  return { minX, maxX, maxY }
}

function shiftLayout(layout: LayoutNode, dx: number): void {
  layout.x += dx
  for (const child of layout.children) shiftLayout(child, dx)
}

// ── Tree search helpers ───────────────────────────────────────────────────────

function findActiveId(layout: LayoutNode, step: number): number | null {
  // Check children first so the deepest (most specific) match wins
  for (const child of layout.children) {
    const found = findActiveId(child, step)
    if (found !== null) return found
  }
  const { start_step, end_step } = layout.node
  if (step >= start_step && (end_step === null || step <= end_step)) return layout.id
  return null
}

function findLayoutById(nodes: LayoutNode[], id: number): LayoutNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findLayoutById(node.children, id)
    if (found) return found
  }
  return null
}

// Returns the path from this layout node down to the target id (inclusive)
function findActivePath(layout: LayoutNode, targetId: number): LayoutNode[] | null {
  if (layout.id === targetId) return [layout]
  for (const child of layout.children) {
    const path = findActivePath(child, targetId)
    if (path) return [layout, ...path]
  }
  return null
}

// ── SVG lines ─────────────────────────────────────────────────────────────────

interface LineProps { key: string; x1: number; y1: number; x2: number; y2: number }

function collectLines(layout: LayoutNode, activeId: number | null): LineProps[] {
  const lines: LineProps[] = []
  for (const child of layout.children) {
    lines.push({
      key: `${layout.id}-${child.id}`,
      x1: layout.x, y1: layout.y + NODE_H / 2,
      x2: child.x,  y2: child.y  - NODE_H / 2,
    })
    lines.push(...collectLines(child, activeId))
  }
  return lines
}

// Check if a node is an ancestor of the active node
function isAncestorOfActive(layout: LayoutNode, activeId: number | null): boolean {
  if (activeId === null) return false
  return findActivePath(layout, activeId) !== null
}

// ── Node box ──────────────────────────────────────────────────────────────────

interface NodeBoxProps {
  layout: LayoutNode
  isActive: boolean
  isAncestor: boolean
  onNodeClick: (step: number) => void
}

function NodeBox({ layout, isActive, isAncestor, onNodeClick }: NodeBoxProps) {
  const { node, x, y } = layout
  const argStr = Object.entries(node.args).map(([k, v]) => `${k}=${v}`).join(', ')

  return (
    <div
      onClick={() => onNodeClick(node.start_step)}
      className={`absolute flex flex-col justify-center px-3 py-1.5 rounded-lg border text-xs font-mono cursor-pointer select-none transition-all duration-200 ${
        isActive
          ? 'bg-violet-500/30 border-violet-400 text-violet-100 shadow-lg shadow-violet-500/25 ring-1 ring-violet-400/50'
          : isAncestor
          ? 'bg-slate-800 border-violet-700/50 text-slate-200'
          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-700/70'
      }`}
      style={{
        left:   x - NODE_W / 2,
        top:    y - NODE_H / 2,
        width:  NODE_W,
        height: NODE_H,
      }}
      title={`step ${node.start_step}${node.end_step != null ? `–${node.end_step}` : ' (running)'}`}
    >
      <span className={`font-semibold truncate leading-tight ${isActive ? 'text-violet-200' : isAncestor ? 'text-slate-100' : 'text-slate-200'}`}>
        {node.func_name}
      </span>
      {argStr && (
        <span className={`truncate leading-tight text-[11px] ${isActive ? 'text-violet-300/80' : 'text-slate-500'}`}>
          {argStr}
        </span>
      )}
      {node.return_value != null && (
        <span className="text-emerald-400 truncate leading-tight text-[11px]">→ {node.return_value}</span>
      )}
    </div>
  )
}

// ── Recursive render ──────────────────────────────────────────────────────────

function renderNodes(
  layout: LayoutNode,
  activeId: number | null,
  onNodeClick: (step: number) => void,
): JSX.Element[] {
  const ancestor = layout.id !== activeId && isAncestorOfActive(layout, activeId)
  const nodes: JSX.Element[] = [
    <NodeBox
      key={layout.id}
      layout={layout}
      isActive={layout.id === activeId}
      isAncestor={ancestor}
      onNodeClick={onNodeClick}
    />,
  ]
  for (const child of layout.children) {
    nodes.push(...renderNodes(child, activeId, onNodeClick))
  }
  return nodes
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  tree: CallTreeNode
  currentStep: number
  onNodeClick: (step: number) => void
}

export function CallTreeView({ tree, currentStep, onNodeClick }: Props) {
  const displayRoots = tree.children
  const containerRef = useRef<HTMLDivElement>(null)

  const { layouts, canvasW, canvasH } = useMemo(() => {
    if (displayRoots.length === 0) return { layouts: [], canvasW: 200, canvasH: 100 }

    const layouts: LayoutNode[] = []
    let curX = 0
    for (const root of displayRoots) {
      const w = subtreeWidth(root)
      layouts.push(buildLayout(root, curX + w / 2, NODE_H / 2 + PAD))
      curX += w
    }

    const allBounds = layouts.map(getBounds)
    const globalMinX = Math.min(...allBounds.map(b => b.minX))
    const globalMaxX = Math.max(...allBounds.map(b => b.maxX))
    const globalMaxY = Math.max(...allBounds.map(b => b.maxY))

    const shift = PAD - globalMinX
    for (const l of layouts) shiftLayout(l, shift)

    return {
      layouts,
      canvasW: globalMaxX - globalMinX + PAD * 2,
      canvasH: globalMaxY + PAD,
    }
  }, [tree]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeId = useMemo(() => {
    for (const l of layouts) {
      const found = findActiveId(l, currentStep)
      if (found !== null) return found
    }
    return null
  }, [layouts, currentStep])

  // Build the breadcrumb path from top-level root to active node
  const activePath = useMemo<LayoutNode[]>(() => {
    if (activeId === null) return []
    for (const l of layouts) {
      const path = findActivePath(l, activeId)
      if (path) return path
    }
    return []
  }, [layouts, activeId])

  // Auto-scroll the canvas so the active node stays centered in view
  useEffect(() => {
    if (activeId === null || !containerRef.current) return
    const active = findLayoutById(layouts, activeId)
    if (!active) return
    const el = containerRef.current
    el.scrollTo({
      left: Math.max(0, active.x - el.clientWidth / 2),
      top:  Math.max(0, active.y - el.clientHeight / 2),
      behavior: 'smooth',
    })
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (displayRoots.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        No function calls to display.
      </div>
    )
  }

  const allLines = layouts.flatMap(l => collectLines(l, activeId))

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between shrink-0">
        <span className="text-xs text-slate-400 uppercase tracking-widest">Call Tree</span>
        <span className="text-xs text-slate-600">click node to jump · highlighted = active call</span>
      </div>

      {/* Breadcrumb — current call path */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/40 min-h-[36px] flex items-center shrink-0">
        {activePath.length === 0 ? (
          <span className="text-slate-600 text-xs font-mono">— scrub the timeline to see the active call —</span>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            {activePath.map((l, i) => {
              const isLast = i === activePath.length - 1
              const argStr = Object.entries(l.node.args).map(([k, v]) => `${k}=${v}`).join(', ')
              return (
                <span key={l.id} className="flex items-center gap-1">
                  <button
                    onClick={() => onNodeClick(l.node.start_step)}
                    className={`text-xs font-mono px-1.5 py-0.5 rounded transition-colors ${
                      isLast
                        ? 'text-violet-300 bg-violet-500/15'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {l.node.func_name}({argStr})
                  </button>
                  {!isLast && <span className="text-slate-600 text-xs">›</span>}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="overflow-auto" style={{ maxHeight: 460 }}>
        <div className="relative" style={{ width: canvasW, height: canvasH }}>
          <svg className="absolute inset-0 pointer-events-none" width={canvasW} height={canvasH}>
            {allLines.map(({ key, ...props }) => (
              <line key={key} {...props} stroke="#1e293b" strokeWidth={1.5} strokeLinecap="round" />
            ))}
          </svg>
          {layouts.flatMap(l => renderNodes(l, activeId, onNodeClick))}
        </div>
      </div>
    </div>
  )
}
