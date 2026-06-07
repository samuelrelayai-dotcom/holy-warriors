// ---------------------------------------------------------------------------
// Derived/aggregate calculations — pure functions over state. Heavily tested.
// ---------------------------------------------------------------------------
import { COURSE_IDS, WEEKS, ATTENDANCE } from "./courses.js";

export const lowStockCourses = (state) =>
  COURSE_IDS
    .map((c) => ({ course: c, ...state.inventory[c] }))
    .filter((i) => i.count <= i.threshold);

export const enrolledIn = (state, course) =>
  state.students.filter((s) => s.progress[course] !== "not_started");

export const presentCount = (student, course) =>
  WEEKS.filter((w) => ATTENDANCE[student.attendance[course][w.key]].present).length;

export const baptizedStudents = (state) =>
  state.students.filter((s) => s.baptism.baptized);

export const certsOutstanding = (state) =>
  baptizedStudents(state).filter(
    (s) => !s.baptism.certMade || !s.baptism.certReceived
  ).length;

export const completedAll = (state) =>
  state.students.filter((s) => COURSE_IDS.every((c) => s.progress[c] === "completed")).length;

export function courseStats(state, course) {
  const active = state.students.filter((s) => s.progress[course] !== "not_started").length;
  const done = state.students.filter((s) => s.progress[course] === "completed").length;
  return { active, done, total: state.students.length };
}

export function dashboardSummary(state) {
  return {
    coaches: state.coaches.length,
    students: state.students.length,
    baptized: baptizedStudents(state).length,
    certsOutstanding: certsOutstanding(state),
    completedAll: completedAll(state),
    lowStock: lowStockCourses(state),
  };
}

// --- Roster / assignments / drop-outs ---
export const coachName = (state, coachId) =>
  state.coaches.find((c) => c.id === coachId)?.name || "";

export const rosterFor = (state, course) =>
  enrolledIn(state, course).map((s) => ({
    student: s,
    coachId: s.assignments[course]?.coachId ?? null,
    table: s.assignments[course]?.table ?? "",
    dropped: !!s.dropped[course],
  }));

export const droppedFor = (state, course) =>
  rosterFor(state, course).filter((r) => r.dropped);

export const activeRosterFor = (state, course) =>
  rosterFor(state, course).filter((r) => !r.dropped);

export const unassignedFor = (state, course) =>
  activeRosterFor(state, course).filter((r) => !r.coachId);

export function droppedTotal(state) {
  let n = 0;
  state.students.forEach((s) => COURSE_IDS.forEach((c) => { if (s.dropped[c]) n++; }));
  return n;
}

// --- Rounds, outcomes, goals, retention, training ---
export const studentsInRound = (students, roundId) =>
  roundId == null ? students : students.filter((s) => s.roundId === roundId);

export const activeRound = (state) =>
  state.rounds.find((r) => r.active) || null;

export function retentionFor(state, course) {
  const enrolled = enrolledIn(state, course);
  const active = enrolled.filter((s) => !s.dropped[course]);
  const rate = enrolled.length ? active.length / enrolled.length : 0;
  return { enrolled: enrolled.length, active: active.length, dropped: enrolled.length - active.length, rate };
}

export const graduatedStudents = (state) =>
  state.students.filter((s) => s.outcomes?.graduated);

export function outcomeCounts(state) {
  const c = { graduated: 0, godEncounter: 0, servingMinistry: 0, connected: 0, inDg: 0, leadingDg: 0 };
  state.students.forEach((s) => {
    const o = s.outcomes || {};
    if (o.graduated) c.graduated++;
    if (o.godEncounter) c.godEncounter++;
    if (o.servingMinistry) c.servingMinistry++;
    if (o.connected) c.connected++;
    if (o.inDg) c.inDg++;
    if (o.launchedDg) c.leadingDg++;
  });
  return c;
}

export function goalProgress(state, round, course) {
  const goal = round?.goals?.[course] || { students: 0, coaches: 0, admins: 0 };
  const students = enrolledIn(state, course).length;
  const coaches = state.coaches.filter((c) => c.confirmed?.[course]).length;
  const admins = state.admins.length;
  const pct = (actual, target) => (target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0);
  return {
    students: { actual: students, target: goal.students, pct: pct(students, goal.students) },
    coaches: { actual: coaches, target: goal.coaches, pct: pct(coaches, goal.coaches) },
    admins: { actual: admins, target: goal.admins, pct: pct(admins, goal.admins) },
  };
}

export const trainingProgress = (person, steps) => {
  const total = steps.length;
  const done = steps.filter((st) => person.training?.[st.id]).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
};

// --- Tasks & goals ---
export const tasksForUser = (state, role, userId) =>
  (state.tasks || []).filter((t) =>
    t.assigneeType === "role" ? t.assigneeRole === role : t.assigneeUserId === userId
  );
export const openTasksForUser = (state, role, userId) =>
  tasksForUser(state, role, userId).filter((t) => t.status !== "done");
export const completedTasks = (state) =>
  (state.tasks || []).filter((t) => t.status === "done")
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

// --- Attendance reporting (students / coaches / admins) ---
const CORE = WEEKS.filter((w) => w.key !== "makeup");

export function attendanceStats(people, course) {
  const perWeek = {};
  WEEKS.forEach((w) => (perWeek[w.key] = 0));
  let present = 0;
  people.forEach((p) => {
    WEEKS.forEach((w) => {
      const st = p.attendance?.[course]?.[w.key] || "";
      if (ATTENDANCE[st]?.present) { perWeek[w.key]++; if (w.key !== "makeup") present++; }
    });
  });
  const possible = people.length * CORE.length;
  return { count: people.length, present, possible, rate: possible ? present / possible : 0, perWeek };
}

export function classGroups(state, course) {
  return {
    students: enrolledIn(state, course),
    coaches: state.coaches || [],
    admins: state.admins || [],
  };
}

// --- Per-coach scoping (Class Leaders see only their own class) ---
export const studentsForCoach = (students, coachId) =>
  coachId ? (students || []).filter((s) => COURSE_IDS.some((c) => s.assignments?.[c]?.coachId === coachId)) : [];

// Coaches who serve a given class: either set as their class, or confirmed for it.
export const coachesForCourse = (state, course) =>
  (state.coaches || []).filter((c) => c.classId === course || c.confirmed?.[course]);

// Active (non-dropped), enrolled students in a course assigned to a specific coach.
export const studentsForCoachInCourse = (state, course, coachId) =>
  enrolledIn(state, course).filter((s) => !s.dropped?.[course] && s.assignments?.[course]?.coachId === coachId);


// Weekly attendance rate across all enrolled students in all courses (for the trend chart).
export function weeklyAttendanceTrend(state) {
  return WEEKS.map(({ key, label }) => {
    let present = 0, possible = 0;
    for (const c of COURSE_IDS) {
      for (const p of enrolledIn(state, c)) {
        possible++;
        if (ATTENDANCE[p.attendance?.[c]?.[key] || ""]?.present) present++;
      }
    }
    return { key, label, present, possible, rate: possible ? present / possible : 0 };
  });
}
