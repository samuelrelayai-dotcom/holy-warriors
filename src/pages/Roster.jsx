import { useState } from "react";
import { Card, Stat, TextInput, EditableField, Empty } from "../components/ui.jsx";
import { COURSES, courseById } from "../domain/courses.js";
import { smsHref, mailtoHref, fillTemplate, DEFAULT_TEMPLATES } from "../domain/messaging.js";
import { rosterFor, activeRosterFor, droppedFor, unassignedFor, coachesForCourse, studentsForCoachInCourse } from "../domain/selectors.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { firstName, makeStudent } from "../domain/models.js";

const FILTERS = ["All", "Active", "Unassigned", "Dropped"];

export default function Roster({ state, upsertStudent, patchStudent, deleteStudent, roundId = null, readOnly = false, toast }) {
  const isMobile = useIsMobile();
  const [course, setCourse] = useState("HW1");
  const [filter, setFilter] = useState("All");
  const [newName, setNewName] = useState("");
  const addStudent = async () => {
    const nm = newName.trim();
    const st = makeStudent({ name: nm, roundId });
    st.progress[course] = "in_progress"; // enroll in the currently-selected class
    await upsertStudent(st);
    setNewName("");
    toast?.(nm ? `Added ${nm} to ${courseById(course)?.name || course}` : `Added a student to ${courseById(course)?.name || course}`);
  };

  const rows = rosterFor(state, course);
  const active = activeRosterFor(state, course);
  const dropped = droppedFor(state, course);
  const unassigned = unassignedFor(state, course);
  const courseName = courseById(course)?.name || course;
  const classCoaches = coachesForCourse(state, course);
  const coachOptionList = (currentId) => {
    const list = [...classCoaches];
    if (currentId && !list.some((c) => c.id === currentId)) {
      const extra = state.coaches.find((c) => c.id === currentId);
      if (extra) list.push(extra);
    }
    return list;
  };
  const activeStudents = active.map((r) => r.student);
  const classPhones = activeStudents.map((s) => s.phone).filter(Boolean);
  const classEmails = activeStudents.map((s) => s.email).filter(Boolean);
  const M = state.settings?.messages || {};
  const fillBulk = (t) => fillTemplate(t, { first: "there", className: courseName });
  const fillFor = (s, t) => fillTemplate(t, { first: firstName(s.name), name: s.name, className: courseName });
  const textBody = fillBulk(M.text || DEFAULT_TEMPLATES.text);
  const emailSubject = fillBulk(M.subject || DEFAULT_TEMPLATES.subject);
  const emailBody = fillBulk(M.body || DEFAULT_TEMPLATES.body);

  const visible = rows.filter((r) =>
    filter === "All" ? true :
    filter === "Active" ? !r.dropped :
    filter === "Unassigned" ? (!r.dropped && !r.coachId) :
    r.dropped
  );

  const setAssignment = (s, patch) =>
    patchStudent(s.id, { assignments: { ...s.assignments, [course]: { ...s.assignments[course], ...patch } } });
  const setDropped = (s, val) =>
    patchStudent(s.id, { dropped: { ...s.dropped, [course]: val } });
  const setIntent = (s, val) =>
    patchStudent(s.id, { intent: { ...(s.intent || {}), [course]: val } });
  const intentLabel = (v) => (v === "in_person" ? "In person" : v === "zoom" ? "Zoom" : "—");
  const removeStudent = (s) => {
    if (typeof window !== "undefined" && window.confirm && !window.confirm(`Delete ${s.name || "this student"}? This permanently removes them from every class, the roster, and attendance.`)) return;
    deleteStudent?.(s.id);
    toast?.(`Deleted ${s.name || "student"}`, { kind: "danger", action: { label: "Undo", onClick: () => upsertStudent?.(s) } });
  };
  const autoAssign = async () => {
    const list = unassignedFor(state, course);
    if (!list.length) { toast?.("No unassigned students in this class"); return; }
    const pool = coachesForCourse(state, course);
    if (!pool.length) { toast?.("No coaches set for this class — set a coach's class on the Volunteers tab", "danger"); return; }
    let i = 0;
    for (const r of list) { await setAssignment(r.student, { coachId: pool[i % pool.length].id }); i++; }
    toast?.(`Assigned ${list.length} student${list.length === 1 ? "" : "s"} across ${pool.length} coach${pool.length === 1 ? "" : "es"}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {COURSES.map((c) => (
          <button key={c.id} onClick={() => setCourse(c.id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold border transition"
            style={course === c.id ? { background: c.color, borderColor: c.color, color: "#fff" } : { background: "#fff", borderColor: "#e5e7eb", color: "#6b7280" }}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Stat label="On roster" value={active.length} color="#111827" />
        <Stat label="Assigned" value={active.length - unassigned.length} color="#dc2626" />
        <Stat label="Unassigned" value={unassigned.length} color="#6b7280" />
        <Stat label="Dropped out" value={dropped.length} color="#dc2626" />
      </div>

      <Card className="p-3">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Coaches for {courseName} ({classCoaches.length})</div>
          {unassigned.length > 0 && <span className="text-[11px] font-semibold text-amber-600">{unassigned.length} student{unassigned.length === 1 ? "" : "s"} unassigned</span>}
        </div>
        {classCoaches.length === 0 ? (
          <p className="text-xs text-gray-400">No coaches set for this class yet. On the Volunteers tab, set a coach's class to {courseName} (or confirm them for it) and they'll show up here.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {classCoaches.map((c) => {
              const n = studentsForCoachInCourse(state, course, c.id).length;
              return (
                <div key={c.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: n ? "#dc2626" : "#9ca3af" }}>{n}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-800 truncate">{c.name || "Unnamed coach"}</div>
                    <div className="text-[10px] text-gray-400 truncate">{c.tableNumber ? `Table ${c.tableNumber}` : "no table"}{c.phone ? ` · ${c.phone}` : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {activeStudents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Message this class:</span>
          <a href={smsHref(classPhones, textBody)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${classPhones.length ? "bg-gray-900 text-white border-gray-900 hover:bg-black" : "pointer-events-none opacity-40 border-gray-200"}`}>💬 Text class ({classPhones.length})</a>
          <a href={mailtoHref(classEmails, emailSubject, emailBody)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${classEmails.length ? "bg-red-600 text-white border-red-600 hover:bg-red-700" : "pointer-events-none opacity-40 border-gray-200"}`}>✉️ Email class ({classEmails.length})</a>
          <span className="text-[11px] text-gray-400">opens your phone / email — free</span>
        </div>
      )}

      {activeStudents.length > 0 && (() => {
        const ip = activeStudents.filter((s) => (s.intent || {})[course] === "in_person").length;
        const zm = activeStudents.filter((s) => (s.intent || {})[course] === "zoom").length;
        const un = activeStudents.length - ip - zm;
        return <div className="text-xs text-gray-500">Planned attendance: <span className="font-semibold text-gray-700">{ip} in person</span> · <span className="font-semibold text-gray-700">{zm} Zoom</span> · {un} undecided</div>;
      })()}

      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              filter === f ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            {f}{f === "Dropped" && dropped.length ? ` (${dropped.length})` : ""}
          </button>
        ))}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <TextInput value={newName} onChange={setNewName} placeholder={`Add a student to ${courseName}…`} className="w-64"
            onKeyDown={(e) => { if (e.key === "Enter") addStudent(); }} />
          <button onClick={addStudent} className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-semibold">+ Add student</button>
          <span className="text-xs text-gray-400">enrolls them in {courseName}</span>
        </div>
      )}

      {!readOnly && unassigned.length > 0 && (
        <div className="flex items-center gap-2">
          <button onClick={autoAssign} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold">✨ Auto-assign {unassigned.length} unassigned</button>
          <span className="text-xs text-gray-400">Distributes evenly across {(state.coaches.filter((c) => c.confirmed?.[course]).length || state.coaches.length)} coach(es){state.coaches.some((c)=>c.confirmed?.[course]) ? " confirmed for this class" : ""}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty icon="📋" title="No students in this course yet" sub="Enroll students (set them to In progress on the Journey tab) to build the roster." />
      ) : visible.length === 0 ? (
        <Empty icon="🔍" title={`No ${filter.toLowerCase()} students`} sub="Try a different filter." />
      ) : isMobile ? (
        <div className="space-y-3">
          {visible.map(({ student: s, coachId, table, dropped: isDropped }) => (
            <Card key={s.id} className={`p-3 ${isDropped ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800">{s.name || <span className="text-gray-400">Unnamed</span>}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${isDropped ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"}`}>{isDropped ? "Dropped" : "Active"}</span>
              </div>
              <label className="block mb-2">
                <span className="text-[11px] text-gray-500">Assigned coach</span>
                <select value={coachId || ""} disabled={isDropped || readOnly}
                  onChange={(e) => setAssignment(s, { coachId: e.target.value || null })}
                  className="mt-0.5 w-full bg-white border border-gray-300 rounded-lg px-2 py-2.5 text-sm text-gray-900 disabled:opacity-50">
                  <option value="">— Unassigned —</option>
                  {coachOptionList(coachId).map((c) => (
                    <option key={c.id} value={c.id}>{c.name || "Unnamed coach"}{c.confirmed?.[course] ? " ✓" : ""}</option>
                  ))}
                </select>
              </label>
              <label className="block mb-2">
                <span className="text-[11px] text-gray-500">Table #</span>
                <EditableField value={table} disabled={isDropped || readOnly} placeholder="—"
                  onCommit={(v) => setAssignment(s, { table: v })} className="mt-0.5 w-24" />
              </label>
              <label className="block mb-2">
                <span className="text-[11px] text-gray-500">Attending this class?</span>
                <select value={(s.intent || {})[course] || ""} disabled={isDropped || readOnly}
                  onChange={(e) => setIntent(s, e.target.value)}
                  className="mt-0.5 w-full bg-white border border-gray-300 rounded-lg px-2 py-2.5 text-sm text-gray-900 disabled:opacity-50">
                  <option value="">Not sure yet</option>
                  <option value="in_person">In person</option>
                  <option value="zoom">Zoom</option>
                </select>
              </label>
              {!readOnly && (
                <div className="flex gap-2 flex-wrap">
                  {coachId && !isDropped && (
                    <button onClick={() => setAssignment(s, { coachId: null, table: "" })}
                      className="px-3 py-2 rounded-md text-xs font-semibold text-gray-600 border border-gray-200">Unassign</button>
                  )}
                  {isDropped ? (
                    <button onClick={() => setDropped(s, false)}
                      className="px-3 py-2 rounded-md text-xs font-semibold text-red-600 border border-red-200">Re-activate</button>
                  ) : (
                    <button onClick={() => setDropped(s, true)}
                      className="px-3 py-2 rounded-md text-xs font-semibold text-red-600 border border-red-200">Mark dropped</button>
                  )}
                  {deleteStudent && (
                    <button onClick={() => removeStudent(s)}
                      className="px-3 py-2 rounded-md text-xs font-semibold text-white bg-red-600 hover:bg-red-700">🗑 Delete</button>
                  )}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                {s.phone && <a href={smsHref(s.phone, fillFor(s, M.text || DEFAULT_TEMPLATES.text))} className="px-3 py-2 rounded-md text-xs font-semibold border border-gray-200 text-gray-700">💬 Text</a>}
                {s.email && <a href={mailtoHref(s.email, fillFor(s, M.subject || DEFAULT_TEMPLATES.subject), fillFor(s, M.body || DEFAULT_TEMPLATES.body))} className="px-3 py-2 rounded-md text-xs font-semibold border border-gray-200 text-gray-700">✉️ Email</a>}
              </div>
              {readOnly && <span className="text-xs text-gray-400">view only</span>}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="p-3 font-medium">Student</th>
                <th className="p-3 font-medium">Assigned coach</th>
                <th className="p-3 font-medium text-center">Table #</th>
                <th className="p-3 font-medium text-center">Attending</th>
                <th className="p-3 font-medium text-center">Status</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ student: s, coachId, table, dropped: isDropped }) => (
                <tr key={s.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isDropped ? "opacity-60" : ""}`}>
                  <td className="p-3 font-medium text-gray-800">
                    {s.name || <span className="text-gray-400">Unnamed</span>}
                    {isDropped && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">DROPPED</span>}
                  </td>
                  <td className="p-2">
                    <select value={coachId || ""} disabled={isDropped || readOnly}
                      onChange={(e) => setAssignment(s, { coachId: e.target.value || null })}
                      className="bg-white border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900 min-w-[160px] disabled:opacity-50">
                      <option value="">— Unassigned —</option>
                      {coachOptionList(coachId).map((c) => (
                        <option key={c.id} value={c.id}>{c.name || "Unnamed coach"}{c.confirmed?.[course] ? " ✓" : ""}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    <EditableField value={table} disabled={isDropped || readOnly} placeholder="—"
                      onCommit={(v) => setAssignment(s, { table: v })} className="w-16 text-center" />
                  </td>
                  <td className="p-2 text-center">
                    <select value={(s.intent || {})[course] || ""} disabled={isDropped || readOnly}
                      onChange={(e) => setIntent(s, e.target.value)}
                      className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900 disabled:opacity-50">
                      <option value="">—</option>
                      <option value="in_person">In person</option>
                      <option value="zoom">Zoom</option>
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${isDropped ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"}`}>
                      {isDropped ? "Dropped out" : "Active"}
                    </span>
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {s.phone && <a href={smsHref(s.phone, fillFor(s, M.text || DEFAULT_TEMPLATES.text))} title="Text" className="inline-block px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 mr-1">💬</a>}
                    {s.email && <a href={mailtoHref(s.email, fillFor(s, M.subject || DEFAULT_TEMPLATES.subject), fillFor(s, M.body || DEFAULT_TEMPLATES.body))} title="Email" className="inline-block px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 mr-1">✉️</a>}
                    {readOnly && <span className="text-xs text-gray-400">view only</span>}
                    {!readOnly && coachId && !isDropped && (
                      <button onClick={() => setAssignment(s, { coachId: null, table: "" })}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold text-gray-600 hover:bg-gray-100 border border-gray-200 mr-1">Unassign</button>
                    )}
                    {!readOnly && isDropped ? (
                      <button onClick={() => setDropped(s, false)}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200">Re-activate</button>
                    ) : (!readOnly &&
                      <button onClick={() => setDropped(s, true)}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200">Mark dropped</button>
                    )}
                    {!readOnly && deleteStudent && (
                      <button onClick={() => removeStudent(s)} title="Delete student"
                        className="ml-1 px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-red-600 hover:bg-red-700">🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-xs text-gray-400">Assign each student to a coach and table for this course. Use Unassign to free them up, or pick a different coach to reassign. "Mark dropped" tracks students who left the class.</p>
    </div>
  );
}
