import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background, Controls, ViewportPortal, Handle, Position, MarkerType, ReactFlow, ReactFlowProvider, useReactFlow, useNodesInitialized, type Node, type NodeProps, type NodeChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'
import catalogData from './data/catalog-2025-2026.json'
import type { CatalogSnapshot } from './data/catalog-snapshot'
import minorData from './data/minor-2025-2026.json'
import { loadPlannerCatalog, type MinorSupplement } from './data/minor-catalog'
import type { Course } from './data/catalog-schema'
import { buildMathematicsCatalog, mathematics } from './data/math-bs-catalog'
import { computerScience, programStarterIds, programStorageKey, type ProgramDefinition } from './data/program-definition'
import { buildPrerequisiteGraph, graphCourseId } from './data/prerequisite-graph'
import { completionView } from './data/completion-view'
import { sectionView } from './data/section-view'
import { beginBranchDrag, branchPositions, type BranchDrag } from './data/branch-drag'
import { usePlan } from './use-plan'
import { connectionError } from './data/personal-connections'
import { ConnectionTools } from './ConnectionTools'
import type { Plan, Position as PlanPosition } from './data/plan-state'
import { calculatePlanProgress } from './data/credit-allocation'
import { ExportPicture } from './ExportPicture'
import type { PictureInput } from './plan-picture'

const catalogResult = loadPlannerCatalog(catalogData, minorData)
// Only reviewed catalogs are selectable. Draft majors are tracked in docs/multi-major-plan.md.
const availablePrograms = catalogResult.ok ? [{ definition: computerScience, ...catalogResult }, { definition: mathematics, ...buildMathematicsCatalog(catalogResult.snapshot, catalogResult.programs) }] : []
type Theme = 'light' | 'dark'
type CourseNode = Node<{ course: Course; option: boolean; selected?: boolean; onSelect?: (courseId: string, value: boolean) => void; reference?: boolean; connected?: boolean; taken?: boolean; onTaken?: (courseId: string, value: boolean) => void; onInfo: (course: Course, nodeId: string) => void }, 'course'>
type LogicNode = Node<{ title: string; kind: string; onInfo: () => void }, 'logic'>
type TakenNode = Node<{ title: string }, 'taken'>
type HeadingNode = Node<{ title: string; subtitle: string }, 'heading'>
const hours = (credits: Course['credits']) => credits.min === credits.max ? `${credits.min}` : `${credits.min}–${credits.max}`

function CourseCard({ id, data }: NodeProps<CourseNode>) {
  const { course } = data
  return <article className={`course-card ${data.option ? 'option-card' : ''} ${data.taken ? 'course-taken' : ''}`} aria-label={`${course.code}: ${course.title}`}>
    {<><Handle type="target" position={Position.Left} /><Handle type="source" position={Position.Right} /></>}<div className="card-top"><strong>{course.code}</strong><div className="card-actions nodrag nopan nowheel" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
      <button className="plan-button" aria-pressed={!!data.selected} aria-label={`${data.selected ? "Remove" : "Add"} ${course.code} ${data.selected ? "from" : "to"} plan`} title={data.selected ? "Remove from planned hours" : "Add to planned hours"} onClick={() => data.onSelect?.(course.id, !data.selected)}>{data.selected ? "✓" : "+"}</button>
      <button aria-label={`Information about ${course.code}`} onClick={() => data.onInfo(course, id)}>i</button>
      <button className="taken-button" aria-pressed={!!data.taken} aria-label={`Mark ${course.code} ${data.taken ? "not taken" : "taken"}`} title={data.taken ? "Restore course as not taken" : "Mark course taken"} onClick={() => data.onTaken?.(course.id, !data.taken)}>{data.taken ? "↶" : "−"}</button>
    </div></div>
    <h3>{course.title}</h3>
    <div className="card-bottom"><span>{hours(course.credits)} credit hours</span><span>{course.review !== 'verified' ? 'Review needed' : [data.selected ? 'Planned' : data.reference ? 'Reference' : 'Option', ...(data.taken ? ['Taken'] : [])].join(' / ')}</span></div>
  </article>
}
function RegionHeading({ data }: NodeProps<HeadingNode>) {
  return <div className="region-heading"><h2>{data.title}</h2><p>{data.subtitle}</p></div>
}
function LogicCard({ data }: NodeProps<LogicNode>) {
  const label = data.kind === 'all' ? 'AND' : data.kind === 'any' ? 'OR' : 'Condition'
  return <div className={`logic-card logic-${data.kind}`}>
    <Handle type="target" position={Position.Left} /><Handle type="source" position={Position.Right} />
    <button className="nopan" title={`${data.title}. Drag to move this badge; click for details.`} aria-label={`${label}: ${data.title}. View prerequisite details`} onClick={data.onInfo}>{label}</button>
  </div>
}
function TakenMarker({ data }: NodeProps<TakenNode>) {
  return <div className="taken-marker"><Handle type="source" position={Position.Right} /><strong>{data.title}</strong><p>Completed input · Restore from course lookup</p></div>
}
const nodeTypes = { course: CourseCard, heading: RegionHeading, logic: LogicCard, taken: TakenMarker }

function CourseInfo({ course, snapshot, onClose, onLocate, onMove, onReset, taken, onTaken, onConnect, planned, onSelect }: { course: Course; snapshot: CatalogSnapshot; onClose: () => void; onLocate?: () => void; onMove?: (dx: number, dy: number) => void; onReset?: () => void; taken: boolean; onTaken: () => void; onConnect?: () => void; planned: boolean; onSelect: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  const issue = snapshot.coverage.unresolvedPrerequisites.find(item => item.courseId === course.id)
  const policies = snapshot.coursePolicies.filter(policy => policy.courseIds.includes(course.id))
  return <dialog ref={dialog} className="course-dialog" aria-labelledby="course-title" onClose={onClose}>
    <div className="dialog-top"><span>COURSE INFORMATION</span><button autoFocus aria-label="Close course information" onClick={() => dialog.current?.close()}>✕</button></div>
    <p className="course-code">{course.code}</p><h2 id="course-title">{course.title}</h2>
    <p className="muted">{hours(course.credits)} credit hours · {course.catalogYear} catalog</p>
    <button className="plan-button" aria-pressed={planned} onClick={onSelect}>{planned ? "Remove from plan" : "Add to plan"}</button>
    <button className="taken-button" aria-pressed={taken} onClick={onTaken}>{taken ? "Mark not taken" : "Mark taken"}</button>
    {onConnect && <button onClick={onConnect}>Connect from this course</button>}{onLocate && <button onClick={onLocate}>Locate in prerequisite tree ↗</button>}<>{onMove && <div className="move-controls" role="group" aria-label="Move course"><span>Move card 20 pixels</span><button aria-label="Move course left" onClick={() => onMove(-20, 0)}>←</button><button aria-label="Move course up" onClick={() => onMove(0, -20)}>↑</button><button aria-label="Move course down" onClick={() => onMove(0, 20)}>↓</button><button aria-label="Move course right" onClick={() => onMove(20, 0)}>→</button></div>}</>{onReset && <button onClick={onReset}>Reset card position</button>}<h3>Description</h3><p>{course.description}</p>
    <h3>Prerequisites</h3><p>{course.prerequisiteText || 'No prerequisite statement is available in the captured catalog panel.'}</p>
    {issue && <p className="notice">Needs review: {issue.reason}</p>}
    {policies.length > 0 && <><h3>Credit and requirement notes</h3><ul>{policies.map(policy => <li key={policy.id}>{policy.text}</li>)}</ul></>}
    <h3>Appears in these requirements</h3><ul>{snapshot.catalog.requirements.filter(group => group.courseIds.includes(course.id)).map(group => <li key={group.id}>{group.label}</li>)}</ul>
    <h3>Official sources</h3><ul>{snapshot.catalog.sources.filter(source => course.sourceIds.includes(source.id)).map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></li>)}</ul>
    <p className="muted">Course information does not confirm registration eligibility or transfer credit.</p>
  </dialog>
}

function Planner({ snapshot, minorPrograms, program, onProgramChange }: { snapshot: CatalogSnapshot; minorPrograms: MinorSupplement['programs']; program: ProgramDefinition; onProgramChange: (id: string) => void }) {
  const initialFit = { nodes: [{ id: graphCourseId(program.firstCourseId) }], padding: 0.12, maxZoom: 1 }
  const [initialTheme] = useState<Theme>(() => {
    try { const saved = localStorage.getItem('uhd-planner-theme'); if (saved === 'light' || saved === 'dark') return saved } catch { /* Storage is optional. */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<Record<string, PlanPosition>>({})
  const [measurements, setMeasurements] = useState<Record<string, { width: number; height: number }>>({})
  const dragging = useRef(false)
  const branchDrag = useRef<BranchDrag | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const showCourse = useCallback((course: Course, nodeId: string) => { setSelectedCourse(course); setSelectedNodeId(nodeId) }, [])
  const [activeRegion, setActiveRegion] = useState('major')
  const [viewMode, setViewMode] = useState<'board' | 'sections'>('board')
  const [pendingFocus, setPendingFocus] = useState<string[] | null>(null)
  const nodesInitialized = useNodesInitialized()
  const [overview, setOverview] = useState(false)
  const [controlsCollapsed, setControlsCollapsed] = useState(() => {
    try { return localStorage.getItem('uhd-planner-controls-collapsed') === 'true' } catch { return false }
  })
  const controlsToggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    try { localStorage.setItem('uhd-planner-controls-collapsed', String(controlsCollapsed)) } catch { /* Keep the preference for this session when storage is unavailable. */ }
  }, [controlsCollapsed])
  const [pictureInput, setPictureInput] = useState<PictureInput | null>(null)
  const [connectionSource, setConnectionSource] = useState<string | null>(null)
  const [connectionTools, setConnectionTools] = useState(false)
  const [connectionMessage, setConnectionMessage] = useState('')
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [connectionPointer, setConnectionPointer] = useState<PlanPosition | null>(null)
  const { fitView, screenToFlowPosition } = useReactFlow()
  const { catalog } = snapshot
  const layout = useMemo(() => {
    const idsFor = (ids: string[]) => new Set(catalog.requirements.filter(group => ids.includes(group.id)).flatMap(group => group.courseIds))
    const plannedIds = programStarterIds(program, catalog)
    const graph = buildPrerequisiteGraph(catalog.courses, [...plannedIds])
    const byId = new Map(catalog.courses.map(course => [course.id, course]))
    const nodes: (CourseNode | HeadingNode | LogicNode)[] = graph.nodes.map(item => item.kind === 'course'
      ? { id: item.id, type: 'course', position: item.position, data: { course: byId.get(item.courseId!)!, option: !item.planned, reference: !item.planned, connected: true, onInfo: showCourse }, style: { width: 258 } }
      : { id: item.id, type: 'logic', position: item.position, data: { title: item.text, kind: item.kind, onInfo: () => showCourse(byId.get(item.ownerCourseId!)!, graphCourseId(item.ownerCourseId!)) }, style: { width: 258 } })
    const regionNodes: Record<string, string[]> = { major: graph.nodes.map(node => node.id) }
    nodes.push({ id: 'major-heading', type: 'heading', position: { x: 0, y: 0 }, data: { title: 'Major & foundations', subtitle: 'Read left to right · Unselected references explain prerequisites; use + to include their hours' }, style: { width: 1000 } })
    regionNodes.major.push('major-heading')
    const lowerY = graph.height + 350
    const regions = [
      { id: 'supporting', title: 'Supporting choices', subtitle: program.supportingDescription, x: 0, ids: idsFor(program.supportingRequirementIds) },
      { id: 'electives', title: 'Explore electives', subtitle: 'Course options · Use + to include hours; connections stay separate', x: 950, ids: idsFor(program.electiveRequirementIds) },
    ]
    for (const region of regions) {
      const headingId = `${region.id}-heading`
      nodes.push({ id: headingId, type: 'heading', position: { x: region.x, y: lowerY }, data: { title: region.title, subtitle: region.subtitle }, style: { width: 830 } })
      regionNodes[region.id] = [headingId]
      catalog.courses.filter(course => region.ids.has(course.id) && !plannedIds.has(course.id)).forEach((course, index) => {
        const id = `${region.id}:${course.id}`
        regionNodes[region.id].push(id)
        nodes.push({ id, type: 'course', position: { x: region.x + (index % 3) * 285, y: lowerY + 95 + Math.floor(index / 3) * 166 }, data: { course, option: true, onInfo: showCourse }, style: { width: 258 } })
      })
    }
    regionNodes.minors = ['minors-heading', ...program.minorPlaceholders.map(item => item.id)]
    nodes.push({ id: 'minors-heading', type: 'heading', position: { x: 1900, y: lowerY }, data: { title: 'Your minors', subtitle: 'Separate from the major tree - use Minors above to explore course choices' }, style: { width: 830 } })
    program.minorPlaceholders.forEach((item, index) => nodes.push({ id: item.id, type: 'heading', position: { x: 1900 + index * 420, y: lowerY + 105 }, data: { title: item.title, subtitle: item.subtitle }, className: 'minor-placeholder', style: { width: 370 } }))
    regionNodes.core = ['core-heading']
    nodes.push({ id: 'core-heading', type: 'heading', position: { x: 1900, y: lowerY + 430 }, data: { title: 'Core & general requirements', subtitle: 'Requirement slots, not selected courses · Core/major overlaps count only once' }, style: { width: 830 } })
    catalog.requirements.filter(group => group.area === 'core' || group.id === 'free-electives').forEach((group, index) => {
      const id = `slot:${group.id}`
      regionNodes.core.push(id)
      nodes.push({ id, type: 'heading', position: { x: 1900 + index % 2 * 420, y: lowerY + 535 + Math.floor(index / 2) * 190 }, data: { title: group.label, subtitle: group.id === 'free-electives' ? 'Balance to 120 hours · No course selected' : `${group.minimumCredits} hours required · No course selected` }, className: 'requirement-slot', style: { width: 370 } })
    })
    // Append minor regions below existing areas. Keep every previous node ID and
    // coordinate intact so existing local plans and custom links stay valid.
    regionNodes.minors = program.id === 'cs-bs' ? [] : ['minors-heading', ...program.minorPlaceholders.map(item => item.id)]
    minorPrograms.forEach((program, programIndex) => {
      const x = programIndex * 1200
      const y = lowerY + 3500
      const headingId = `${program.id}-requirements`
      regionNodes.minors.push(headingId)
      nodes.push({ id: headingId, type: 'heading', position: { x, y }, data: { title: `${program.title} - ${program.totalLabel}`, subtitle: program.summary }, style: { width: 830 } })
      program.courseIds.forEach((courseId, index) => {
        const course = byId.get(courseId)!
        const id = `${program.id}:${courseId}`
        regionNodes.minors.push(id)
        nodes.push({ id, type: 'course', position: { x: x + index % 3 * 285, y: y + 160 + Math.floor(index / 3) * 166 }, data: { course, option: true, onInfo: showCourse }, style: { width: 258 } })
      })
    })
    const edges = graph.links.map(link => ({ ...link, label: undefined, data: { detailLabel: link.label }, type: 'smoothstep', selectable: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--edge)' },
      style: { stroke: 'var(--edge)', strokeWidth: 1.5, ...(link.timing && link.timing !== 'before' ? { strokeDasharray: '6 4' } : {}) },
      labelStyle: { fill: 'var(--text)', fontSize: 11 }, labelBgStyle: { fill: 'var(--surface)' },
      ariaLabel: `${link.source} to ${link.target}: ${link.label}` }))
    return { nodes, edges, links: graph.links, regionNodes, plannedIds: [...plannedIds].sort() }
    }, [catalog, showCourse, minorPrograms, program])
  const connectionGraph = useMemo(() => ({ nodes: layout.nodes.filter(node => node.type === 'course').map(node => ({ id: node.id, courseId: node.data.course.id })), official: layout.links }), [layout])
  const context = useMemo(() => ({
    connectionGraph, storageKey: programStorageKey(program.id, program.catalogYear),
    defaults: { schemaVersion: 1, datasetVersion: catalog.datasetVersion,
      positions: Object.fromEntries(layout.nodes.map(node => [node.id, node.position])),
      selectedCourseIds: layout.plannedIds, takenCourseIds: [], customEdges: [],
      preferences: { theme: initialTheme, hideCompleted: false } } satisfies Plan,
    courseIds: new Set(catalog.courses.map(course => course.id)), nodeIds: new Set(layout.nodes.map(node => node.id)),
  }), [layout, catalog, initialTheme, connectionGraph, program])
  const { history, dispatch, saveStatus, saveFailed } = usePlan(context)
  const plan = history.present
  const theme = plan.preferences.theme
  const credits = useMemo(() => calculatePlanProgress(catalog.courses, plan.selectedCourseIds, plan.takenCourseIds, snapshot.coursePolicies), [catalog.courses, plan.selectedCourseIds, plan.takenCourseIds, snapshot.coursePolicies])
  const selectedIds = useMemo(() => new Set(plan.selectedCourseIds), [plan.selectedCourseIds])
  const setPlanned = useCallback((courseId: string, value: boolean) => {
    setConnectionSource(null); setConnectionPointer(null)
    dispatch({ type: 'select', courseId, value })
  }, [dispatch])
  const completedControl = useRef<HTMLButtonElement>(null)
  const setTaken = useCallback((courseId: string, value: boolean) => {
    setConnectionSource(null); setConnectionPointer(null)
    dispatch({ type: 'take', courseId, value })
    if (value && plan.preferences.hideCompleted && !selectedCourse) requestAnimationFrame(() => (controlsCollapsed ? controlsToggle.current : completedControl.current)?.focus())
  }, [dispatch, plan.preferences.hideCompleted, selectedCourse, controlsCollapsed])
  const taken = useMemo(() => new Set(plan.takenCourseIds), [plan.takenCourseIds])
  const allLinks = useMemo(() => [...layout.links, ...plan.customEdges.map(edge => ({ ...edge, label: 'Personal planning link' }))], [layout.links, plan.customEdges])
  const completion = useMemo(() => completionView(layout.nodes.map(node => ({ id: node.id,
    label: node.type === 'course' ? node.data.course.code : node.type === 'logic' ? node.data.title : node.data.title,
    ...(node.type === 'course' ? { courseId: node.data.course.id } : {}) })), allLinks, plan.takenCourseIds, plan.preferences.hideCompleted), [layout, allLinks, plan.takenCourseIds, plan.preferences.hideCompleted])
  const nodes = useMemo(() => {
    const visible: (CourseNode | HeadingNode | LogicNode | TakenNode)[] = layout.nodes.filter(node => !completion.hidden.has(node.id)).map((node): CourseNode | HeadingNode | LogicNode => {
      const position = dragPreview[node.id] ?? plan.positions[node.id] ?? node.position
      if (node.type === 'course') return { ...node, measured: measurements[node.id], draggable: !connectionSource, className: node.id === connectionSource ? 'connection-source' : undefined, position, data: { ...node.data, option: !selectedIds.has(node.data.course.id), selected: selectedIds.has(node.data.course.id), onSelect: setPlanned, taken: taken.has(node.data.course.id), onTaken: setTaken } }
      if (node.type === 'logic') return { ...node, measured: measurements[node.id], draggable: !connectionSource, dragHandle: '.logic-card button', position }
      return { ...node, measured: measurements[node.id], draggable: false, position }
    })
    for (const marker of completion.compact) visible.push({ id: marker.id, type: 'taken', measured: measurements[marker.id], data: { title: marker.label }, position: dragPreview[marker.originalId] ?? plan.positions[marker.originalId], draggable: false, style: { width: 258 } })
    return visible
  }, [layout.nodes, plan.positions, dragPreview, completion, taken, setTaken, selectedIds, setPlanned, measurements, connectionSource])
  const visibleEdges = useMemo(() => completion.links.map(link => link.bridge ? {
    ...link, type: 'smoothstep', selectable: false, className: 'completed-bridge',
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--bridge)' },
    style: { stroke: 'var(--bridge)', strokeWidth: 2, strokeDasharray: '3 4' },
    labelStyle: { fill: 'var(--text)', fontSize: 11 }, labelBgStyle: { fill: 'var(--surface)' },
    ariaLabel: `Visual ${link.label}. ${link.bridge.segments.join('; ')}`,
  } : plan.customEdges.some(edge => edge.id === link.id) ? {
    ...link, type: 'smoothstep', selectable: false, focusable: true, className: 'personal-edge',
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--personal)' },
    style: { stroke: 'var(--personal)', strokeWidth: selectedEdge === link.id ? 4 : 2, strokeDasharray: '9 5' },
    labelStyle: { fill: 'var(--text)', fontSize: 11 }, labelBgStyle: { fill: 'var(--surface)' },
    ariaLabel: `Personal connection ${link.source} to ${link.target}`,
  } : layout.edges.find(edge => edge.id === link.id)!), [completion.links, layout.edges, plan.customEdges, selectedEdge])
  const scene = useMemo(() => sectionView(nodes, visibleEdges, viewMode === 'sections' ? layout.regionNodes[activeRegion] : undefined, completion.compact), [nodes, visibleEdges, viewMode, layout.regionNodes, activeRegion, completion.compact])
  // Wait until newly displayed nodes have dimensions before moving the camera.
  useEffect(() => {
    if (!pendingFocus || !nodesInitialized || !pendingFocus.every(id => scene.nodes.some(node => node.id === id))) return
    const frame = requestAnimationFrame(() => {
      void fitView({ nodes: pendingFocus.map(id => ({ id })), padding: 0.12, duration: 350, maxZoom: 1 })
      setPendingFocus(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [pendingFocus, nodesInitialized, scene.nodes, fitView])
  const connectionOptions = useMemo(() => layout.nodes.filter(node => node.type === 'course').map(node => ({ id: node.id, label: `${node.data.course.code} (${node.id.startsWith('tree:') ? 'tree' : node.id.split(':')[0]})`, hidden: completion.hidden.has(node.id) })), [layout.nodes, completion.hidden])
  const cancelConnection = useCallback(() => { setConnectionSource(null); setConnectionPointer(null); setConnectionMessage('Connection canceled.') }, [])
  const startConnection = (id: string) => {
    if (!id) { cancelConnection(); return }
    if (!connectionOptions.some(option => option.id === id && !option.hidden)) return
    setControlsCollapsed(false)
    if (!scene.nodes.some(node => node.id === id)) {
      setViewMode('board')
      setPendingFocus([id])
    }
    setConnectionSource(id); setConnectionTools(true); setConnectionMessage(''); setSelectedEdge(null)
    setSelectedCourse(null)
    const position = plan.positions[id]
    setConnectionPointer({ x: position.x + 350, y: position.y + 72 })
  }
  const finishConnection = (target: string) => {
    if (!connectionSource) return
    const error = connectionError(connectionSource, target, connectionGraph, plan.customEdges)
    if (error) { setConnectionMessage(error); return }
    dispatch({ type: 'connect', edge: { id: `personal:${crypto.randomUUID()}`, source: connectionSource, target } })
    setConnectionSource(null); setConnectionPointer(null); setConnectionMessage('Personal connection added. Undo is available.')
  }
  const removeConnection = (id: string) => {
    if (!plan.customEdges.some(edge => edge.id === id)) return
    dispatch({ type: 'disconnect', edgeId: id }); setSelectedEdge(null); setConnectionMessage('Personal connection removed. Undo is available.')
  }

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && connectionSource) { event.preventDefault(); cancelConnection() }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [connectionSource, cancelConnection])
  const previewStart = connectionSource && plan.positions[connectionSource] ? {
    x: plan.positions[connectionSource].x + (measurements[connectionSource]?.width ?? 258),
    y: plan.positions[connectionSource].y + (measurements[connectionSource]?.height ?? 145) / 2,
  } : null
  const [visibleInitialFit] = useState(() => nodes.some(node => node.id === initialFit.nodes[0].id) ? initialFit : {
    nodes: nodes.filter(node => node.type === 'course').slice(0, 1).map(node => ({ id: node.id })), padding: 0.12, maxZoom: 1,
  })
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Controlled nodes must retain dimensions reported by React Flow; otherwise
    // every branch preview replaces initialized nodes with unmeasured copies.
    const dimensions = changes.filter(change => change.type === 'dimensions' && change.dimensions)
    if (dimensions.length) setMeasurements(previous => {
      const next = { ...previous }
      let changed = false
      for (const change of dimensions) if (change.type === 'dimensions' && change.dimensions) {
        const old = previous[change.id]
        if (old?.width !== change.dimensions.width || old?.height !== change.dimensions.height) {
          next[change.id] = change.dimensions
          changed = true
        }
      }
      return changed ? next : previous
    })
    const drag = branchDrag.current
    if (!drag) return
    for (const change of changes) if (change.type === 'position' && change.id === drag.root && change.position) {
      setDragPreview(branchPositions(drag, change.position))
    }
  }, [])
  const startBranchDrag = useCallback((_event: unknown, node: Node) => {
    // Badges are independent layout controls; course drags still carry the branch.
    branchDrag.current = beginBranchDrag(node.id, plan.positions, node.type === 'logic' ? [] : [...layout.links, ...plan.customEdges])
    dragging.current = !!branchDrag.current
  }, [plan.positions, plan.customEdges, layout.links])
  const stopBranchDrag = useCallback((event: MouseEvent | TouchEvent, node: Node) => {
    const drag = branchDrag.current
    if (drag && !drag.cancelled && event.type !== 'touchcancel') dispatch({ type: 'move', positions: branchPositions(drag, node.position) })
    branchDrag.current = null
    dragging.current = false
    setDragPreview({})
  }, [dispatch])
  useEffect(() => {
    const cancel = () => {
      const drag = branchDrag.current
      if (!drag || drag.cancelled) return
      drag.cancelled = true
      setDragPreview({ ...drag.positions })
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dragging.current) { event.preventDefault(); cancel() }
    }
    window.addEventListener('keydown', escape)
    window.addEventListener('blur', cancel)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('touchcancel', cancel)
    return () => {
      window.removeEventListener('keydown', escape)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('touchcancel', cancel)
    }
  }, [])
  const moveCourse = selectedNodeId && plan.positions[selectedNodeId] ? (dx: number, dy: number) => {
    const position = plan.positions[selectedNodeId]
    dispatch({ type: 'move', positions: { [selectedNodeId]: { x: position.x + dx, y: position.y + dy } } })
  } : undefined
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (dragging.current || event.altKey || !(event.ctrlKey || event.metaKey) ||
        event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], dialog')) return
      const key = event.key.toLowerCase()
      if (key === 'z' || key === 'y') {
        event.preventDefault()
        setConnectionSource(null); setConnectionPointer(null)
        dispatch({ type: key === 'y' || event.shiftKey ? 'redo' : 'undo' })
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [dispatch])
  const focusRegion = (region: string, mode = viewMode) => {
    if (mode === 'sections') cancelConnection()
    setActiveRegion(region)
    const regionNodes = sectionView(nodes, visibleEdges, layout.regionNodes[region], completion.compact).nodes
    // Sections open at a readable starting point rather than shrinking a long
    // elective/minor list to fit the entire area into a single screen.
    const focusNodes = mode === 'board' ? regionNodes : region === 'major'
      ? [regionNodes.find(node => node.id === initialFit.nodes[0].id) ?? regionNodes.find(node => node.type === 'course') ?? regionNodes[0]].filter(Boolean)
      : region === 'minors' ? regionNodes.filter(node => node.type === 'course').slice(0, 3) : regionNodes.slice(0, 4)
    setPendingFocus(focusNodes.map(node => node.id))
  }
  const changeView = (mode: 'board' | 'sections') => {
    cancelConnection()
    setViewMode(mode)
    focusRegion(activeRegion, mode)
  }
  const changeTheme = () => dispatch({ type: 'preferences', preferences: { theme: theme === 'light' ? 'dark' : 'light' } })
  return <main className="planner" data-theme={theme}>
    <header className="app-header"><div className="brand"><span className="brand-mark">UHD</span><div><h1>Course planner</h1><p>{program.shortTitle.toUpperCase()} · {catalog.catalogYear}</p></div></div><div className="header-actions"><button ref={controlsToggle} aria-expanded={!controlsCollapsed} aria-controls="planner-controls" onClick={() => { if (!controlsCollapsed) cancelConnection(); setControlsCollapsed(!controlsCollapsed) }}>{controlsCollapsed ? 'Show controls' : 'Hide controls'}</button><button onClick={() => { if (!dragging.current) setPictureInput({ nodes, edges: visibleEdges, theme, year: catalog.catalogYear, programTitle: program.title, programSlug: program.exportSlug, summary: `${hours(credits.catalogCredits)} total planned hours | ${hours(credits.completedCredits)} completed | ${hours(credits.remainingCredits)} remaining planned`, hidden: plan.preferences.hideCompleted, creditReview: !!(credits.conflicts.length || credits.excludedCourseIds.length) }) }}>Save picture</button></div></header>
    <div id="planner-controls" hidden={controlsCollapsed}>
    <div className="toolbar" aria-label="Planner toolbar">
      <div className="toolbar-group"><label className="sr-only" htmlFor="major">Major</label><select id="major" value={program.id} disabled={saveFailed} onChange={event => onProgramChange(event.target.value)}>{availablePrograms.map(item => <option key={item.definition.id} value={item.definition.id}>{item.definition.title}</option>)}</select><button disabled={!history.past.length} onClick={() => { cancelConnection(); dispatch({ type: "undo" }) }} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo">↶</button><button disabled={!history.future.length} onClick={() => { cancelConnection(); dispatch({ type: "redo" }) }} title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)" aria-label="Redo">↷</button></div>
      <div className="toolbar-group"><button onClick={changeTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? '☾ Dark' : '☀ Light'}</button><div className="credit-total" aria-label="Planned credit hours" aria-live="polite"><strong>{hours(credits.catalogCredits)} <small>Total planned hours</small></strong><span className="credit-breakdown"><span>Completed <b>{hours(credits.completedCredits)}</b></span><span>Remaining <b>{hours(credits.remainingCredits)}</b></span></span></div></div>
    </div>
      <p role="status" className={`save-status ${saveFailed ? "save-warning" : ""}`}>{saveStatus}</p>
    <details className="credit-details"><summary>Credit details: {credits.uniqueCourseCount} selected courses{credits.conflicts.length || credits.excludedCourseIds.length ? ' - credit restrictions need review' : ''}</summary>
      <p>Total counts each selected course once, including copies across the major and minors. Completed means selected and marked Taken. Remaining means selected and not Taken; it is not the number of hours left to graduate. Hiding courses does not affect these totals.</p>
      <p>The degree has a {program.minimumCredits}-hour minimum. Selections do not assign courses to requirement slots or confirm grade, residency, transfer or major/minor overlap rules.</p>
      {credits.unselectedTakenCount > 0 && <p>{credits.unselectedTakenCount} Taken course(s) are outside this plan and excluded from all three totals. Add them to the plan to include their hours.</p>}
      {credits.excludedCourseIds.length > 0 && <p className="notice">Included in catalog-hour totals but excluded from degree credit: {credits.excludedCourseIds.map(id => catalog.courses.find(course => course.id === id)!.code).join(', ')}.</p>}
      {credits.conflicts.map(conflict => <p className="notice" key={conflict.policyId}>{conflict.message} Catalog-hour totals include these selections; degree credit needs review.</p>)}
      <ul className="selected-course-list">{catalog.courses.filter(course => selectedIds.has(course.id)).map(course => <li key={course.id}><button onClick={() => { setSelectedCourse(course); setSelectedNodeId(layout.nodes.find(node => node.type === 'course' && node.data.course.id === course.id)?.id ?? null) }}>{course.code}: {course.title}</button><span>{hours(course.credits)} hours{taken.has(course.id) ? ' / Taken' : ''}</span></li>)}</ul>
      {!credits.uniqueCourseCount && <p>No courses selected. Add courses from their cards or course information.</p>}
    </details>
    <div className="workspace-bar"><div><h2>A little clarity for the road ahead.</h2><p>Drag a course to move its downstream branch, including hidden courses. Undo restores the whole branch. Double-click a course to connect it. Press Escape to cancel. AND means all inputs; OR means any input. Drag a badge to move it independently. Click a badge or course info for grades, timing, and conditions.</p></div><button onClick={() => setOverview(!overview)} aria-expanded={overview}>Requirements {overview ? '−' : '+'}</button></div>
    {overview && <section className="requirements" aria-label="Degree requirements">
      <p>{program.starterDescription}</p>
      <ul>{catalog.requirements.map(group => <li key={group.id}><strong>{group.label}</strong><span>{group.id === 'free-electives' ? 'Balance to 120 hours' : `${group.minimumCredits} hours`}</span>{group.constraints.length > 0 && <details><summary>Conditions and choices</summary><ul>{group.constraints.map(note => <li key={note}>{note}</li>)}</ul>{group.courseIds.length > 0 && <p>{group.courseIds.map(id => catalog.courses.find(course => course.id === id)?.code).join(', ')}</p>}</details>}</li>)}</ul>
      <details><summary>Catalog coverage and unresolved prerequisites</summary><p>{snapshot.coverage.unimportedOptionCodes.length} core choices have names only and cannot be selected yet. {program.coverageDescription}</p><ul>{snapshot.coverage.unresolvedPrerequisites.map(issue => <li key={issue.courseId}>{issue.courseId.split(':')[1]}: {issue.reason}</li>)}</ul><a href={program.sourceUrl} target="_blank" rel="noreferrer">Official UHD degree requirements ↗</a></details>
    </section>}
    <div className="view-switcher" role="group" aria-label="Planner view">
      <button aria-pressed={viewMode === 'board'} onClick={() => changeView('board')}>Board</button>
      <button aria-pressed={viewMode === 'sections'} onClick={() => changeView('sections')}>Sections</button>
      <span>{viewMode === 'sections' ? 'One area at a time. Use Board for links between areas. Totals and pictures include the whole plan.' : 'All areas on one board. Choose an area below to jump to it.'}</span>
    </div>
    <nav className="region-nav" aria-label="Course areas">{[['major', 'Major & foundations'], ['supporting', 'Supporting choices'], ['electives', 'Electives'], ['minors', 'Minors'], ['core', 'Core & general']].map(([id, label]) => <button key={id} aria-pressed={activeRegion === id} onClick={() => focusRegion(id)}>{label}</button>)}<label className="sr-only" htmlFor="course-lookup">Find course information</label><select id="course-lookup" value="" onChange={event => { const course = catalog.courses.find(course => course.id === event.target.value); if (course) { setSelectedCourse(course); setSelectedNodeId(layout.nodes.find(node => node.type === "course" && node.data.course.id === course.id)?.id ?? null) } }}><option value="">Find course information…</option>{catalog.courses.map(course => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></nav>
    <div className="completion-bar"><button ref={completedControl} aria-pressed={plan.preferences.hideCompleted} onClick={() => { cancelConnection(); dispatch({ type: 'preferences', preferences: { hideCompleted: !plan.preferences.hideCompleted } }) }}>{plan.preferences.hideCompleted ? 'Show completed' : 'Hide completed'}</button><span>{plan.takenCourseIds.length} marked Taken · Planned hours stay unchanged</span></div>
    {plan.preferences.hideCompleted && completion.hidden.size > 0 && <details className="completion-notes"><summary>{completion.links.filter(link => link.bridge).length} paths through taken courses · View explanations</summary><p>Orange links summarize original paths through taken courses. Grades, conditions and ALL/ANY groups still apply. Marking Taken does not confirm registration eligibility.</p>{completion.links.filter(link => link.bridge).map(link => <p key={link.id}><strong>{link.label}</strong><br />{link.bridge?.segments.join(' • ')}</p>)}</details>}
    <div className="connection-toolbar"><button aria-expanded={connectionTools} onClick={() => { if (connectionSource) cancelConnection(); setConnectionTools(!connectionTools) }}>Personal connections ({plan.customEdges.length})</button></div>
    {connectionTools && <ConnectionTools options={connectionOptions} source={connectionSource} onStart={startConnection} onConnect={finishConnection} onCancel={cancelConnection} edges={plan.customEdges} selected={selectedEdge} onSelect={setSelectedEdge} onRemove={removeConnection} message={connectionMessage} />}
    </div>
    <section className="canvas" aria-label="Course plan canvas" onPointerMove={event => { if (connectionSource) setConnectionPointer(screenToFlowPosition({ x: event.clientX, y: event.clientY })) }}>
      <ReactFlow nodes={scene.nodes} zoomOnDoubleClick={false} deleteKeyCode={null}
        onNodeDoubleClick={(event, node) => { if (node.type === 'course' && !connectionSource && !(event.target as Element).closest('button')) startConnection(node.id) }}
        onNodeClick={(event, node) => { if (node.type === 'course' && connectionSource && event.detail < 2 && !(event.target as Element).closest('button')) finishConnection(node.id) }}
        onPaneClick={() => { if (connectionSource) cancelConnection(); setSelectedEdge(null) }}
        onEdgeClick={(_event, edge) => { if (plan.customEdges.some(item => item.id === edge.id)) { setSelectedEdge(edge.id); setControlsCollapsed(false); setConnectionTools(true) } }} onNodesChange={onNodesChange} onNodeDragStart={startBranchDrag} onNodeDragStop={stopBranchDrag} edges={scene.edges} nodeTypes={nodeTypes} nodesDraggable={true} nodesConnectable={false} elementsSelectable={false} nodesFocusable={false} colorMode={theme} minZoom={0.035} maxZoom={1.8} fitView fitViewOptions={visibleInitialFit}>
        {previewStart && connectionPointer && <ViewportPortal><svg className="connection-preview" aria-label="Connection preview" width="1" height="1"><line x1={previewStart.x} y1={previewStart.y} x2={connectionPointer.x} y2={connectionPointer.y} /><circle cx={connectionPointer.x} cy={connectionPointer.y} r="5" /></svg></ViewportPortal>}
        <Background gap={22} size={1} /><Controls showInteractive={false} />
      </ReactFlow>
    </section>
    <footer><span><i className="legend-dot" /> Planned course <i className="legend-dot option" /> Option / reference · Not selected</span><span>Plans save in this browser · Independent tool · Not an official degree audit</span></footer>
    {pictureInput && <ExportPicture input={pictureInput} onClose={() => setPictureInput(null)} />}
    {selectedCourse && <CourseInfo onConnect={selectedNodeId && !completion.hidden.has(selectedNodeId) ? () => startConnection(selectedNodeId) : undefined} course={selectedCourse} snapshot={snapshot} planned={selectedIds.has(selectedCourse.id)} onSelect={() => setPlanned(selectedCourse.id, !selectedIds.has(selectedCourse.id))} taken={taken.has(selectedCourse.id)} onTaken={() => setTaken(selectedCourse.id, !taken.has(selectedCourse.id))} onMove={moveCourse} onReset={selectedNodeId ? () => dispatch({ type: "move", positions: { [selectedNodeId]: context.defaults.positions[selectedNodeId] } }) : undefined} onClose={() => setSelectedCourse(null)} onLocate={!completion.hidden.has(graphCourseId(selectedCourse.id)) && layout.regionNodes.major.includes(graphCourseId(selectedCourse.id)) ? () => { setSelectedCourse(null); setActiveRegion("major"); setPendingFocus([graphCourseId(selectedCourse.id)]) } : undefined} />}
  </main>
}
export default function App() {
  const [programId, setProgramId] = useState(() => {
    try { const saved = localStorage.getItem('uhd-planner-active-program'); if (availablePrograms.some(item => item.definition.id === saved)) return saved! } catch { /* Preference is optional. */ }
    return computerScience.id
  })
  useEffect(() => { try { localStorage.setItem('uhd-planner-active-program', programId) } catch { /* Keep the session selection. */ } }, [programId])
  const active = availablePrograms.find(item => item.definition.id === programId)
  return active ? <ReactFlowProvider key={programId}><Planner snapshot={active.snapshot} minorPrograms={active.programs} program={active.definition} onProgramChange={setProgramId} /></ReactFlowProvider> : <main><h1>UHD Course Planner</h1><p role="alert">{catalogResult.ok ? 'This program is not available yet.' : catalogResult.message}</p></main>
}







