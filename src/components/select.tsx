"use client";

import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";

type Item = { kind: "option"; value: string; label: string; disabled: boolean } | { kind: "group"; label: string };

function text(node: ReactNode): string {
  return Children.toArray(node).map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : "")).join("");
}

function collect(children: ReactNode, out: Item[] = []): Item[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ children?: ReactNode; value?: string; label?: string; disabled?: boolean }>;
    if (el.type === Fragment) collect(el.props.children, out);
    else if (el.type === "optgroup") { out.push({ kind: "group", label: el.props.label ?? "" }); collect(el.props.children, out); }
    else if (el.type === "option") {
      const label = text(el.props.children);
      out.push({ kind: "option", value: el.props.value ?? label, label, disabled: !!el.props.disabled });
    }
  });
  return out;
}

type Props = {
  name?: string; className?: string; required?: boolean; disabled?: boolean; "aria-label"?: string;
  defaultValue?: string; value?: string; onChange?: (value: string) => void; children: ReactNode;
};

/**
 * Desplegable propio (la lista nativa la dibuja el sistema y sale oscura con el modo oscuro del equipo).
 * Un <select> nativo oculto conserva el valor para formularios, `required` y reset.
 */
export function Select({ name, className = "", required, disabled, children, defaultValue, value: controlled, onChange, ...rest }: Props) {
  const items = collect(children);
  const options = items.filter((i): i is Extract<Item, { kind: "option" }> => i.kind === "option");
  const nativeRef = useRef<HTMLSelectElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const value = controlled ?? inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    const form = nativeRef.current?.form;
    if (!form) return;
    const onReset = () => setTimeout(() => nativeRef.current && setInner(nativeRef.current.value), 0);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(v: string) {
    setInner(v);
    setOpen(false);
    onChange?.(v);
  }
  function openList() {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }
  function move(dir: 1 | -1) {
    let i = active;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) break;
    }
    setActive(i);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!open) openList(); else move(e.key === "ArrowDown" ? 1 : -1); }
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) openList();
      else if (options[active] && !options[active].disabled) choose(options[active].value);
    } else if (e.key === "Tab") setOpen(false);
  }

  let optIndex = -1;
  return (
    <div ref={rootRef} className={`relative ${className.includes("w-auto") ? "inline-block" : ""}`} onKeyDown={onKeyDown}>
      <button type="button" disabled={disabled} role="combobox" aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" aria-label={rest["aria-label"]}
        onClick={() => (open ? setOpen(false) : openList())}
        className={`input flex items-center justify-between gap-2 text-left ${className} ${current && !current.disabled ? "" : "muted"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
        <span className="truncate">{current?.label ?? ""}</span>
        <svg aria-hidden viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7.5l5 5 5-5" /></svg>
      </button>
      <select ref={nativeRef} name={name} required={required} disabled={disabled} value={value} onChange={() => {}} tabIndex={-1} aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0">
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
      {open && (
        <ul id={listId} role="listbox" className="absolute left-0 z-50 mt-1 max-h-64 min-w-full overflow-auto rounded-lg border border-slate-300 bg-white p-1 shadow-lg">
          {items.map((it, i) => {
            if (it.kind === "group") return <li key={`g${i}`} role="presentation" className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{it.label}</li>;
            optIndex++;
            const idx = optIndex;
            const selected = it.value === value;
            return (
              <li key={`${it.value}-${i}`} role="option" aria-selected={selected} aria-disabled={it.disabled}
                onMouseEnter={() => !it.disabled && setActive(idx)} onMouseDown={(e) => e.preventDefault()}
                onClick={() => !it.disabled && choose(it.value)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${it.disabled ? "cursor-not-allowed text-slate-400" : "cursor-pointer text-slate-900"} ${selected ? "bg-blue-100 font-semibold text-blue-900" : active === idx && !it.disabled ? "bg-slate-100" : ""}`}>
                {it.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
