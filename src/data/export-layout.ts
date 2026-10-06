export type ExportBox = { x: number; y: number; width: number; height: number }

// Conservative allocation budget; browsers can still reject an allocation.
export function exportFrame(boxes: ExportBox[], requestedScale = 2) {
  if (!boxes.length) throw new Error('There is no visible plan to export.')
  if (!(requestedScale > 0 && Number.isFinite(requestedScale)) || boxes.some(box =>
    !Object.values(box).every(Number.isFinite) || box.width < 0 || box.height < 0))
    throw new Error('The plan has invalid image bounds.')
  const left = Math.min(...boxes.map(box => box.x)) - 48
  const top = Math.min(...boxes.map(box => box.y)) - 48
  const width = Math.max(1100, Math.max(...boxes.map(box => box.x + box.width)) + 48 - left)
  const height = Math.max(...boxes.map(box => box.y + box.height)) + 48 - top + 150
  const scale = Math.min(requestedScale, 16000 / width, 16000 / height, Math.sqrt(48_000_000 / (width * height)))
  if (scale < 0.1) throw new Error('This plan is too spread out for a readable picture. Move distant courses closer and try again.')
  return { left, top, width, height, scale, pixelWidth: Math.floor(width * scale), pixelHeight: Math.floor(height * scale), reduced: scale < requestedScale }
}

type Writable = { write: (blob: Blob) => Promise<void>; close: () => Promise<void>; abort?: () => Promise<void> }
export type SavePicker = (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable: () => Promise<Writable> }>

// Call synchronously from the Save button: the picker needs user activation.
export async function savePng(blob: Blob, filename: string, picker: SavePicker | undefined, download: () => void) {
  if (!picker) { download(); return 'downloaded' as const }
  let stream: Writable | undefined
  try {
    const handle = await picker({ suggestedName: filename, types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }] })
    stream = await handle.createWritable()
    await stream.write(blob)
    await stream.close()
    return 'saved' as const
  } catch (error) {
    if (stream?.abort) await stream.abort().catch(() => undefined)
    if (error instanceof Error && error.name === 'AbortError' && !stream) return 'cancelled' as const
    throw error
  }
}
