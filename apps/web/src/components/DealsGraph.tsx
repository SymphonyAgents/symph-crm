'use client'

/**
 * DealsGraph — Obsidian-style force-directed graph using D3 force simulation.
 *
 * - D3 force: forceLink (spring) + forceManyBody (repulsion) + forceCenter + forceCollide
 * - SVG rendered by React, positions updated by D3 simulation ticks
 * - Drag via d3-drag
 * - Zoom/pan via d3-zoom
 * - Company nodes: larger, labeled, colored by brand
 * - Deal nodes: smaller, colored by stage, click to open
 * - Hover tooltip
 */

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { ApiCompany, ApiDeal } from './Deals'

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGE_COLOR: Record<string, string> = {
  lead:          '#94a3b8',
  discovery:     '#2563eb',
  assessment:    '#7c3aed',
  qualified:     '#0369a1',
  demo:          '#d97706',
  proposal:      '#d97706',
  proposal_demo: '#d97706',
  negotiation:   '#f59e0b',
  followup:      '#f59e0b',
  closed_won:    '#16a34a',
  closed_lost:   '#dc2626',
}

const STAGE_LABEL: Record<string, string> = {
  lead: 'Lead', discovery: 'Discovery', assessment: 'Assessment',
  qualified: 'Qualified', demo: 'Demo', proposal: 'Proposal',
  proposal_demo: 'Demo + Proposal', negotiation: 'Negotiation',
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DealsGraph({ companies, deals, onOpenDeal }: DealsGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const [tooltip, setTooltip] = useState<Tooltip>(null)

  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    const container = containerRef.current!
    const W = container.clientWidth || 900
    const H = container.clientHeight || 600

    svg.selectAll('*').remove()

    // ── Build graph data ──────────────────────────────────────────────────────

    const companyMap = new Map<string, ApiCompany>()
    for (const c of companies) companyMap.set(c.id, c)

    const nodes: GraphNode[] = []
    const links: GraphLink[] = []

    // Filter deals with valid company references
    const dealsWithCompany = deals.filter(d => d.companyId && companyMap.has(d.companyId))
    const dealsWithoutCompany = deals.filter(d => !d.companyId || !companyMap.has(d.companyId))

    // Add ALL companies as nodes (including those without deals)
    for (const c of companies) {
      nodes.push({
        id: `c-${c.id}`,
        kind: 'company',
        label: c.name,
        sublabel: c.industry || c.domain || undefined,
        color: brandColor(c.name),
        r: 26,
      })
    }

    // Add "No Brand" node if there are unlinked deals
    if (dealsWithoutCompany.length > 0) {
      nodes.push({
        id: 'c-unassigned',
        kind: 'company',
        label: 'No Brand',
        sublabel: `${dealsWithoutCompany.length} deal${dealsWithoutCompany.length !== 1 ? 's' : ''}`,
        color: '#64748b',
        r: 22,
      })
    }

    for (const deal of dealsWithCompany) {
      nodes.push({
        id: `d-${deal.id}`,
        kind: 'deal',
        label: deal.title,
        sublabel: STAGE_LABEL[deal.stage] || deal.stage,
        color: STAGE_COLOR[deal.stage] || '#94a3b8',
        r: 10,
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
        r: 10,
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

    // Root group for zoom/pan
    const root = svg.append('g').attr('class', 'root')

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on('zoom', (event) => {
        root.attr('transform', event.transform)
        setTooltip(null)
      })
    svg.call(zoom)
    // Initial zoom to fit
    svg.call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(0.85))

    // ── Simulation ────────────────────────────────────────────────────────────

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(d => {
          const src = d.source as GraphNode
          return src.kind === 'company' ? 120 : 80
        })
        .strength(0.6)
      )
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength(d => d.kind === 'company' ? -800 : -200)
      )
      .force('center', d3.forceCenter(0, 0))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => d.r + 14).strength(0.8))
      .alphaDecay(0.015)

    simRef.current = sim

    // ── Draw edges ────────────────────────────────────────────────────────────

    const linkSel = root.append('g').attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => (d.target as GraphNode).color)
      .attr('stroke-opacity', 0.2)
      .attr('stroke-width', 1)

    // ── Draw nodes ────────────────────────────────────────────────────────────

    const nodeSel = root.append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', d => d.kind === 'deal' ? 'pointer' : 'grab')

    // Company: glow ring
    nodeSel.filter(d => d.kind === 'company')
      .append('circle')
      .attr('r', d => d.r + 10)
      .attr('fill', d => d.color)
      .attr('opacity', 0.07)

    // Outer ring
    nodeSel.append('circle')
      .attr('r', d => d.r + 2)
      .attr('fill', 'none')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.kind === 'company' ? 1.5 : 1)
      .attr('stroke-opacity', d => d.kind === 'company' ? 0.55 : 0.35)

    // Fill
    nodeSel.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => d.kind === 'company' ? d.color + '22' : d.color)
      .attr('fill-opacity', d => d.kind === 'company' ? 1 : 0.88)

    // Company: initials
    nodeSel.filter(d => d.kind === 'company')
      .append('text')
      .text(d => initials(d.label))
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', 10)
      .attr('font-weight', 700)
      .attr('fill', d => d.color)
      .attr('font-family', 'system-ui, sans-serif')
      .style('pointer-events', 'none')

    // Company: name label below node
    nodeSel.filter(d => d.kind === 'company')
      .append('text')
      .text(d => d.label.length > 20 ? d.label.slice(0, 19) + '…' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.r + 15)
      .attr('font-size', 11)
      .attr('font-weight', 600)
      .attr('fill', 'rgba(255,255,255,0.8)')
      .attr('font-family', 'system-ui, sans-serif')
      .style('pointer-events', 'none')

    // Company: sublabel
    nodeSel.filter(d => d.kind === 'company' && !!d.sublabel)
      .append('text')
      .text(d => (d.sublabel || '').length > 24 ? (d.sublabel || '').slice(0, 23) + '…' : d.sublabel || '')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.r + 27)
      .attr('font-size', 9)
      .attr('fill', 'rgba(255,255,255,0.33)')
      .attr('font-family', 'system-ui, sans-serif')
      .style('pointer-events', 'none')

    // Deal: name label below node
    nodeSel.filter(d => d.kind === 'deal')
      .append('text')
      .text(d => d.label.length > 16 ? d.label.slice(0, 15) + '…' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.r + 13)
      .attr('font-size', 8)
      .attr('fill', 'rgba(255,255,255,0.5)')
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

    // ── Click deal ────────────────────────────────────────────────────────────

    nodeSel.on('click', (_event, d) => {
      if (d.kind === 'deal' && d.dealId) onOpenDeal(d.dealId)
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
  }, [companies, deals, onOpenDeal])

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
        <svg ref={svgRef} className="w-full h-full" />
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
            {tooltip.node.kind === 'deal' && (
              <p className="text-[9px] text-white/25 mt-1.5 border-t border-white/[0.06] pt-1.5">
                Click to open deal →
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stage legend */}
      <div className="absolute top-3 left-3 bg-[#1a1d27]/90 backdrop-blur-sm border border-white/[0.08] rounded-lg px-3 py-2.5 pointer-events-none">
        <p className="text-[9px] font-semibold text-white/30 uppercase tracking-wider mb-2">Stages</p>
        <div className="grid grid-cols-2 gap-x-5 gap-y-1">
          {Object.entries(STAGE_LABEL).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STAGE_COLOR[k] }} />
              <span className="text-[9px] text-white/40">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-3 right-3 bg-[#1a1d27]/80 backdrop-blur-sm border border-white/[0.08] rounded-lg px-2.5 py-1.5 pointer-events-none">
        <span className="text-[10px] text-white/30">Scroll to zoom · Drag to pan · Click deal to open</span>
      </div>
    </div>
  )
}
