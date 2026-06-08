import { useRef, useState, useMemo, useEffect } from "react";
import { useAuth } from "./auth/AuthProvider.jsx";
import { useData } from "./hooks/useData.js";
import { useToast } from "./components/Toasts.jsx";
import Onboarding, { hasOnboarded } from "./components/Onboarding.jsx";
import Account from "./components/Account.jsx";
import CompleteProfile from "./components/CompleteProfile.jsx";
import BrandLogo from "./components/BrandLogo.jsx";
import { usePresence } from "./hooks/usePresence.js";
import { logActivity, subscribeActivity } from "./data/activity.js";
import { showNotify, requestNotify, notifyPermission } from "./data/notify.js";
import { subscribePush, sendPush } from "./data/pushClient.js";
import { firstName } from "./domain/models.js";
import RoundPicker from "./components/RoundPicker.jsx";
import { useIsMobile } from "./hooks/useIsMobile.js";
import CommandPalette from "./components/CommandPalette.jsx";
import Skeleton from "./components/Skeleton.jsx";
import Mary from "./components/Mary.jsx";
import Avatar from "./components/Avatar.jsx";
import { roleLabel, visibleTabs, can } from "./domain/roles.js";
import { studentsInRound, completedTasks, studentsForCoach, tasksForUser } from "./domain/selectors.js";
import { CAMPUSES } from "./domain/courses.js";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Volunteers from "./pages/Volunteers.jsx";
import Journey from "./pages/Journey.jsx";
import Attendance from "./pages/Attendance.jsx";
import Roster from "./pages/Roster.jsx";
import Inventory from "./pages/Inventory.jsx";
import Rounds from "./pages/Rounds.jsx";
import Training from "./pages/Training.jsx";
import Director from "./pages/Director.jsx";
import Tasks from "./pages/Tasks.jsx";
import Reports from "./pages/Reports.jsx";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "🏠" },
  { id: "tasks", label: "Tasks", icon: "✅" },
  { id: "volunteers", label: "Volunteers", icon: "🛡️" },
  { id: "journey", label: "Student Journey", icon: "🧭" },
  { id: "attendance", label: "Attendance", icon: "🗓️" },
  { id: "roster", label: "Roster", icon: "📋" },
  { id: "reports", label: "Reports", icon: "📊" },
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "training", label: "Training", icon: "🧑‍🏫" },
  { id: "director", label: "Director", icon: "🛡️" },
];

export default function App() {
  const { user, loading, signOut, cloud, role, profile } = useAuth();
  const [onboarded, setOnboarded] = useState(hasOnboarded());
  if (loading) return <Splash />;
  if (!user) return <Login />;
  if (!onboarded) return <Onboarding onDone={() => setOnboarded(true)} />;
  if (cloud && profile && !(profile.full_name || "").trim()) return <CompleteProfile />;
  return <Authed signOut={signOut} cloud={cloud} role={role} profile={profile} onReplay={() => setOnboarded(false)} />;
}
function Splash() { return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>; }

function Authed({ signOut, cloud, role, profile, onReplay }) {
  const logFn = (action) => logActivity(firstName(profile?.full_name || profile?.email), action);
  const data = useData(logFn);
  const toast = useToast();
  const fileRef = useRef(null);
  const [showAccount, setShowAccount] = useState(false);
  const [showRounds, setShowRounds] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showCmd, setShowCmd] = useState(false);
  const isMobile = useIsMobile();
  const [campus, setCampusState] = useState(() => localStorage.getItem("hw_campus") || "");
  const setCampus = (c) => { setCampusState(c); if (c) localStorage.setItem("hw_campus", c); else localStorage.removeItem("hw_campus"); setCurrentRound(null); };
  const [currentRoundId, setCurrentRoundId] = useState(() => localStorage.getItem("hw_current_round") || null);
  const setCurrentRound = (id) => { setCurrentRoundId(id); if (id) localStorage.setItem("hw_current_round", id); else localStorage.removeItem("hw_current_round"); };

  const campusRounds = useMemo(
    () => (campus ? data.state.rounds.filter((r) => (r.campus || "") === campus || !r.campus) : data.state.rounds),
    [data.state.rounds, campus]
  );

  // default to active round once data loads
  const canManageRounds = can(role, "manageRoundsTraining");
  useEffect(() => {
    if (canManageRounds && !currentRoundId && campusRounds.length) {
      const act = campusRounds.find((r) => r.active) || campusRounds[0];
      if (act) setCurrentRound(act.id);
    }
    if (currentRoundId && data.state.rounds.length && !data.state.rounds.some((r) => r.id === currentRoundId)) setCurrentRound(null);
    // eslint-disable-next-line
  }, [data.state.rounds, canManageRounds, campus]);

  const tabs = useMemo(() => {
    const ids = visibleTabs(role, TABS.map((t) => t.id));
    return TABS.filter((t) => ids.includes(t.id));
  }, [role]);
  const [tab, setTab] = useState(tabs[0]?.id || "dashboard");
  const activeTabId = tabs.find((t) => t.id === tab) ? tab : tabs[0]?.id;
  const online = usePresence(profile, activeTabId);

  const currentRound = data.state.rounds.find((r) => r.id === currentRoundId) || null;
  const roundState = useMemo(
    () => ({ ...data.state, students: studentsInRound(data.state.students, currentRoundId) }),
    [data.state, currentRoundId]
  );
  // Class Leaders only see their own coach's students
  const scoped = useMemo(() => {
    if (role === "class_leader") return { ...roundState, students: studentsForCoach(roundState.students, profile?.coach_id) };
    return roundState;
  }, [roundState, role, profile?.coach_id]);

  // ---- Director notifications for completed tasks (hooks must precede any early return) ----
  const isDirector = can(role, "manageUsers");
  const [showNotif, setShowNotif] = useState(false);
  const prevDoneIds = useRef(null);
  const done = completedTasks(data.state);
  useEffect(() => {
    const ids = new Set(done.map((t) => t.id));
    if (prevDoneIds.current && isDirector) {
      done.forEach((t) => { if (!prevDoneIds.current.has(t.id)) { toast(`✅ ${t.completedBy || "Someone"} completed: ${t.title}`); showNotify(`✅ ${t.completedBy || "Someone"} completed a ${t.kind}`, t.title, { tag: "done-" + t.id }); sendPush({ toRole: "director", title: `✅ ${t.completedBy || "Someone"} completed a ${t.kind}`, body: t.title, tag: "done-" + t.id }); } });
    }
    prevDoneIds.current = ids;
    // eslint-disable-next-line
  }, [data.state.tasks]);
  const seenKey = `hw_notif_seen_${profile?.id || "x"}`;
  const lastSeen = Number(localStorage.getItem(seenKey) || 0);
  const unseen = done.filter((t) => (t.completedAt || 0) > lastSeen);
  const openNotif = () => { setShowNotif((v) => !v); localStorage.setItem(seenKey, String(Date.now())); };

  // ---- Command palette (⌘K) ----
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); setShowCmd((v) => !v); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---- Browser notifications ----
  const [notifPerm, setNotifPerm] = useState(notifyPermission());
  const enableNotify = async () => { const p = await requestNotify(); setNotifPerm(p); if (p === "granted") subscribePush(profile); };

  // Subscribe this device if permission is already granted (e.g. returning user).
  useEffect(() => { if (notifyPermission() === "granted") subscribePush(profile); }, [profile?.id]);

  // Director: live alert when anyone edits / makes progress (who + what).
  useEffect(() => {
    if (!isDirector) return;
    const myName = firstName(profile?.full_name || profile?.email);
    const started = Date.now();
    const off = subscribeActivity((row) => {
      if (!row || row.at < started - 1000) return;       // ignore backfill
      if ((row.name || "") === myName) return;            // skip my own actions
      showNotify(`${row.name || "Someone"} ${row.action}`, "Tap to open Holy Warriors", { tag: "act-" + row.id });
    });
    return off;
    // eslint-disable-next-line
  }, [isDirector, profile?.id]);

  // Assignee: alert when a new task/goal is assigned to me.
  const myTasks = tasksForUser(data.state, role, profile?.id);
  const prevMyTaskIds = useRef(null);
  useEffect(() => {
    const ids = new Set(myTasks.map((t) => t.id));
    if (prevMyTaskIds.current) {
      myTasks.forEach((t) => {
        if (!prevMyTaskIds.current.has(t.id) && t.status !== "done") {
          toast(`📋 New ${t.kind} for you: ${t.title}`);
          showNotify(`📋 You've been assigned a ${t.kind}`, t.title, { tag: "assign-" + t.id });
        }
      });
    }
    prevMyTaskIds.current = ids;
    // eslint-disable-next-line
  }, [data.state.tasks]);

  // Non-manager roles pick a round before the app opens.
  if (!canManageRounds && !currentRoundId) {
    return <RoundPicker rounds={data.state.rounds} onPick={setCurrentRound} campus={campus} setCampus={setCampus} />;
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data.state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `holy-warriors-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url); toast("Backup downloaded");
  };
  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || (!("students" in parsed) && !("coaches" in parsed))) throw new Error("Not a valid backup");
        await data.replaceAll(parsed); toast("Backup restored");
      } catch (err) { toast("Import failed: " + err.message, "danger"); }
    };
    reader.readAsText(file);
  };

  const canManageData = can(role, "editData");
  const pages = {
    dashboard: <Dashboard state={scoped} goto={setTab} round={currentRound} role={role} campus={campus} onOpenRounds={() => setShowRounds(true)} />,
    volunteers: <Volunteers {...data} state={roundState} roundId={currentRoundId} toast={toast} />,
    journey: <Journey {...data} state={roundState} roundId={currentRoundId} toast={toast} />,
    attendance: <Attendance {...data} state={scoped} toast={toast} />,
    roster: <Roster {...data} state={scoped} roundId={currentRoundId} readOnly={!canManageData} toast={toast} />,
    inventory: <Inventory {...data} state={roundState} toast={toast} />,
    training: <Training {...data} canEditSteps={can(role, "manageRoundsTraining")} />,
    reports: <Reports state={roundState} />,
    tasks: <Tasks {...data} toast={toast} />,
    director: <Director online={online} toast={toast} coaches={data.state.coaches} settings={data.state.settings} upsertSettings={data.upsertSettings} />,
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 overflow-x-hidden">
      {showAccount && <Account onClose={() => setShowAccount(false)} toast={toast} />}
      <CommandPalette open={showCmd} onClose={() => setShowCmd(false)} tabs={tabs} state={roundState} onTab={setTab} />
      <Mary page={activeTabId} profile={profile} toast={toast} />
      {showRounds && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => setShowRounds(false)}>
          <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-4xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 sticky top-0 bg-gray-50 rounded-t-2xl">
              <h2 className="font-bold text-gray-900">Rounds</h2>
              <button onClick={() => setShowRounds(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200">Close ✕</button>
            </div>
            <div className="p-5">
              <Rounds {...data} currentRoundId={currentRoundId} setCurrentRound={(id) => { setCurrentRound(id); }} toast={toast} campus={campus} />
            </div>
          </div>
        </div>
      )}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 py-3 flex items-center justify-between gap-2 flex-wrap">
          <BrandLogo size="md" />
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {online.length > 0 && (
              <div className="hidden sm:flex items-center -space-x-2 mr-1" title={online.map((u) => u.name).join(", ")}>
                {online.slice(0, 5).map((u) => (
                  <div key={u.id} className="ring-2 ring-white rounded-full"><Avatar url={u.avatar} name={u.name} email={u.name} size={24} /></div>
                ))}
                {online.length > 5 && <span className="text-[11px] text-gray-500 pl-3">+{online.length - 5}</span>}
              </div>
            )}
            <button onClick={() => setShowCmd(true)} title="Search (⌘K)" aria-label="Search" className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200">🔍 <span className="hidden sm:inline">Search</span></button>
            <select value={campus} onChange={(e) => setCampus(e.target.value)}
              aria-label="Select campus" title="Campus" className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-700 max-w-[160px]">
              <option value="">All campuses</option>
              {CAMPUSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={currentRoundId || ""} onChange={(e) => setCurrentRound(e.target.value || null)}
              aria-label="Select round" title="Current round" className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-700 max-w-[150px]">
              <option value="">All rounds</option>
              {campusRounds.map((r) => <option key={r.id} value={r.id}>{r.name || "Untitled"}{r.active ? " ●" : ""}</option>)}
            </select>
            {canManageRounds && (
              <button onClick={() => setShowRounds(true)} title="Manage rounds" className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200">🗂️ Rounds</button>
            )}
            {notifPerm !== "granted" && notifPerm !== "unsupported" && (
              <button onClick={enableNotify} title="Turn on browser notifications" aria-label="Enable notifications" className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700">🔔 Enable alerts</button>
            )}
            <button onClick={onReplay} title="Replay tour" className="hidden sm:inline px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200">? Tour</button>
            {canManageData && <>
              <button onClick={() => fileRef.current?.click()} className="hidden md:inline px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200">↑ Import</button>
              <button onClick={exportData} className="hidden md:inline px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200">↓ Backup</button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; }} />
            </>}
            {isDirector && (
              <div className="relative">
                <button onClick={openNotif} aria-label="Notifications" title="Notifications" className="relative px-2.5 py-1.5 rounded-lg text-sm bg-gray-100 border border-gray-200 hover:bg-gray-200">
                  🔔{unseen.length > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">{unseen.length}</span>}
                </button>
                {showNotif && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500">Completed tasks & goals</div>
                    <div className="max-h-72 overflow-y-auto">
                      {done.length === 0 ? <div className="px-3 py-4 text-sm text-gray-400 text-center">No completions yet</div> :
                        done.slice(0, 20).map((t) => (
                          <div key={t.id} className="px-3 py-2 border-b border-gray-50 text-sm">
                            <span className="text-gray-800 font-medium">{t.completedBy || "Someone"}</span>
                            <span className="text-gray-500"> completed </span>
                            <span className="text-gray-800">"{t.title}"</span>
                            <div className="text-[11px] text-gray-400">{t.completedAt ? new Date(t.completedAt).toLocaleString() : ""}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button onClick={() => setShowAccount(true)} className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 hover:bg-gray-200">
              <Avatar url={profile?.avatar_url} name={profile?.full_name} email={profile?.email} size={26} />
              <span className="text-xs font-semibold text-gray-700 max-w-[110px] truncate">{profile?.full_name || profile?.email}</span>
            </button>
            <button onClick={signOut} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200">Sign out</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-3 sm:px-5 pb-2">
          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">{roleLabel(role)}</span>
        </div>
        {!isMobile && (
          <nav className="max-w-7xl mx-auto px-2 sm:px-3 flex flex-wrap gap-x-1 gap-y-0.5 pb-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${activeTabId === t.id ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
                <span className="mr-1.5">{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
        )}
      </header>
      <main className={`max-w-7xl mx-auto px-3 sm:px-5 py-6 fade-in ${isMobile ? "pb-28" : ""}`}>
        {data.error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{data.error}</div>}
        {data.loading && cloud ? <Skeleton /> : pages[activeTabId]}
      </main>
      <footer className="max-w-7xl mx-auto px-5 py-6 text-center text-xs text-gray-400">
        {cloud ? "Synced live to your church's secure database — every admin sees the same data." : "Demo mode: data is on this device."}
      </footer>

      {isMobile && (() => {
        const primary = tabs.slice(0, 4);
        const overflow = tabs.slice(4);
        const activeInMore = overflow.some((t) => t.id === activeTabId);
        return (
          <>
            <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex justify-around items-stretch pb-[env(safe-area-inset-bottom)]">
              {primary.map((t) => (
                <button key={t.id} onClick={() => { setShowMore(false); setTab(t.id); }}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-semibold ${activeTabId === t.id ? "text-red-600" : "text-gray-500"}`}>
                  <span className="text-lg leading-none">{t.icon}</span>
                  <span className="truncate max-w-[70px]">{t.label}</span>
                </button>
              ))}
              {overflow.length > 0 && (
                <button onClick={() => setShowMore((v) => !v)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-semibold ${activeInMore || showMore ? "text-red-600" : "text-gray-500"}`}>
                  <span className="text-lg leading-none">⋯</span>
                  <span>More</span>
                </button>
              )}
            </nav>
            {showMore && (
              <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowMore(false)}>
                <div className="absolute bottom-[64px] inset-x-0 bg-white rounded-t-2xl shadow-2xl p-3" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-3 gap-2">
                    {overflow.map((t) => (
                      <button key={t.id} onClick={() => { setTab(t.id); setShowMore(false); }}
                        className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border ${activeTabId === t.id ? "border-red-300 bg-red-50 text-red-600" : "border-gray-200 text-gray-600"}`}>
                        <span className="text-xl leading-none">{t.icon}</span>
                        <span className="text-[12px] font-semibold text-center leading-tight">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
