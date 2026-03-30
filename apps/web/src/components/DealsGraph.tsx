'use client'

/**
 * DealsGraph — Obsidian-style force-directed graph using D3 force simulation.
 *
 * Layout tuned to match Obsidian's tight, clustered aesthetic:
 *   - Short link distances (60-40px) keep clusters compact
 *   - Moderate repulsion to avoid overlap without excessive spacing
 *   - Strong center gravity pulls everything toward the middle
 *   - High alpha decay for fast settling
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import type { ApiCompany, ApiDeal } from './Deals'

// ─── Stage config (7 kanban stages — matches Pipeline.tsx) ───────────────────

/** Maps every DB stage value to its kanban column color */
const STAGE_COLOR: Record<string, string> = {
  lead:          '#94a3b8',
  discovery:     '#2563eb',
  assessment:    '#7c3aed',
  qualified:     '#7c3aed',   // grouped with assessment
  demo:          '#d97706',
  proposal:      '#d97706',
  proposal_demo: '#d97706',   // grouped as Demo + Proposal
  negotiation:   '#f59e0b',
  followup:      '#f59e0b',   // grouped as Follow-up
  closed_won:    '#16a34a',
  closed_lost:   '#dc2626',
}

/** The 7 kanban columns shown in the legend */
const LEGEND_STAGES: { id: string; label: string; color: string }[] = [
  { id: 'lead',        label: 'Lead',            color: '#94a3b8' },
  { id: 'discovery',   label: 'Discovery',       color: '#2563eb' },
  { id: 'assessment',  label: 'Assessment',      color: '#7c3aed' },
  { id: 'demo_prop',   label: 'Demo + Proposal', color: '#d97706' },
  { id: 'followup',    label: 'Follow-up',       color: '#f59e0b' },
  { id: 'closed_won',  label: 'Won',             color: '#16a34a' },
  { id: 'closed_lost', label: 'Lost',            color: '#dc2626' },
]

/** Sublabel text for tooltips */
const STAGE_LABEL: Record<string, string> = {
  lead: 'Lead', discovery: 'Discovery', assessment: 'Assessment',
  qualified: 'Assessment', demo: 'Demo + Proposal', proposal: 'Demo + Proposal',
  proposal_demo: 'Demo + Proposal', negotiation: 'Follow-up',
  followup: 'Follow-up', closed_won: 'Won', closed_lost: 'Lost',
}

// ─── Brand color ──────────────────────────────────────────────────────────────

const PALETTE = ['#2563eb','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16']
function brandColor(name: string | null | undefined): string {
  const str = name || 'default'
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function formatValue(v: string | null): string {
  if (!v) return ''
  const n = parseFloat(v)
  if (isNaN(n) || n === 0) return ''
  if (n >= 1_000_000) return 'P' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return 'P' + Math.round(n / 1_000) + 'K'
  return 'P' + n.toLocaleString('en-PH')
}

function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase()
}

// ─── D3 types ─────────────────────────────────────────────────────────────────

type GraphNode = d3.SimulationNodeDatum & {
  id: string
  kind: 'company' | 'deal'
  label: string
  sublabel?: string
  color: string
  r: number
  dealId?: string
  companyId?: string
  stage?: string
  value?: string | null
}

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  id: string
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

type Tooltip = { x: number; y: number; node: GraphNode } | null

// ─── Props ────────────────────────────────────────────────────────────────────

type DealsGraphProps = {
  companies: ApiCompany[]
  deals: ApiDeal[]
  onOpenDeal: (id: string) => void
  onOpenBrand?: (companyId: string) => void
  searchQuery?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DealsGraph({ companies, deals, onOpenDeal, onOpenBrand, searchQuery = '' }: DealsGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const viewportRef = useRef<{ W: number; H: number }>({ W: 900, H: 600 })
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const [tooltip, setTooltip] = useState<Tooltip>(null)
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)

  // Debounce searchQuery → debouncedSearch (300ms) to prevent flicker on keystrokes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery])

  // Compute which node IDs match the search (null = no active search)
  const matchedNodeIds = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return null

    const matched = new Set<string>()

    for (const deal of deals) {
      if (
        deal.title.toLowerCase().includes(q) ||
        deal.stage.toLowerCase().includes(q) ||
        (deal.servicesTags ?? []).some(s => s.toLowerCase().includes(q))
      ) {
        matched.add(`d-${deal.id}`)
        if (deal.companyId) matched.add(`c-${deal.companyId}`)
        else matched.add('c-unassigned')
      }
    }

    for (const c of companies) {
      if (
        c.name.toLowerCase().includes(q) ||
        (c.industry || '').toLowerCase().includes(q) ||
        (c.domain || '').toLowerCase().includes(q)
      ) {
        matched.add(`c-${c.id}`)
        for (const deal of deals) {
          if (deal.companyId === c.id) matched.add(`d-${deal.id}`)
        }
      }
    }

    return matched
  }, [debouncedSearch, deals, companies])

  const matchCount = matchedNodeIds?.size ?? 0

  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    const container = containerRef.current!
    const W = container.clientWidth || 900
    const H = container.clientHeight || 600

    viewportRef.current = { W, H }

    svg.selectAll('*').remove()

    // ── Build graph data ──────────────────────────────────────────────────────

    const companyMap = new Map<string, ApiCompany>()
    for (const c of companies) companyMap.set(c.id, c)

    const nodes: GraphNode[] = []
    const links: GraphLink[] = []

    const dealsWithCompany = deals.filter(d => d.companyId && companyMap.has(d.companyId))
    const dealsWithoutCompany = deals.filter(d => !d.companyId || !companyMap.has(d.companyId))

    for (const c of companies) {
      nodes.push({
        id: `c-${c.id}`,
        kind: 'company',
        label: c.name,
        sublabel: c.industry || c.domain || undefined,
        color: brandColor(c.name),
        r: 22,
        companyId: c.id,
      })
    }

    if (dealsWithoutCompany.length > 0) {
      nodes.push({
        id: 'c-unassigned',
        kind: 'company',
        label: 'No Brand',
        sublabel: `${dealsWithoutCompany.length} deal${dealsWithoutCompany.length !== 1 ? 's' : ''}`,
        color: '#64748b',
        r: 18,
      })
    }

    for (const deal of dealsWithCompany) {
      nodes.push({
        id: `d-${deal.id}`,
        kind: 'deal',
        label: deal.title,
        sublabel: STAGE_LABEL[deal.stage] || deal.stage,
        color: STAGE_COLOR[deal.stage] || '#94a3b8',
        r: 8,
        dealId: deal.id,
        stage: deal.stage,
        value: deal.value,
      })
      links.push({
        id: `e-${deal.id}`,
        source: `c-${deal.companyId}`,
        target: `d-${deal.id}`,
      })
    }

    for (const deal of dealsWithoutCompany) {
      nodes.push({
        id: `d-${deal.id}`,
        kind: 'deal',
        label: deal.title,
        sublabel: STAGE_LABEL[deal.stage] || deal.stage,
        color: STAGE_COLOR[deal.stage] || '#94a3b8',
        r: 8,
        dealId: deal.id,
        stage: deal.stage,
        value: deal.value,
      })
      links.push({
        id: `e-${deal.id}`,
        source: 'c-unassigned',
        target: `d-${deal.id}`,
      })
    }

    if (nodes.length === 0) return

    // ── SVG setup ─────────────────────────────────────────────────────────────

    svg.attr('width', W).attr('height', H)

    const root = svg.append('g').attr('class', 'root')

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 6])
      .on('zoom', (event) => {
        root.attr('transform', event.transform)
        setTooltip(null)
      })
    svg.call(zoom)
    svg.call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(1))

    zoomRef.current = zoom

    // ── Simulation — Obsidian-tight layout ──────────────────────────────────

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(55)
        .strength(0.9)
      )
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength(d => d.kind === 'company' ? -300 : -80)
        .distanceMax(250)
      )
      .force('center', d3.forceCenter(0, 0).strength(0.1))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => d.r + 6).strength(0.7))
      .alphaDecay(0.028)

    simRef.current = sim

    // ── Draw edges ────────────────────────────────────────────────────────────

    const linkSel = root.append('g').attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => (d.target as GraphNode).color)
      .attr('stroke-opacity', 0.15)
      .attr('stroke-width', 0.8)

    // ── Draw nodes ────────────────────────────────────────────────────────────

    const nodeSel = root.append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')

    // Company: glow ring
    nodeSel.filter(d => d.kind === 'company')
      .append('circle')
      .attr('r', d => d.r + 8)
      .attr('fill', d => d.color)
      .attr('opacity', 0.06)

    // Outer ring
    nodeSel.append('circle')
      .attr('r', d => d.r + 1.5)
      .attr('fill', 'none')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.kind === 'company' ? 1.2 : 0.8)
      .attr('stroke-opacity', d => d.kind === 'company' ? 0.5 : 0.3)

    // Fill
    nodeSel.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => d.kind === 'company' ? d.color + '22' : d.color)
      .attr('fill-opacity', d => d.kind === 'company' ? 1 : 0.85)

    // Company: initials
    nodeSel.filter(d => d.kind === 'company')
      .append('text')
      .text(d => initials(d.label))
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', 9)
      .attr('font-weight', 700)
      .attr('fill', d => d.color)
      .attr('font-family', 'system-ui, sans-serif')
      .style('pointer-events', 'none')

    // Company: name label below
    nodeSel.filter(d => d.kind === 'company')
      .append('text')
      .text(d => d.label.length > 18 ? d.label.slice(0, 17) + '…' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.r + 13)
      .attr('font-size', 10)
      .attr('font-weight', 600)
      .attr('fill', 'rgba(255,255,255,0.75)')
      .attr('font-family', 'system-ui, sans-serif')
      .style('pointer-events', 'none')

    // Deal: name label below
    nodeSel.filter(d => d.kind === 'deal')
      .append('text')
      .text(d => d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.r + 11)
      .attr('font-size', 7.5)
      .attr('fill', 'rgba(255,255,255,0.45)')
      .attr('font-family', 'system-ui, sans-serif')
      .style('pointer-events', 'none')

    // ── Hover tooltip ─────────────────────────────────────────────────────────

    nodeSel
      .on('mouseenter', (event: MouseEvent, d) => {
        setTooltip({ x: event.clientX, y: event.clientY, node: d })
      })
      .on('mousemove', (event: MouseEvent, d) => {
        setTooltip({ x: event.clientX, y: event.clientY, node: d })
      })
      .on('mouseleave', () => setTooltip(null))

    // ── Click — deals open deal detail, brands open brand detail ─────────────

    nodeSel.on('click', (_event, d) => {
      if (d.kind === 'deal' && d.dealId) {
        onOpenDeal(d.dealId)
      } else if (d.kind === 'company' && d.companyId && onOpenBrand) {
        onOpenBrand(d.companyId)
      }
    })

    // ── Drag ─────────────────────────────────────────────────────────────────

    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart()
        d.fx = d.x; d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x; d.fy = event.y
        setTooltip(null)
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0)
        d.fx = null; d.fy = null
      })

    nodeSel.call(drag)

    // ── Tick ─────────────────────────────────────────────────────────────────

    sim.on('tick', () => {
      linkSel
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!)

      nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      sim.stop()
    }
  }, [companies, deals, onOpenDeal, onOpenBrand])

  // ── Search highlight + center (no zoom change) ────────────────────────────
  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    const nodesGroup = svg.select<SVGGElement>('g.root g.nodes')
    const linksGroup = svg.select('g.root g.links')
    if (nodesGroup.empty()) return

    if (!matchedNodeIds) {
      // No active search — restore full visibility
      nodesGroup.selectAll<SVGGElement, GraphNode>('g')
        .attr('visibility', 'visible')
        .attr('opacity', 1)
      linksGroup.selectAll<SVGLineElement, GraphLink>('line')
        .attr('visibility', 'visible')
        .attr('stroke-opacity', 0.15)
      return
    }

    // Hide non-matching nodes entirely, show only matches
    nodesGroup.selectAll<SVGGElement, GraphNode>('g')
      .attr('visibility', d => matchedNodeIds.has(d.id) ? 'visible' : 'hidden')
      .attr('opacity', 1)

    // Hide non-matching links
    linksGroup.selectAll<SVGLineElement, GraphLink>('line')
      .attr('visibility', d => {
        const src = (d.source as GraphNode).id
        const tgt = (d.target as GraphNode).id
        return matchedNodeIds.has(src) && matchedNodeIds.has(tgt) ? 'visible' : 'hidden'
      })
      .attr('stroke-opacity', 0.35)

    // ── Center on matched nodes (keep current zoom scale) ─────────────────
    if (matchedNodeIds.size === 0 || !zoomRef.current) return

    const matchedNodes: GraphNode[] = []
    nodesGroup.selectAll<SVGGElement, GraphNode>('g').each(d => {
      if (matchedNodeIds.has(d.id) && d.x != null && d.y != null) {
        matchedNodes.push(d)
      }
    })

    if (matchedNodes.length === 0) return

    const { W, H } = viewportRef.current

    // Compute centroid of matched nodes
    let cx = 0, cy = 0
    for (const n of matchedNodes) { cx += n.x!; cy += n.y! }
    cx /= matchedNodes.length
    cy /= matchedNodes.length

    // Get current zoom scale and pan to centroid at same scale
    const currentTransform = d3.zoomTransform(svgRef.current!)
    const scale = currentTransform.k

    const targetTransform = d3.zoomIdentity
      .translate(W / 2, H / 2)
      .scale(scale)
      .translate(-cx, -cy)

    d3.select(svgRef.current!)
      .transition()
      .duration(400)
      .ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform, targetTransform)
  }, [matchedNodeIds])

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#0f1117] select-none">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {companies.length === 0 && deals.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-[13px] text-white/30">No data to graph yet</div>
            <div className="text-[11px] text-white/20 mt-1">Add brands and deals to see the graph</div>
          </div>
        </div>
      ) : (
        <>
          <svg ref={svgRef} className="w-full h-full" />
          {matchedNodeIds !== null && matchCount === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center bg-[#1a1d27]/90 backdrop-blur-sm rounded-xl px-6 py-4 border border-white/[0.08]">
                <div className="text-[13px] text-white/50">No matches for &ldquo;{debouncedSearch}&rdquo;</div>
                <div className="text-[11px] text-white/25 mt-1">Try a different search term</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <div className="bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2 shadow-2xl min-w-[140px]">
            <p className="text-[12px] font-semibold text-white/90 leading-snug max-w-[200px] break-words">
              {tooltip.node.label}
            </p>
            {tooltip.node.sublabel && (
              <p className="text-[10px] mt-0.5 font-medium" style={{ color: tooltip.node.color }}>
                {tooltip.node.sublabel}
              </p>
            )}
            {tooltip.node.kind === 'deal' && tooltip.node.value && (
              <p className="text-[10px] text-white/40 mt-0.5 tabular-nums">
                {formatValue(tooltip.node.value)}
              </p>
            )}
            <p className="text-[9px] text-white/25 mt-1.5 border-t border-white/[0.06] pt-1.5">
              {tooltip.node.kind === 'deal' ? 'Click to open deal →' : 'Click to view brand →'}
            </p>
          </div>
        </div>
      )}

      {/* Stage legend — 7 kanban stages */}
      <div className="absolute top-3 left-3 bg-[#1a1d27]/90 backdrop-blur-sm border border-white/[0.08] rounded-lg px-3 py-2.5 pointer-events-none">
        <p className="text-[9px] font-semibold text-white/30 uppercase tracking-wider mb-2">Stages</p>
        <div className="flex flex-col gap-1">
          {LEGEND_STAGES.map(s => (
            <div key={s.id} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-[9px] text-white/40">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-3 right-3 bg-[#1a1d27]/80 backdrop-blur-sm border border-white/[0.08] rounded-lg px-2.5 py-1.5 pointer-events-none">
        <span className="text-[10px] text-white/30">Scroll to zoom · Drag to pan · Ctrl+F to search</span>
      </div>
    </div>
  )
}
