import { useState } from "react";
import { Card, TextInput, Empty } from "../components/ui.jsx";
import { COURSES, WEEKS, ATTENDANCE, ATT_CYCLE, courseById } from "../domain/courses.js";
import { enrolledIn, presentCount } from "../domain/selectors.js";
import { makeStudent } from "../domain/models.js";
import { smsHref, mailtoHref } from "../domain/messaging.js";
import { useIsMobile } from "../hooks/useIsMobile.js";

const GROUPS = [["students", "Students"], ["coaches", "Coaches"], ["admins", "Admins"]];

export default function Attendance({ state, patchStudent, patchCoach, patchAdmin, deleteStudent, upsertStudent, roundId = null, toast }) {
  const isMobile = useIsMobile();
  const [course, setCourse] = useState("HW1");
  const [group, setGroup] = useState("students");
  const [absWeek, setAbsWeek] = useState("w1");

  const people = group === "students" ? enrolledIn(state, course)
    : group === "coaches" ? state.coaches : state.admins;
  const patch = group === "students" ? patchStudent : group === "coaches" ? patchCoach : patchAdmin;

  const cycle = (p, wk) => {
    const cur = (p.attendance?.[course]?.[wk]) || "";
    const next = ATT_CYCLE[(ATT_CYCLE.indexOf(cur) + 1) % ATT_CYCLE.length];
    patch(p.id, { attendance: { ...p.attendance, [course]: { ...(p.attendance?.[course] || {}), [wk]: next } } });
  };
  const toggleConfirm = (s) => patchStudent(s.id, { confirmed: { ...s.confirmed, [course]: !s.confirmed[course] } });
  const removeStudent = (st) => {
    if (typeof window !== "undefined" && window.confirm && !window.confirm(`Delete ${st.name || "this student"}? This permanently removes them from every class, the roster, and attendance.`)) return;
    deleteStudent?.(st.id);
    toast?.(`Deleted ${st.name || "student"}`, { kind: "danger", action: { label: "Undo", onClick: () => upsertStudent?.(st) } });
  };
  const [newName, setNewName] = useState("");
  const addStudent = async () => {
    const nm = newName.trim();
    const st = makeStudent({ name: nm, roundId });
    st.progress[course] = "in_progress"; // enroll in the currently-selected class
    await upsertStudent?.(st);
    setNewName("");
    toast?.(nm ? `Added ${nm} to ${courseById(course)?.name || course}` : `Added a student to ${courseById(course)?.name || course}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {COURSES.map((c) => (
          <button key={c.id} onClick={() => setCourse(c.id)}
            className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold border transition"
            style={course === c.id ? { background: c.color, borderColor: c.color, color: "#fff" } : { background: "#fff", borderColor: "#e5e7eb", color: "#6b7280" }}>
            {c.name}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {GROUPS.map(([g, label]) => (
          <button key={g} onClick={() => setGroup(g)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${group === g ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{label}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 items-center">
        {Object.entries(ATTENDANCE).filter(([k]) => k).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: v.color }} /> {v.label}</span>
        ))}
        <span className="text-gray-400">· tap a cell to cycle</span>
      </div>

      {group === "students" && people.length > 0 && (() => {
        const absentees = people.filter((p) => !ATTENDANCE[p.attendance?.[course]?.[absWeek] || ""]?.present);
        const phones = absentees.map((p) => p.phone).filter(Boolean);
        const emails = absentees.map((p) => p.email).filter(Boolean);
        const wkLabel = (WEEKS.find((w) => w.key === absWeek) || {}).label || "";
        const cName = courseById(course)?.name || course;
        const body = `Hi! We missed you at ${cName} (${wkLabel}). Hope to see you next time! — The Way`;
        return (
          <div className="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
            <span className="text-xs font-semibold text-gray-600">Follow up absentees:</span>
            <select value={absWeek} onChange={(e) => setAbsWeek(e.target.value)} className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900">
              {WEEKS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
            </select>
            <span className="text-xs text-gray-500">{absentees.length} absent</span>
            <a href={smsHref(phones, body)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${phones.length ? "bg-gray-900 text-white border-gray-900 hover:bg-black" : "pointer-events-none opacity-40 border-gray-200"}`}>💬 Text ({phones.length})</a>
            <a href={mailtoHref(emails, `We missed you — ${cName}`, body)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${emails.length ? "bg-red-600 text-white border-red-600 hover:bg-red-700" : "pointer-events-none opacity-40 border-gray-200"}`}>✉️ Email ({emails.length})</a>
          </div>
        );
      })()}

      {group === "students" && upsertStudent && (
        <div className="flex flex-wrap items-center gap-2">
          <TextInput value={newName} onChange={setNewName} placeholder={`Add a student to ${courseById(course)?.name || course}…`} className="w-64"
            onKeyDown={(e) => { if (e.key === "Enter") addStudent(); }} />
          <button onClick={addStudent} className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-semibold">+ Add student</button>
        </div>
      )}

      {people.length === 0 ? (
        <Empty icon="🗓️" title={`No ${group} to track here`} sub={group === "students" ? "Add a student above, or set one to In progress on the Journey tab." : `Add ${group} on the ${group} tab.`} />
      ) : (
        isMobile ? (
          <div className="space-y-3">
            {people.map((p) => {
              const present = presentCount(p, course);
              return (
                <Card key={p.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-800">{p.name || <span className="text-gray-400">Unnamed</span>}</span>
                    <span className="text-xs font-semibold" style={{ color: present >= 4 ? "#dc2626" : "#9ca3af" }}>{present}/5 present</span>
                  </div>
                  {group === "students" && (
                    <button onClick={() => toggleConfirm(p)} className="mb-2 px-2.5 py-1.5 rounded-md text-xs font-semibold border transition"
                      style={p.confirmed[course] ? { background: "#dc262622", borderColor: "#dc262655", color: "#dc2626" } : { background: "#fff", borderColor: "#e5e7eb", color: "#9ca3af" }}>
                      {p.confirmed[course] ? "✓ Confirmed to serve" : "Confirm to serve"}
                    </button>
                  )}
                  <div className="flex gap-1.5">
                    {WEEKS.map((w) => {
                      const st = (p.attendance?.[course]?.[w.key]) || "";
                      const m = ATTENDANCE[st];
                      return (
                        <button key={w.key} onClick={() => cycle(p, w.key)} title={`${w.label}: ${m.label}`}
                          className="flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg border transition"
                          style={{ background: m.bg, borderColor: st ? m.color + "55" : "#e5e7eb" }}>
                          <span className="text-[10px] text-gray-400 font-medium">{w.label.replace("Week ", "W").replace("Makeup", "MU")}</span>
                          <span className="w-9 h-9 leading-9 rounded-md font-bold text-sm" style={{ color: m.color }}>{m.short}</span>
                        </button>
                      );
                    })}
                  </div>
                  {group === "students" && deleteStudent && (
                    <div className="flex justify-end mt-2">
                      <button onClick={() => removeStudent(p)} className="px-2.5 py-1 rounded-md text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50">🗑 Delete</button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="p-3 font-medium sticky left-0 bg-white">{group === "students" ? "Student" : group === "coaches" ? "Coach" : "Admin"}</th>
                {group === "students" && <th className="p-3 font-medium text-center">Confirmed</th>}
                {WEEKS.map((w) => <th key={w.key} className="p-3 font-medium text-center">{w.label}</th>)}
                <th className="p-3 font-medium text-center">Present</th>
                {group === "students" && deleteStudent && <th className="p-3 font-medium text-center">Delete</th>}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const present = presentCount(p, course);
                return (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 sticky left-0 bg-white font-medium text-gray-800">{p.name || <span className="text-gray-400">Unnamed</span>}</td>
                    {group === "students" && (
                      <td className="p-2 text-center">
                        <button onClick={() => toggleConfirm(p)} className="px-2 py-1 rounded-md text-xs font-semibold border transition"
                          style={p.confirmed[course] ? { background: "#dc262622", borderColor: "#dc262655", color: "#dc2626" } : { background: "#fff", borderColor: "#e5e7eb", color: "#9ca3af" }}>
                          {p.confirmed[course] ? "✓ Confirmed" : "Confirm"}
                        </button>
                      </td>
                    )}
                    {WEEKS.map((w) => {
                      const st = (p.attendance?.[course]?.[w.key]) || "";
                      const m = ATTENDANCE[st];
                      return (
                        <td key={w.key} className="p-2 text-center">
                          <button onClick={() => cycle(p, w.key)} title={`${w.label}: ${m.label}`}
                            className="w-10 h-9 rounded-md font-bold text-xs border transition"
                            style={{ background: m.bg, borderColor: st ? m.color + "55" : "#e5e7eb", color: m.color }}>{m.short}</button>
                        </td>
                      );
                    })}
                    <td className="p-3 text-center font-semibold" style={{ color: present >= 4 ? "#dc2626" : "#9ca3af" }}>{present}/5</td>
                    {group === "students" && deleteStudent && (
                      <td className="p-2 text-center">
                        <button onClick={() => removeStudent(p)} title="Delete student" className="px-2 py-1 rounded-md text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50">🗑</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        )
      )}
    </div>
  );
}
