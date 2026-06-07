import { useState } from "react";
import { Card, Pill } from "../components/ui.jsx";
import { COURSES, BOOK_COURSES, BOOK_PRICES } from "../domain/courses.js";
import { enrolledIn } from "../domain/selectors.js";

const money = (n) => "$" + (n || 0).toLocaleString();

export default function Inventory({ state, upsertInventory, patchStudent, toast }) {
  const [open, setOpen] = useState({});      // which class payment lists are expanded
  const [stockOpen, setStockOpen] = useState(false);

  const adjust = (course, delta) => {
    const inv = state.inventory[course];
    const next = Math.max(0, inv.count + delta);
    upsertInventory(course, { count: next });
    if (next <= inv.threshold) toast?.(`Low stock: ${course} (${next} left)`, "warn");
  };
  const setPaid = (s, course, paid) =>
    patchStudent(s.id, { bookPaid: { ...(s.bookPaid || {}), [course]: paid } });
  const markAll = (students, course, paid) =>
    students.forEach((s) => { if (!!(s.bookPaid || {})[course] !== paid) setPaid(s, course, paid); });

  const bookCourses = COURSES.filter((c) => BOOK_COURSES.includes(c.id));
  let collected = 0, owed = 0, paidCount = 0, oweCount = 0;
  const perClass = bookCourses.map((c) => {
    const price = BOOK_PRICES[c.id];
    const students = enrolledIn(state, c.id).slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const paid = students.filter((s) => (s.bookPaid || {})[c.id]);
    const owe = students.filter((s) => !(s.bookPaid || {})[c.id]);
    collected += paid.length * price; owed += owe.length * price;
    paidCount += paid.length; oweCount += owe.length;
    return { c, price, students, paidN: paid.length, oweN: owe.length, oweAmt: owe.length * price };
  });

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-3xl font-bold text-[#047857]">{money(collected)}</div><div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Collected</div><div className="text-[11px] text-gray-400">{paidCount} paid</div></Card>
        <Card className="p-4"><div className="text-3xl font-bold text-[#dc2626]">{money(owed)}</div><div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Outstanding</div><div className="text-[11px] text-gray-400">{oweCount} owe</div></Card>
        <Card className="p-4"><div className="text-3xl font-bold text-gray-900">{money(collected + owed)}</div><div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Expected total</div></Card>
        <Card className="p-4"><div className="text-3xl font-bold text-gray-900">{paidCount + oweCount}</div><div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Books needed</div></Card>
      </div>

      {/* Payments — collapsible per class */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">Book payments</h3>
        <p className="text-sm text-gray-500 mb-3">Tap a class to expand. Flip each student's switch to Paid. (HW1 &amp; HW2 $20, HW3 $25.)</p>
        <div className="space-y-2">
          {perClass.map(({ c, price, students, paidN, oweN, oweAmt }) => {
            const isOpen = !!open[c.id];
            return (
              <Card key={c.id} className="overflow-hidden">
                <button onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-400 text-xs">{isOpen ? "▾" : "▸"}</span>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="font-semibold text-gray-900 truncate">{c.name}</span>
                    <span className="text-xs text-gray-400">· {money(price)}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    {oweN > 0
                      ? <span className="text-[#dc2626] font-semibold">{oweN} owe · {money(oweAmt)}</span>
                      : <span className="text-[#047857] font-semibold">all paid ✓</span>}
                    <span className="text-gray-400">{paidN}/{students.length}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {students.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400">No students enrolled in this class yet.</div>
                    ) : (<>
                      <div className="flex justify-end gap-2 px-4 py-2 bg-gray-50 text-[11px]">
                        <button onClick={() => markAll(students, c.id, true)} className="font-semibold text-[#047857] hover:underline">Mark all paid</button>
                        <span className="text-gray-300">|</span>
                        <button onClick={() => markAll(students, c.id, false)} className="font-semibold text-gray-500 hover:underline">Reset</button>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {students.map((s) => {
                          const paid = !!(s.bookPaid || {})[c.id];
                          return (
                            <div key={s.id} className="flex items-center justify-between px-4 py-1.5">
                              <span className="text-sm text-gray-800 truncate">{s.name || <span className="text-gray-400">Unnamed</span>}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-semibold tabular-nums ${paid ? "text-gray-300" : "text-[#dc2626]"}`}>{paid ? money(0) : money(price)}</span>
                                <button onClick={() => setPaid(s, c.id, !paid)} role="switch" aria-checked={paid}
                                  title={paid ? "Paid — tap to mark unpaid" : "Tap to mark paid"}
                                  className="relative w-14 h-7 rounded-full transition" style={{ background: paid ? "#047857" : "#e5e7eb" }}>
                                  <span className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform" style={{ transform: paid ? "translateX(28px)" : "none" }} />
                                  <span className="absolute inset-0 flex items-center text-[9px] font-bold" style={{ justifyContent: paid ? "flex-start" : "flex-end", paddingLeft: paid ? 6 : 0, paddingRight: paid ? 0 : 6, color: paid ? "#fff" : "#9ca3af" }}>{paid ? "PAID" : "OWES"}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>)}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Book stock — collapsible */}
      <div>
        <button onClick={() => setStockOpen((v) => !v)} className="flex items-center gap-2 font-semibold text-gray-800 mb-2">
          <span className="text-gray-400 text-xs">{stockOpen ? "▾" : "▸"}</span> Book stock
        </button>
        {stockOpen && (
          <div className="grid md:grid-cols-2 gap-4">
            {bookCourses.map((c) => {
              const inv = state.inventory[c.id];
              const low = inv.count <= inv.threshold;
              return (
                <Card key={c.id} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                      <h3 className="font-semibold text-gray-900">{c.name}</h3>
                    </div>
                    {low && <Pill color="#dc2626">⚠ Buy more books</Pill>}
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => adjust(c.id, -1)} className="w-10 h-10 rounded-lg bg-[#f3f4f6] border border-[#e5e7eb] text-gray-700 text-xl hover:bg-[#ebebeb]">−</button>
                    <input type="number" value={inv.count} min="0"
                      onChange={(e) => upsertInventory(c.id, { count: Math.max(0, parseInt(e.target.value || "0")) })}
                      className="w-24 text-center text-2xl font-bold bg-transparent text-gray-900 border-b border-[#e5e7eb] focus:outline-none focus:border-red-600" />
                    <button onClick={() => adjust(c.id, +1)} className="w-10 h-10 rounded-lg bg-[#f3f4f6] border border-[#e5e7eb] text-gray-700 text-xl hover:bg-[#ebebeb]">+</button>
                    <span className="text-sm text-gray-500">in stock</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Alert when ≤</span>
                    <input type="number" value={inv.threshold} min="0"
                      onChange={(e) => upsertInventory(c.id, { threshold: Math.max(0, parseInt(e.target.value || "0")) })}
                      className="w-16 text-center bg-[#f9fafb] border border-[#e5e7eb] rounded-lg px-2 py-1 text-gray-900 focus:outline-none focus:border-red-600" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
