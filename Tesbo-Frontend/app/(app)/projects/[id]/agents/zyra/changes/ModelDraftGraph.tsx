"use client";

import { useEffect, useId, useRef, useState } from "react";
/**
 * The structural subset this schematic uses. A validated preview and a persisted revision's
 * preview projection both satisfy it; the graph does not need model identity or authority fields.
 */
type GraphPreview = {
  definition: { initialStateId: string };
  states: Array<{ id: string; label: string; reachable: boolean }>;
  transitions: Array<{
    id: string;
    from: string;
    to: string;
    action: string;
    expectedObservation: string;
    reachable: boolean;
  }>;
};

/** Schematic presentation of the admitted native response; never a model interpreter. */
export function ModelDraftGraph({ preview }: { preview: GraphPreview }) {
  const id = useId().replace(/:/g, "");
  const [selected, setSelected] = useState(preview.transitions[0]?.id ?? "");
  const [actualSize, setActualSize] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const radius = Math.max(140, preview.states.length * 26);
  const size = radius * 2 + 320;
  const positions = new Map(preview.states.map((state, index) => {
    const angle = index * 2 * Math.PI / preview.states.length - Math.PI / 2;
    const orbit = preview.states.length === 1 ? 0 : radius;
    return [state.id, { x: size / 2 + orbit * Math.cos(angle), y: size / 2 + orbit * Math.sin(angle) }];
  }));
  const edge = preview.transitions.find(item => item.id === selected);
  const focus = positions.get(edge?.from ?? preview.definition.initialStateId)!;
  useEffect(() => {
    const pane = viewport.current;
    if (!pane) return;
    // Start actual-size inspection at the selected source, not empty canvas.
    pane.scrollTo(actualSize ? {
      left: focus.x - pane.clientWidth / 2, top: focus.y - pane.clientHeight / 2
    } : { left: 0, top: 0 });
  }, [actualSize, selected, focus.x, focus.y]);
  const stateName = (stateId: string) => preview.states.find(state => state.id === stateId)?.label ?? stateId;

  return <section aria-label="Draft state graph" className="min-w-0 space-y-3 rounded border border-[var(--border)] p-3">
    <h3 className="font-medium">Draft state graph</h3>
    <p className="text-xs text-[var(--muted)]">Schematic draft structure only. Arrows are declared transitions, not executed paths.
      Dashed states and arrows are unreachable according to the native preview. Exact labels and details remain in the tables.</p>
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={actualSize} onChange={event => setActualSize(event.target.checked)} />
      Show graph at actual size
    </label>
    <div ref={viewport} role="region" aria-label="Scrollable draft graph" tabIndex={0}
      className="max-h-96 min-w-0 overflow-auto rounded border border-[var(--border)]">
      <svg role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} viewBox={`0 0 ${size} ${size}`}
        className="mx-auto block" style={{ width: actualSize ? size : "100%", height: actualSize ? size : "auto",
          maxWidth: actualSize ? undefined : 680, maxHeight: actualSize ? undefined : 360 }}>
        <title id={`${id}-title`}>{preview.states.length} draft states and {preview.transitions.length} directed transitions</title>
        <desc id={`${id}-description`}>Circular layout, not execution order. Use Inspect draft transition below for exact endpoints, action and expected observation. Initial state: {preview.definition.initialStateId}.</desc>
        <defs><marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker></defs>
        {preview.transitions.map(item => {
          const from = positions.get(item.from)!, to = positions.get(item.to)!;
          const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy);
          // Separate parallel/return edges without modifying the declared graph.
          const siblings = preview.transitions.filter(other => other.from === item.from && other.to === item.to);
          const rank = siblings.findIndex(other => other.id === item.id);
          const offset = 30 + rank * 60 / Math.max(1, siblings.length - 1);
          const cx = (from.x + to.x) / 2 - dy / (distance || 1) * offset;
          const cy = (from.y + to.y) / 2 + dx / (distance || 1) * offset;
          const terminalX = to.x - cx, terminalY = to.y - cy;
          const border = Math.min(78 / Math.abs(terminalX), 32 / Math.abs(terminalY));
          const path = item.from === item.to
            ? `M ${from.x - 25} ${from.y - 32} C ${from.x - offset - 50} ${from.y - offset - 50}, ${from.x + offset + 50} ${from.y - offset - 50}, ${from.x + 25} ${from.y - 32}`
            : `M ${from.x} ${from.y} Q ${cx} ${cy}, ${to.x - terminalX * border} ${to.y - terminalY * border}`;
          return <path key={item.id} data-model-transition={item.id} d={path} fill="none"
            stroke={selected === item.id ? "var(--primary, #7c3aed)" : "var(--muted, #64748b)"}
            strokeWidth={selected === item.id ? 4 : 2} strokeDasharray={item.reachable ? undefined : "6 4"}
            markerEnd={`url(#${id}-arrow)`}>
            <title>{item.id}: {item.from} → {item.to}</title>
          </path>;
        })}
        {preview.states.map(state => {
          const point = positions.get(state.id)!;
          return <g key={state.id} data-model-state={state.id} transform={`translate(${point.x},${point.y})`}>
            <title>{state.id}: {state.label}; {state.reachable ? "reachable" : "unreachable"}</title>
            <rect x="-78" y="-32" width="156" height="64" rx="10" fill="var(--background, white)"
              stroke="var(--foreground, #111827)" strokeWidth={state.id === preview.definition.initialStateId ? 3 : 1}
              strokeDasharray={state.reachable ? undefined : "6 4"} />
            <text textAnchor="middle" y="-4" fontSize="13" fill="var(--foreground, #111827)">{state.label.length > 20 ? state.label.slice(0, 19) + "…" : state.label}</text>
            <text textAnchor="middle" y="16" fontSize="11" fill="var(--foreground, #111827)">{state.id === preview.definition.initialStateId ? "Initial · " : ""}{state.reachable ? "Reachable" : "Unreachable"}</text>
          </g>;
        })}
      </svg>
    </div>
    {preview.transitions.length ? <>
      <label htmlFor={`${id}-edge`} className="block">Inspect draft transition</label>
      <select id={`${id}-edge`} value={selected} onChange={event => setSelected(event.target.value)}
        className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--background)] p-2">
        {preview.transitions.map(item => <option key={item.id} value={item.id}>{item.id}: {item.from} → {item.to}</option>)}
      </select>
      {edge && <dl aria-label="Selected draft transition" className="space-y-1 break-words text-xs">
        <dt className="font-semibold">Declared endpoints</dt><dd>{stateName(edge.from)} ({edge.from}) → {stateName(edge.to)} ({edge.to})</dd>
        <dt className="font-semibold">Declared action</dt><dd>{edge.action}</dd>
        <dt className="font-semibold">Expected observation (unapproved)</dt><dd>{edge.expectedObservation}</dd>
        <dt className="font-semibold">Structural reachability</dt><dd>{edge.reachable ? "Reachable" : "Unreachable"}; no runtime evidence</dd>
      </dl>}
    </> : <p>This graph has no declared transitions.</p>}
  </section>;
}
