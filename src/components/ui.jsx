import { useState, useEffect, useRef, forwardRef } from "react";
// Shared presentational primitives — light theme, black/white/red palette.
export const Card = forwardRef(function Card({ children, className = "" }, ref) {
  return <div ref={ref} className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>{children}</div>;
});
export function Toggle({ on, onChange, labelOn = "Yes", labelOff = "No" }) {
  return (
    <button onClick={() => onChange(!on)}
      className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition ${
        on ? "bg-red-600 text-white border-red-600"
           : "bg-gray-100 text-gray-500 border-gray-200"}`}>
      {on ? "✓ " + labelOn : labelOff}
    </button>
  );
}
export function Pill({ color, children }) {
  return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
    style={{ background: color + "1f", color }}>{children}</span>;
}
export function TextInput({ value, onChange, placeholder, type = "text", className = "", onKeyDown }) {
  return (
    <input type={type} value={value ?? ""} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
      className={`bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500 transition ${className}`} />
  );
}
export function Select({ value, onChange, options, className = "" }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={`bg-white border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900 ${className}`}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
export function IconBtn({ onClick, title, danger, children }) {
  return (
    <button title={title} onClick={onClick}
      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition ${
        danger ? "text-red-600 hover:bg-red-50" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"}`}>
      {children}
    </button>
  );
}
export function Empty({ icon, title, sub, action }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-semibold text-gray-700">{title}</div>
      {sub && <div className="text-sm mt-1 text-gray-500 max-w-sm mx-auto">{sub}</div>}
      {action && (
        <button onClick={action.onClick} className="mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold">{action.label}</button>
      )}
    </div>
  );
}
export function Stat({ label, value, color = "#dc2626", sub }) {
  return (
    <Card className="p-4 flex-1 min-w-0">
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{label}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </Card>
  );
}

// Text field that keeps its own value WHILE FOCUSED (so async saves can't snap
// it back), commits on a short debounce and on blur/Enter — smooth to type in.
export function EditableField({ value, onCommit, placeholder, type = "text", className = "", disabled = false, debounceMs = 400 }) {
  const [local, setLocal] = useState(value ?? "");
  const focused = useRef(false);
  const timer = useRef(null);
  useEffect(() => { if (!focused.current) setLocal(value ?? ""); }, [value]);
  const commit = (v) => { if (v !== (value ?? "")) onCommit(v); };
  const onChange = (e) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(v), debounceMs);
  };
  return (
    <input
      type={type} value={local} placeholder={placeholder} disabled={disabled}
      onFocus={() => { focused.current = true; }}
      onChange={onChange}
      onBlur={() => { focused.current = false; clearTimeout(timer.current); commit(local); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className={`bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500 transition disabled:opacity-50 ${className}`}
    />
  );
}
