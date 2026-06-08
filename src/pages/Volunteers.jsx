import { useEffect, useRef, useState } from "react";
import { Card, TextInput, EditableField, Toggle, Select, IconBtn, Empty } from "../components/ui.jsx";
import { COURSES, GENDERS, courseById } from "../domain/courses.js";
import { makeCoach, makeAdmin, fullName } from "../domain/models.js";
import { parseVolunteersCsv } from "../domain/csv.js";
import { notifyCoach } from "../data/pushClient.js";

const TYPES = [
  { id: "all", label: "All" },
  { id: "coach", label: "Coaches" },
  { id: "admin", label: "Admins" },
];

// One unified card for a coach or an admin — collapsible.
function VolunteerCard({ v, type, students, set, onDelete, assignedTo, otherLabel, toggleStudent, flash, expanded, onToggle }) {
  const ref = useRef(null);
  useEffect(() => { if (flash && ref.current && typeof ref.current.scrollIntoView === "function") ref.current.scrollIntoView({ behavior: "smooth", block: "center" }); }, [flash]);
  const isCoach = type === "coach";
  const badge = isCoach ? { label: "Coach", bg: "#dc2626" } : { label: "Admin", bg: "#111827" };
  const assignedCount = students.filter((s) => assignedTo(s)).length;
  const name = fullName(v) || (isCoach ? "Unnamed coach" : "Unnamed admin");
  const classShort = v.classId ? (courseById(v.classId)?.short || v.classId) : null;

  // --- Collapsed: one compact scannable row.
  if (!expanded) {
    return (
      <Card ref={ref} className={`overflow-hidden transition ${flash ? "ring-2 ring-red-500" : ""}`}>
        <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50">
          <span className="text-gray-400 text-xs">▸</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0" style={{ background: badge.bg }}>{badge.label}</span>
          <span className="font-semibold text-gray-900 truncate">{name}</span>
          {classShort
            ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">{classShort}</span>
            : <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 shrink-0">no class</span>}
          <div className="flex-1" />
          {isCoach && classShort && <span className="text-[11px] text-gray-500 shrink-0">{assignedCount} student{assignedCount === 1 ? "" : "s"}</span>}
          {v.phone && <span className="hidden sm:inline text-[11px] text-gray-400 shrink-0">{v.phone}</span>}
        </button>
      </Card>
    );
  }

  // --- Expanded: full editor.
  return (
    <Card ref={ref} className={`p-4 space-y-3 transition ${flash ? "ring-2 ring-red-500" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onToggle} title="Collapse" className="text-gray-400 text-xs px-1">▾</button>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ background: badge.bg }}>{badge.label}</span>
        <EditableField value={v.firstName} placeholder="First name" className="w-40" onCommit={(val) => set({ firstName: val, name: `${val} ${v.lastName || ""}`.trim() })} />
        <EditableField value={v.lastName} placeholder="Last name" className="w-40" onCommit={(val) => set({ lastName: val, name: `${v.firstName || ""} ${val}`.trim() })} />
        <div className="flex-1" />
        <IconBtn danger title="Delete volunteer" onClick={onDelete}>🗑</IconBtn>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
        <label className="block">
          <span className="text-[11px] text-gray-500">Phone</span>
          <EditableField value={v.phone} placeholder="(000) 000-0000" className="w-full mt-0.5" onCommit={(val) => set({ phone: val })} />
        </label>
        <label className="block">
          <span className="text-[11px] text-gray-500">Email</span>
          <EditableField value={v.email} placeholder="name@email.com" className="w-full mt-0.5" onCommit={(val) => set({ email: val })} />
        </label>
        <label className="block">
          <span className="text-[11px] text-gray-500">Gender</span>
          <div className="mt-0.5"><Select value={v.gender || "Male"} options={GENDERS} onChange={(val) => set({ gender: val })} /></div>
        </label>
        <label className="block">
          <span className="text-[11px] text-gray-500">Table #</span>
          <EditableField value={v.tableNumber} placeholder="e.g. 4" className="w-full mt-0.5" onCommit={(val) => set({ tableNumber: val })} />
        </label>
        <label className="block">
          <span className="text-[11px] text-gray-500">Class {isCoach && <span className="text-gray-400">(who they coach)</span>}</span>
          <div className="mt-0.5">
            <Select value={v.classId || ""} options={["", ...COURSES.map((c) => c.id)]}
              onChange={(val) => set({ classId: val })} />
          </div>
        </label>
        {!isCoach && (
          <label className="block">
            <span className="text-[11px] text-gray-500">Role</span>
            <EditableField value={v.role} placeholder="e.g. Coordinator" className="w-full mt-0.5" onCommit={(val) => set({ role: val })} />
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Toggle on={v.trained} labelOn="Trained" labelOff="Not trained" onChange={(val) => set({ trained: val })} />
        {isCoach && <Toggle on={v.youthLeader} labelOn="Youth Leader" labelOff="Youth leader?" onChange={(val) => set({ youthLeader: val })} />}
        {isCoach && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-gray-500 mr-1">Confirmed to serve:</span>
            {COURSES.map((co) => (
              <button key={co.id} title={`${co.name} — confirmed to serve`}
                onClick={() => set({ confirmed: { ...v.confirmed, [co.id]: !v.confirmed?.[co.id] } })}
                className="w-8 h-7 rounded-md text-[11px] font-bold border transition"
                style={v.confirmed?.[co.id] ? { background: co.color, borderColor: co.color, color: "#fff" } : { background: "#f9fafb", borderColor: "#e5e7eb", color: "#5b6378" }}>
                {co.short.replace("HW", "")}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] text-gray-500 mb-1">
          {isCoach ? "Students assigned to this coach" : "Assigned students"} ({assignedCount})
          {v.classId ? ` of ${students.length} in ${courseById(v.classId)?.short || v.classId}` : ""}
        </div>
        {!v.classId ? (
          <p className="text-xs text-gray-400">Pick this {isCoach ? "coach" : "admin"}'s class above, then tap students to assign them.</p>
        ) : students.length === 0 ? (
          <p className="text-xs text-gray-400">No students signed up for {courseById(v.classId)?.name || v.classId} yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {students.map((s) => {
              const on = assignedTo(s);
              const other = !on && otherLabel ? otherLabel(s) : "";
              return (
                <button key={s.id} onClick={() => toggleStudent(s.id)}
                  title={on ? "Assigned here — tap to unassign" : other ? `Currently with ${other} — tap to move here` : "Tap to assign"}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition"
                  style={on ? { background: "#dc2626", borderColor: "#dc2626", color: "#fff" } : other ? { background: "#fff", borderColor: "#fca5a5", color: "#b91c1c" } : { background: "#fff", borderColor: "#e5e7eb", color: "#6b7280" }}>
                  {s.name || "Unnamed"}{other ? " ↗" : ""}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Volunteers({
  state, roundId = null, toast,
  upsertCoach, patchCoach, deleteCoach,
  upsertAdmin, patchAdmin, deleteAdmin,
  patchStudent,
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [openCards, setOpenCards] = useState({});
  const toggleCard = (id) => setOpenCards((o) => ({ ...o, [id]: !o[id] }));
  const expandAll = (on) => {
    const ids = [...(state.coaches || []), ...(state.admins || [])].map((v) => v.id);
    setOpenCards(on ? Object.fromEntries(ids.map((id) => [id, true])) : {});
  };

  const inRound = (v) => roundId == null || v.roundId === roundId || !v.roundId;
  const match = (v) => fullName(v).toLowerCase().includes(q.toLowerCase()) || (v.email || "").toLowerCase().includes(q.toLowerCase());
  // Newest first, so a freshly added card appears at the very top.
  const newestFirst = (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();

  const coaches = (state.coaches || []).filter((v) => inRound(v) && match(v)).slice().sort(newestFirst);
  const admins = (state.admins || []).filter((v) => inRound(v) && match(v)).slice().sort(newestFirst);
  const students = state.students || [];
  const studentsForClass = (cid) => cid ? students.filter((s) => { const p = (s.progress || {})[cid]; return p && p !== "not_started" && !s.dropped?.[cid]; }) : [];

  const [justAdded, setJustAdded] = useState(null);
  const flashNew = (id) => { setJustAdded(id); setTimeout(() => setJustAdded((x) => (x === id ? null : x)), 2500); };
  const addCoach = async () => { const c = makeCoach({ roundId }); await upsertCoach(c); setFilter("all"); setQ(""); setOpenCards((o) => ({ ...o, [c.id]: true })); flashNew(c.id); toast?.("Coach added at the top — fill in their details"); };
  const addAdmin = async () => { const a = makeAdmin({ roundId }); await upsertAdmin(a); setFilter("all"); setQ(""); setOpenCards((o) => ({ ...o, [a.id]: true })); flashNew(a.id); toast?.("Admin added at the top — fill in their details"); };

  const fileRef = useRef(null);
  const importCsv = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const { rows, skipped } = parseVolunteersCsv(String(e.target.result || ""));
        if (!rows.length) { toast?.("No volunteers found in that file", "danger"); return; }
        let coaches = 0, admins = 0;
        for (const r of rows) {
          const base = {
            firstName: r.firstName, lastName: r.lastName, name: r.name,
            phone: r.phone, email: r.email, gender: r.gender,
            tableNumber: r.tableNumber, classId: r.classId, roundId,
          };
          if (r.type === "admin") { await upsertAdmin(makeAdmin(base)); admins++; }
          else { await upsertCoach(makeCoach(base)); coaches++; }
        }
        toast?.(`Imported ${coaches} coach${coaches === 1 ? "" : "es"} + ${admins} admin${admins === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}`);
      } catch (err) { toast?.("Import failed: " + (err.message || err), "danger"); }
    };
    reader.readAsText(file);
  };

  const setCoach = (c) => (patch) => patchCoach(c.id, patch);
  const setAdmin = (a) => (patch) => patchAdmin(a.id, patch);
  const removeCoach = (c) => async () => {
    await deleteCoach(c.id);
    toast?.(`Removed ${fullName(c) || "coach"}`, { kind: "danger", action: { label: "Undo", onClick: () => upsertCoach(c) } });
  };
  const removeAdmin = (a) => async () => {
    await deleteAdmin(a.id);
    toast?.(`Removed ${fullName(a) || "admin"}`, { kind: "danger", action: { label: "Undo", onClick: () => upsertAdmin(a) } });
  };

  // Coaches: assignment IS the roster (assignments[class].coachId) — same source as the Roster tab.
  const coachAssignedTo = (coach) => (s) => (s.assignments?.[coach.classId]?.coachId || null) === coach.id;
  const coachOtherLabel = (coach) => (s) => {
    const id = s.assignments?.[coach.classId]?.coachId;
    if (!id || id === coach.id) return "";
    const oc = state.coaches.find((c) => c.id === id);
    return oc ? (fullName(oc) || "another coach") : "";
  };
  const assignToCoach = (coach) => (sid) => {
    const cid = coach.classId; if (!cid) return;
    const s = students.find((x) => x.id === sid); if (!s) return;
    const already = (s.assignments?.[cid]?.coachId || null) === coach.id;
    patchStudent(sid, { assignments: { ...s.assignments, [cid]: { ...(s.assignments?.[cid] || {}), coachId: already ? null : coach.id } } });
    if (!already) notifyCoach(coach.id, { title: "👤 New student assigned to you", body: s?.name || "A student", tag: "stu-" + sid });
  };

  // Admins keep a simple oversight list (studentIds).
  const adminAssignedTo = (a) => (s) => (a.studentIds || []).includes(s.id);
  const adminToggle = (a, set) => (sid) => {
    const cur = a.studentIds || [];
    set({ studentIds: cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid] });
  };

  const showCoaches = filter !== "admin";
  const showAdmins = filter !== "coach";
  const total = (showCoaches ? coaches.length : 0) + (showAdmins ? admins.length : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <TextInput value={q} onChange={setQ} placeholder="Search volunteers…" className="w-56" />
          <div className="flex gap-1">
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => setFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${filter === t.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>{t.label}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { if (e.target.files[0]) importCsv(e.target.files[0]); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 text-sm font-semibold">⬆ Import CSV</button>
          <button onClick={addCoach} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold">+ Add coach</button>
          <button onClick={addAdmin} className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-semibold">+ Add admin</button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Tap a row to expand and edit. New volunteers are added at the top. Assignments sync with the Roster tab.</p>
        {total > 0 && (
          <div className="flex gap-2 text-[11px] shrink-0">
            <button onClick={() => expandAll(true)} className="font-semibold text-gray-500 hover:underline">Expand all</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => expandAll(false)} className="font-semibold text-gray-500 hover:underline">Collapse all</button>
          </div>
        )}
      </div>

      {total === 0 ? (
        <Empty icon="🛡️" title="No volunteers yet" sub="Coaches and admins live here. Add them one at a time, or import a whole list from CSV." action={{ label: "Add your first coach", onClick: addCoach }} />
      ) : (
        <div className="space-y-2">
          {showCoaches && coaches.map((c) => (
            <VolunteerCard key={c.id} v={c} type="coach" students={studentsForClass(c.classId)}
              set={setCoach(c)} onDelete={removeCoach(c)}
              assignedTo={coachAssignedTo(c)} otherLabel={coachOtherLabel(c)} toggleStudent={assignToCoach(c)}
              flash={justAdded === c.id} expanded={!!openCards[c.id]} onToggle={() => toggleCard(c.id)} />
          ))}
          {showAdmins && admins.map((a) => (
            <VolunteerCard key={a.id} v={a} type="admin" students={studentsForClass(a.classId)}
              set={setAdmin(a)} onDelete={removeAdmin(a)}
              assignedTo={adminAssignedTo(a)} otherLabel={null} toggleStudent={adminToggle(a, setAdmin(a))}
              flash={justAdded === a.id} expanded={!!openCards[a.id]} onToggle={() => toggleCard(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
