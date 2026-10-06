import { useEffect, useRef, useState } from 'react'
import { renderPlanPicture, type PictureInput } from './plan-picture'
import { savePng, type SavePicker } from './data/export-layout'

type Picture = Awaited<ReturnType<typeof renderPlanPicture>> & { url: string }
export function ExportPicture({ input, onClose }: { input: PictureInput; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [picture, setPicture] = useState<Picture | null>(null)
  const [message, setMessage] = useState('Preparing the whole plan…')
  const [busy, setBusy] = useState(false)
  const filename = `uhd-cs-course-plan-${input.year}-${input.theme}.png`
  useEffect(() => {
    dialog.current?.showModal()
    let active = true, url: string | undefined
    const controller = new AbortController()
    void renderPlanPicture(input, controller.signal).then(result => {
      if (!active) return
      url = URL.createObjectURL(result.blob)
      setPicture({ ...result, url }); setMessage('Picture ready to save.')
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'The picture could not be prepared. Please try again.') })
    return () => { active = false; controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [input])
  const download = () => {
    if (!picture) return
    const anchor = document.createElement('a')
    anchor.href = picture.url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove()
  }
  const save = async () => {
    if (!picture || busy) return
    setBusy(true)
    const picker = (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker
    try {
      const result = await savePng(picture.blob, filename, picker?.bind(window), download)
      setMessage(result === 'cancelled' ? 'Save canceled. Your picture is still ready.' : result === 'saved' ? 'Picture saved.' : 'Download started. Your browser controls the save location.')
    } catch { setMessage('Could not save to that location. Try again or use Download PNG.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="export-dialog" aria-labelledby="export-title" onClose={onClose} onCancel={event => { if (busy) event.preventDefault() }}>
    <div className="dialog-top"><span>YOUR COURSE PLAN</span><button autoFocus disabled={busy} aria-label="Close picture preview" onClick={onClose}>×</button></div>
    <h2 id="export-title">Save a picture</h2>
    <p>Includes every visible course area, even outside the current view. Hidden Taken courses stay hidden. Your layout and zoom stay unchanged.</p>
    <p role="status">{message}</p>
    {picture && <>
      <p>{input.nodes.filter(node => node.type === 'course').length} course cards · {input.edges.length} connections · {picture.frame.pixelWidth} × {picture.frame.pixelHeight} pixels · {(picture.blob.size / 1024 / 1024).toFixed(1)} MB{picture.frame.reduced ? ' · Resolution reduced to fit the whole plan safely. Zoom into the saved image to inspect it.' : ''}</p>
      <a className="export-preview-link" href={picture.url} target="_blank" rel="noreferrer" aria-label="Open full-size picture"><img src={picture.url} alt="Preview of the entire course plan" /></a>
      <div className="export-actions"><button disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save PNG…'}</button><button disabled={busy} onClick={() => { download(); setMessage('Download started. Your browser controls the save location.') }}>Download PNG</button></div>
      <p className="muted">Save PNG asks for a location when your browser supports it. Otherwise, it downloads the image using your browser’s download settings.</p>
    </>}
  </dialog>
}
