import { useState } from 'react'
import type { Plan } from './data/plan-state'

export type ConnectionOption = { id: string; label: string; hidden: boolean }
export function ConnectionTools({ options, source, onStart, onConnect, onCancel, edges, selected, onSelect, onRemove, message }: {
  options: ConnectionOption[]; source: string | null; onStart: (id: string) => void; onConnect: (id: string) => void; onCancel: () => void;
  edges: Plan['customEdges']; selected: string | null; onSelect: (id: string) => void; onRemove: (id: string) => void; message: string;
}) {
  const [target, setTarget] = useState('')
  const label = (id: string) => options.find(option => option.id === id)?.label ?? id
  const targets = options.filter(option => !option.hidden)
  return <section className="connection-tools" aria-label="Personal connections">
    <p>Double-click a card, then click a destination. Blue dashed lines are personal planning links. Official prerequisites stay unchanged.</p>
    <div className="connection-fields"><label>From course<select aria-label="Connection source" value={source ?? ''} onChange={event => { onStart(event.target.value); setTarget('') }}><option value="">Choose source...</option>{targets.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label>To course<select aria-label="Connection destination" value={targets.some(option => option.id === target) ? target : ''} onChange={event => setTarget(event.target.value)}><option value="">Choose destination...</option>{targets.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <button disabled={!source || !target || !targets.some(option => option.id === target)} onClick={() => onConnect(target)}>Connect</button><button disabled={!source} onClick={onCancel}>Cancel connection</button></div>
    <p role="status" className="connection-message">{message || (source ? `Connecting from ${label(source)}. Choose a destination or press Escape.` : 'Choose a source course to begin.')}</p>
    {edges.length > 0 && <ul className="personal-link-list">{edges.map(edge => <li key={edge.id}><button aria-pressed={selected === edge.id} onClick={() => onSelect(edge.id)}>{label(edge.source)} → {label(edge.target)}</button><button aria-label={`Remove connection ${label(edge.source)} to ${label(edge.target)}`} onClick={() => onRemove(edge.id)}>Remove</button></li>)}</ul>}
    {selected && edges.some(edge => edge.id === selected) && <button onClick={() => onRemove(selected)}>Remove selected connection</button>}
  </section>
}
