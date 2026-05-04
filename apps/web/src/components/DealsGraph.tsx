'use client'

/**
 * DealsGraph — Obsidian-style force-directed graph.
 *
 * Visual goals:
 *   - Two node kinds: brand (purple, larger) and deal (teal, smaller)
 *   - Labels sit to the RIGHT of the node, not below
 *   - Thin, low-opacity edges
 *   - Subtle dot grid, dark canvas
 *   - Compact legend top-right
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { formatCurrency } from '@/lib/utils'
import type { ApiCompanyDetail, ApiDeal } from '@/lib/types'

const BRAND_COLOR = '#a78bfa'   // purple — "folder"
const DEAL_COLOR  = '#14b8a6'   // teal   — "note"

const STAGE_LABEL: Record<string, string> = {
  lead: 'Lead', discovery: 'Discovery', assessment: 'Assessment',
  qualified: 'Assessment', demo: 'Demo + Proposal', proposal: 'Demo + Proposal',
  proposal_demo: 'Demo + Proposal', negotiation: 'Follow-up',
  followup: 'Follow-up', closed_won: 'Won', closed_lost: 'Lost',
}

function formatGraphValue(v: string | null): string {
  if (!v) return ''
  const n = parseFloat(v)
  if (isNaN(n) || n === 0) return ''
  return formatCurrency(n)
}

type GraphNode = d3.SimulationNodeDatum & {
  id: string
  kind: 'brand' | 'deal'
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

type Tooltip = { x: number; y: number; node: GraphNode } | null

type DealsGraphProps = {
  companies: ApiCompanyDetail[]
  deals: ApiDeal[]
  onOpenDeal: (id: string) => void
  onOpenBrand?: (companyId: string) => void
  searchQuery?: string
}

export function DealsGraph({ companies, deals, onOpenDeal, onOpenBrand, searchQuery = '' }: DealsGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const viewportRef = useRef<{ W: number; H: number }>({ W: 900, H: 600 })
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const dealsRef = useRef(deals)
  const companiesRef = useRef(companies)
  const onOpenDealRef = useRef(onOpenDeal)
  const onOpenBrandRef = useRef(onOpenBrand)
  const [tooltip, setTooltip] = useState<Tooltip>(null)
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)

  const graphKey = useMemo(() => {
    const cs = companies.map(c => `${c.id}:${c.name}`).join('|')
    const ds = deals.map(d => `${d.id}:${d.title}:${d.stage}:${d.companyId ?? ''}`).join('|')
    return `${cs}||${ds}`
  }, [companies, deals])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery])

  const matchedNodeIds = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return null

    const matched = new Set<string>()

    for (const deal of deals) {
      const title = (deal.title ?? '').toLowerCase()
      const stage = (deal.stage ?? '').toLowerCase()
      const stageLabel = (STAGE_LABEL[deal.stage] || deal.stage || '').toLowerCase()
      if (
        title.includes(q) ||
        stage.includes(q) ||
        stageLabel.includes(q) ||
        (deal.assignedTo ?? '').toLowerCase().includes(q) ||
        (deal.servicesTags ?? []).some(s => (s ?? '').toLowerCase().includes(q))
      ) {
        matched.add(`d-${deal.id}`)
        if (deal.companyId) matched.add(`c-${deal.companyId}`)
        else matched.add('c-unassigned')
      }
    }

    for (const c of companies) {
      if (
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.industry ?? '').toLowerCase().includes(q) ||
        (c.domain ?? '').toLowerCase().includes(q)
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
  dealsRef.current = deals
  companiesRef.current = companies
  onOpenDealRef.current = onOpenDeal
  onOpenBrandRef.current = onOpenBrand

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    const container = containerRef.current!
    const W = container.clientWidth || 900
    const H = container.clientHeight || 600

    viewportRef.current = { W, H }

    svg.selectAll('*').remove()

    const companies = companiesRef.current
    const deals = dealsRef.current

    const companyMap = new Map<string, ApiCompanyDetail>()
    for (const c of companies) companyMap.set(c.id, c)

    const nodes: GraphNode[] = []
    const links: GraphLink[] = []

    const dealsWithCompany = deals.filter(d => d.companyId && companyMap.has(d.companyId))
    const dealsWithoutCompany = deals.filter(d => !d.companyId || !companyMap.has(d.companyId))

    for (const c of companies) {
      nodes.push({
        id: `c-${c.id}`,
        kind: 'brand',
        label: c.name ?? 'Unnamed',
        sublabel: c.industry || c.domain || undefined,
        color: BRAND_COLOR,
        r: 7,
        companyId: c.id,
      })
    }

    if (dealsWithoutCompany.length > 0) {
      nodes.push({
        id: 'c-unassigned',
        kind: 'brand',
        label: 'No Brand',
        sublabel: `${dealsWithoutCompany.length} deal${dealsWithoutCompany.length !== 1 ? 's' : ''}`,
        color: '#475569',
        r: 6,
      })
    }

    for (const deal of dealsWithCompany) {
      nodes.push({
        id: `d-${deal.id}`,
        kind: 'deal',
        label: deal.title ?? '(untitled)',
        sublabel: STAGE_LABEL[deal.stage] || deal.stage,
        color: DEAL_COLOR,
        r: 4,
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
        label: deal.title ?? '(untitled)',
        sublabel: STAGE_LABEL[deal.stage] || deal.stage,
        color: DEAL_COLOR,
        r: 4,
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

    svg.attr('width', W).attr('height', H)

    const root = svg.append('g').attr('class', 'root')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 6])
      .filter((event) => {
        if (event.type !== 'wheel') return true
        return event.ctrlKey
      })
      .on('zoom', (event) => {
        root.attr('transform', event.transform)
        setTooltip(null)
      })
    svg.call(zoom)
    svg.call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(1))

    svg.on('wheel.pan', (event: WheelEvent) => {
      if (event.ctrlKey) return
      event.preventDefault()
      const current = d3.zoomTransform(svg.node()!)
      const newTransform = current.translate(-event.deltaX / current.k, -event.deltaY / current.k)
      svg.call(zoom.transform, newTransform)
    }, { passive: false })

    zoomRef.current = zoom

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(70)
        .strength(0.85)
      )
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength(d => d.kind === 'brand' ? -180 : -90)
        .distanceMax(280)
      )
      .force('center', d3.forceCenter(0, 0).strength(0.08))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => d.r + 8).strength(0.7))
      .alphaDecay(0.025)

    simRef.current = sim

    // Edges — thin, low-opacity, plain stroke
    const linkSel = root.append('g').attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'rgba(255,255,255,0.12)')
      .attr('stroke-width', 0.5)

    // Nodes — single circle, no rings/glows
    const nodeSel = root.append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')

    nodeSel.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => d.color)
      .attr('fill-opacity', d => d.kind === 'brand' ? 0.95 : 0.85)
      .attr('stroke', d => d.color)
      .attr('stroke-opacity', 0.25)
      .attr('stroke-width', d => d.kind === 'brand' ? 6 : 3)

    // Right-side label
    nodeSel.append('text')
      .text(d => {
        const max = d.kind === 'brand' ? 26 : 22
        return d.label.length > max ? d.label.slice(0, max - 1) + '…' : d.label
      })
      .attr('x', d => d.r + 5)
      .attr('y', 0)
      .attr('dy', '0.32em')
      .attr('text-anchor', 'start')
      .attr('font-size', d => d.kind === 'brand' ? 10.5 : 9.5)
      .attr('font-weight', d => d.kind === 'brand' ? 500 : 400)
      .attr('fill', d => d.kind === 'brand' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)')
      .attr('font-family', 'system-ui, sans-serif')
      .style('pointer-events', 'none')

    nodeSel
      .on('mouseenter', (event: MouseEvent, d) => {
        setTooltip({ x: event.clientX, y: event.clientY, node: d })
      })
      .on('mousemove', (event: MouseEvent, d) => {
        setTooltip({ x: event.clientX, y: event.clientY, node: d })
      })
      .on('mouseleave', () => setTooltip(null))

    nodeSel.on('click', (_event, d) => {
      if (d.kind === 'deal' && d.dealId) {
        onOpenDealRef.current(d.dealId)
      } else if (d.kind === 'brand' && d.companyId && onOpenBrandRef.current) {
        onOpenBrandRef.current(d.companyId)
      }
    })

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey])

  // Search highlight + center
  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    const nodesGroup = svg.select<SVGGElement>('g.root g.nodes')
    const linksGroup = svg.select('g.root g.links')
    if (nodesGroup.empty()) return

    const q = debouncedSearch.trim().toLowerCase()

    if (!q) {
      nodesGroup.selectAll<SVGGElement, GraphNode>('g')
        .attr('visibility', 'visible')
        .attr('opacity', 1)
      linksGroup.selectAll<SVGLineElement, GraphLink>('line')
        .attr('visibility', 'visible')
        .attr('stroke-opacity', 1)
      return
    }

    const ids = new Set<string>()
    const dealsSnap = dealsRef.current
    const companiesSnap = companiesRef.current

    for (const deal of dealsSnap) {
      const title = (deal.title ?? '').toLowerCase()
      const stage = (deal.stage ?? '').toLowerCase()
      const stageLabel = (STAGE_LABEL[deal.stage] || deal.stage || '').toLowerCase()
      if (
        title.includes(q) ||
        stage.includes(q) ||
        stageLabel.includes(q) ||
        (deal.assignedTo ?? '').toLowerCase().includes(q) ||
        (deal.servicesTags ?? []).some(s => (s ?? '').toLowerCase().includes(q))
      ) {
        ids.add(`d-${deal.id}`)
        if (deal.companyId) ids.add(`c-${deal.companyId}`)
        else ids.add('c-unassigned')
      }
    }

    for (const c of companiesSnap) {
      if (
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.industry ?? '').toLowerCase().includes(q) ||
        (c.domain ?? '').toLowerCase().includes(q)
      ) {
        ids.add(`c-${c.id}`)
        for (const deal of dealsSnap) {
          if (deal.companyId === c.id) ids.add(`d-${deal.id}`)
        }
      }
    }

    nodesGroup.selectAll<SVGGElement, GraphNode>('g')
      .attr('visibility', d => ids.has(d.id) ? 'visible' : 'hidden')
      .attr('opacity', 1)

    linksGroup.selectAll<SVGLineElement, GraphLink>('line')
      .attr('visibility', d => {
        const src = (d.source as GraphNode).id
        const tgt = (d.target as GraphNode).id
        return ids.has(src) && ids.has(tgt) ? 'visible' : 'hidden'
      })

    if (ids.size === 0 || !zoomRef.current) return

    const matchedNodes: GraphNode[] = []
    nodesGroup.selectAll<SVGGElement, GraphNode>('g').each(d => {
      if (ids.has(d.id) && d.x != null && d.y != null) {
        matchedNodes.push(d)
      }
    })

    if (matchedNodes.length === 0) return

    const { W, H } = viewportRef.current
    let cx = 0, cy = 0
    for (const n of matchedNodes) { cx += n.x!; cy += n.y! }
    cx /= matchedNodes.length
    cy /= matchedNodes.length

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#0d0e13] select-none">
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {companies.length === 0 && deals.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-ssm text-white/30">No data to graph yet</div>
            <div className="text-xxs text-white/20 mt-1">Add brands and deals to see the graph</div>
          </div>
        </div>
      ) : (
        <>
          <svg ref={svgRef} className="w-full h-full" />
          {matchedNodeIds !== null && matchCount === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center bg-[#1a1d27]/90 backdrop-blur-sm rounded-xl px-6 py-4 border border-white/[0.08]">
                <div className="text-ssm text-white/50">No matches for &ldquo;{debouncedSearch}&rdquo;</div>
                <div className="text-xxs text-white/25 mt-1">Try a different search term</div>
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
            <p className="text-xs font-semibold text-white/90 leading-snug max-w-[220px] break-words">
              {tooltip.node.label}
            </p>
            {tooltip.node.sublabel && (
              <p className="text-atom mt-0.5 font-medium" style={{ color: tooltip.node.color }}>
                {tooltip.node.sublabel}
              </p>
            )}
            {tooltip.node.kind === 'deal' && tooltip.node.value && (
              <p className="text-atom text-white/40 mt-0.5 tabular-nums">
                {formatGraphValue(tooltip.node.value)}
              </p>
            )}
            <p className="text-atom text-white/25 mt-1.5 border-t border-white/[0.06] pt-1.5">
              {tooltip.node.kind === 'deal' ? 'Click to open deal →' : 'Click to view brand →'}
            </p>
          </div>
        </div>
      )}

      {/* Obsidian-style legend — top-right */}
      <div className="absolute top-3 left-3 flex items-center gap-3 px-3 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: BRAND_COLOR }} />
          <span className="text-atom text-white/50">brand</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: DEAL_COLOR }} />
          <span className="text-atom text-white/50">deal</span>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm pointer-events-none">
        <span className="text-atom text-white/30">Two-finger pan · Pinch to zoom · Ctrl+F to search</span>
      </div>
    </div>
  )
}
