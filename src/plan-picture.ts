import { getSmoothStepPath, Position, type Node, type Edge } from '@xyflow/react'
import type { Course } from './data/catalog-schema'
import { exportFrame, type ExportBox } from './data/export-layout'

export type PictureInput = { nodes: Node[]; edges: Edge[]; theme: 'light' | 'dark'; year: string; summary: string; hidden: boolean; creditReview: boolean }
const palettes = {
  light: { bg: '#f6f7f4', surface: '#ffffff', text: '#243b33', muted: '#626f69', line: '#dce2dc', accent: '#285d49', edge: '#748a7b', bridge: '#a95718', personal: '#3268b0', taken: '#edf0ed' },
  dark: { bg: '#17221e', surface: '#23312a', text: '#e9eee9', muted: '#aab9af', line: '#405247', accent: '#a9d5b8', edge: '#9fb6a8', bridge: '#efb36e', personal: '#8abaff', taken: '#303833' },
}
const font = (size: number, bold = false) => `${bold ? 600 : 400} ${size}px "Segoe UI", sans-serif`
function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const result: string[] = []; let line = ''
  for (const word of text.split(/\s+/)) {
    if (ctx.measureText(line ? line + ' ' + word : word).width <= width) { line += (line ? ' ' : '') + word; continue }
    if (line) result.push(line)
    line = ''
    for (const char of word) {
      if (ctx.measureText(line + char).width > width && line) { result.push(line); line = '' }
      line += char
    }
  }
  if (line) result.push(line)
  return result
}
function paragraph(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, size: number, bold = false) {
  ctx.font = font(size, bold)
  const wrapped = lines(ctx, text, width)
  wrapped.forEach((line, i) => ctx.fillText(line, x, y + i * size * 1.4))
  return wrapped.length * size * 1.4
}

export async function renderPlanPicture(input: PictureInput, signal?: AbortSignal) {
  await document.fonts.ready
  await new Promise(resolve => setTimeout(resolve, 0))
  signal?.throwIfAborted()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Your browser could not create the picture.')
  const palette = palettes[input.theme]
  const boxes = new Map<string, ExportBox>()
  // Measure exported text independently so long titles/conditions are not clipped.
  for (const node of input.nodes) {
    const width = node.measured?.width ?? Number(node.style?.width ?? 258)
    const measuredHeight = node.measured?.height ?? (node.type === 'heading' ? 150 : 180)
    let contentHeight = measuredHeight
    if (node.type === 'course') {
      ctx.font = font(15, true); contentHeight = lines(ctx, (node.data.course as Course).title, width - 30).length * 21 + 90
    } else if (node.type === 'heading') {
      ctx.font = font(22, true); const title = lines(ctx, String(node.data.title), width - 32).length * 30.8
      ctx.font = font(13); contentHeight = title + lines(ctx, String(node.data.subtitle), width - 32).length * 18.2 + 40
    } else if (node.type === 'logic') {
      ctx.font = font(13); contentHeight = lines(ctx, String(node.data.title), width - 32).length * 18.2 + 68
    }
    boxes.set(node.id, { ...node.position, width, height: Math.max(measuredHeight, contentHeight) })
  }
  const edges = input.edges.flatMap(edge => {
    const source = boxes.get(edge.source), target = boxes.get(edge.target)
    if (!source || !target) return []
    const sourceY = source.y + source.height / 2, targetY = target.y + target.height / 2
    const [path, labelX, labelY] = getSmoothStepPath({ sourceX: source.x + source.width, sourceY, targetX: target.x, targetY, sourcePosition: Position.Right, targetPosition: Position.Left })
    ctx.font = font(11)
    const label = typeof edge.label === 'string' ? edge.label : ''
    const labelWidth = ctx.measureText(label).width + 12
    return [{ path, labelX, labelY, label, labelWidth, targetX: target.x, targetY, kind: edge.className === 'completed-bridge' ? 'bridge' : edge.className === 'personal-edge' ? 'personal' : 'edge', dashed: Boolean(edge.style?.strokeDasharray) }]
  })
  const frame = exportFrame([...boxes.values(), ...edges.map(edge => ({ x: edge.labelX - edge.labelWidth / 2, y: edge.labelY - 14, width: edge.labelWidth, height: 28 }))])
  canvas.width = frame.pixelWidth; canvas.height = frame.pixelHeight
  ctx.scale(frame.scale, frame.scale); ctx.fillStyle = palette.bg; ctx.fillRect(0, 0, frame.width, frame.height)
  ctx.textBaseline = 'top'; ctx.fillStyle = palette.text
  paragraph(ctx, `UHD Course Planner | Computer Science BS | ${input.year}`, 36, 22, frame.width - 72, 24, true)
  paragraph(ctx, input.summary, 36, 60, frame.width - 72, 16)
  ctx.fillStyle = palette.muted
  paragraph(ctx, `${input.hidden ? 'Taken courses hidden' : 'Taken courses shown'} | Blue dashed: personal links | Orange: paths through taken courses`, 36, 87, frame.width - 72, 12)
  paragraph(ctx, `Independent planning tool. Not an official degree audit.${input.creditReview ? ' Selected courses have credit restrictions needing review.' : ''}`, 36, 108, frame.width - 72, 12)
  ctx.translate(-frame.left, 150 - frame.top)
  for (const edge of edges) {
    const color = palette[edge.kind as 'edge' | 'bridge' | 'personal']
    ctx.strokeStyle = color; ctx.lineWidth = edge.kind === 'edge' ? 1.5 : 2
    ctx.setLineDash(edge.dashed ? [6, 4] : []); ctx.stroke(new Path2D(edge.path)); ctx.setLineDash([])
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(edge.targetX, edge.targetY); ctx.lineTo(edge.targetX - 9, edge.targetY - 4); ctx.lineTo(edge.targetX - 9, edge.targetY + 4); ctx.closePath(); ctx.fill()
    if (edge.label) {
      ctx.fillStyle = palette.surface; ctx.fillRect(edge.labelX - edge.labelWidth / 2, edge.labelY - 9, edge.labelWidth, 18)
      ctx.fillStyle = palette.text; ctx.font = font(11); ctx.textAlign = 'center'; ctx.fillText(edge.label, edge.labelX, edge.labelY - 6); ctx.textAlign = 'left'
    }
  }
  let drawn = 0
  for (const node of input.nodes) {
    if (++drawn % 40 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); if (signal?.aborted) { canvas.width = 1; canvas.height = 1; signal.throwIfAborted() } }
    const box = boxes.get(node.id)!
    const { x, y, width, height } = box
    const data = node.data
    if (node.type !== 'heading' || node.className) {
      ctx.fillStyle = data.taken || node.type === 'taken' ? palette.taken : palette.surface
      ctx.strokeStyle = palette.line; ctx.lineWidth = 1
      ctx.beginPath(); ctx.roundRect(x, y, width, height, 10); ctx.fill(); ctx.stroke()
    }
    ctx.fillStyle = palette.text
    if (node.type === 'course') {
      const course = data.course as Course
      ctx.fillStyle = data.selected ? palette.accent : palette.muted; ctx.fillRect(x + 10, y, width - 20, 3)
      paragraph(ctx, course.code, x + 15, y + 15, width - 30, 14, true)
      ctx.fillStyle = palette.text
      paragraph(ctx, course.title, x + 15, y + 44, width - 30, 15, true)
      const credit = course.credits.min === course.credits.max ? `${course.credits.min}` : `${course.credits.min}-${course.credits.max}`
      ctx.fillStyle = palette.muted
      paragraph(ctx, `${credit} hours | ${data.selected ? 'Planned' : 'Option / reference'}${data.taken ? ' | Taken' : ''}`, x + 15, y + height - 37, width - 30, 11)
      if (course.review !== 'verified') paragraph(ctx, 'Prerequisites need review', x + 15, y + height - 20, width - 30, 10)
    } else if (node.type === 'heading') {
      const titleHeight = paragraph(ctx, String(data.title), x + 16, y + 12, width - 32, 22, true)
      ctx.fillStyle = palette.muted; paragraph(ctx, String(data.subtitle), x + 16, y + 22 + titleHeight, width - 32, 13)
    } else {
      ctx.fillStyle = node.type === 'taken' ? palette.bridge : palette.accent
      paragraph(ctx, node.type === 'taken' ? 'COMPLETED INPUT' : String(data.kind).toUpperCase(), x + 16, y + 16, width - 32, 12, true)
      ctx.fillStyle = palette.text; paragraph(ctx, String(data.title), x + 16, y + 44, width - 32, 13)
    }
  }
  try {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('This browser could not encode the image. Try a more compact course layout.')), 'image/png'))
    return { blob, frame }
  } finally { canvas.width = 1; canvas.height = 1 }
}
