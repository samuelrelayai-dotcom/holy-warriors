import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import App from "../App.jsx";
import { AuthProvider } from "../auth/AuthProvider.jsx";
import { ToastProvider } from "../components/Toasts.jsx";

const renderApp = () =>
  render(<AuthProvider><ToastProvider><App /></ToastProvider></AuthProvider>);

async function signIn() {
  const email = await screen.findByPlaceholderText(/you@church.org/i);
  fireEvent.change(email, { target: { value: "sam@church.org" } });
  fireEvent.click(screen.getAllByRole("button", { name: /^Sign in$/i }).at(-1));
  await screen.findByText(/Readiness checklist/i);
}
const tab = (name) => fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));

beforeEach(() => { localStorage.clear(); localStorage.setItem("hw_onboarded_v1", "1"); });

describe("AUTH", () => {
  it("login screen → sign in → sign out", async () => {
    renderApp();
    expect(await screen.findByText(/Discipleship Team Tracker/i)).toBeInTheDocument();
    await signIn();
    expect(screen.getByText(/Readiness checklist/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sign out/i }));
    expect(await screen.findByText(/Discipleship Team Tracker/i)).toBeInTheDocument();
  });

  it("can switch to Create account tab", async () => {
    renderApp();
    await screen.findByPlaceholderText(/you@church.org/i);
    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));
    expect(screen.getAllByRole("button", { name: /Create account/i }).length).toBeGreaterThan(0);
  });
});

describe("NAVIGATION", () => {
  it("every tab renders", async () => {
    renderApp(); await signIn();
    for (const t of ["Volunteers", "Student Journey", "Attendance", "Inventory", "Dashboard"]) {
      tab(t);
      await waitFor(() => expect(screen.getByRole("button", { name: new RegExp(t) })).toBeInTheDocument());
    }
  });
});

describe("VOLUNTEERS", () => {
  it("coach: add, first/last name, gender, trained, confirm-to-serve chip, search, delete", async () => {
    renderApp(); await signIn(); tab("Volunteers");
    fireEvent.click(await screen.findByRole("button", { name: /Add coach/i }));
    fireEvent.change(await screen.findByPlaceholderText(/First name/i), { target: { value: "Maria" } });
    fireEvent.change(screen.getByPlaceholderText(/Last name/i), { target: { value: "Lopez" } });
    await waitFor(() => expect(screen.getByDisplayValue("Maria")).toBeInTheDocument());

    // gender select
    const genderSel = () => screen.getAllByRole("combobox").find((el) => Array.from(el.options).some((o) => o.value === "Female"));
    fireEvent.change(genderSel(), { target: { value: "Female" } });
    await waitFor(() => expect(genderSel().value).toBe("Female"));

    // trained toggle
    fireEvent.click(screen.getByRole("button", { name: /Not trained/i }));
    expect(await screen.findByRole("button", { name: /✓ Trained/i })).toBeInTheDocument();

    // confirm-to-serve chip for HW1
    fireEvent.click(screen.getByTitle(/Holy Warriors 1 — confirmed to serve/i));

    // search filter (matches first/last name)
    const search = screen.getByPlaceholderText(/Search volunteers/i);
    fireEvent.change(search, { target: { value: "zzz" } });
    await waitFor(() => expect(screen.queryByDisplayValue("Maria")).not.toBeInTheDocument());
    fireEvent.change(search, { target: { value: "lopez" } });
    expect(await screen.findByDisplayValue("Maria")).toBeInTheDocument();

    // delete
    fireEvent.click(screen.getByTitle(/Delete volunteer/i));
    await waitFor(() => expect(screen.queryByDisplayValue("Maria")).not.toBeInTheDocument());
  });

  it("admin: add, name + role, trained, delete", async () => {
    renderApp(); await signIn(); tab("Volunteers");
    fireEvent.click(await screen.findByRole("button", { name: /Add admin/i }));
    fireEvent.change(await screen.findByPlaceholderText(/First name/i), { target: { value: "Pastor" } });
    fireEvent.change(screen.getByPlaceholderText(/Last name/i), { target: { value: "John" } });
    fireEvent.change(screen.getByPlaceholderText(/Coordinator/i), { target: { value: "Coordinator" } });
    await screen.findByDisplayValue("Coordinator");
    fireEvent.click(screen.getByRole("button", { name: /Not trained/i }));
    expect(await screen.findByRole("button", { name: /✓ Trained/i })).toBeInTheDocument();
    fireEvent.click(screen.getByTitle(/Delete volunteer/i));
    await waitFor(() => expect(screen.queryByDisplayValue("Pastor")).not.toBeInTheDocument());
  });

  it("assigns a class student to a coach (filtered by the coach's class)", async () => {
    renderApp(); await signIn();
    // create a student enrolled in HW1
    tab("Student Journey");
    fireEvent.click(await screen.findByRole("button", { name: /Add student/i }));
    fireEvent.change(await screen.findByPlaceholderText(/Student name/i), { target: { value: "Joy" } });
    await screen.findByDisplayValue("Joy");
    fireEvent.blur(screen.getByDisplayValue("Joy"));
    fireEvent.click(screen.getByTitle(/Holy Warriors 1:/i)); // enroll Joy in HW1
    // add a coach, set their class to HW1, then Joy should appear to assign
    tab("Volunteers");
    fireEvent.click(await screen.findByRole("button", { name: /Add coach/i }));
    await screen.findByPlaceholderText(/First name/i);
    const classSel = screen.getAllByRole("combobox").find((el) => Array.from(el.options).some((o) => o.value === "HW1"));
    fireEvent.change(classSel, { target: { value: "HW1" } });
    fireEvent.click(await screen.findByRole("button", { name: /^Joy$/ }));
    expect(await screen.findByText(/assigned to this coach \(1\)/i)).toBeInTheDocument();
  });
});

describe("STUDENT JOURNEY", () => {
  it("add student, advance progress through stages, delete", async () => {
    renderApp(); await signIn(); tab("Student Journey");
    fireEvent.click(await screen.findByRole("button", { name: /Add student/i }));
    const name = await screen.findByPlaceholderText(/Student name/i);
    fireEvent.change(name, { target: { value: "Andre Kim" } });

    // HW1 starts "Not started"; advance to In progress then Completed
    const hw1 = screen.getByTitle(/Holy Warriors 1:/i);
    expect(hw1.getAttribute("title")).toMatch(/Not started/i);
    fireEvent.click(hw1);
    await waitFor(() => expect(screen.getByTitle(/Holy Warriors 1:/i).getAttribute("title")).toMatch(/In progress/i));
    fireEvent.click(screen.getByTitle(/Holy Warriors 1:/i));
    await waitFor(() => expect(screen.getByTitle(/Holy Warriors 1:/i).getAttribute("title")).toMatch(/Completed/i));

    fireEvent.click(screen.getByTitle(/Delete student/i));
    await waitFor(() => expect(screen.queryByDisplayValue("Andre Kim")).not.toBeInTheDocument());
  });
});

describe("ATTENDANCE", () => {
  it("enrolled student shows; cycle attendance; confirm; present count; course tabs", async () => {
    renderApp(); await signIn();
    // create + enroll a student in HW1
    tab("Student Journey");
    fireEvent.click(await screen.findByRole("button", { name: /Add student/i }));
    fireEvent.change(await screen.findByPlaceholderText(/Student name/i), { target: { value: "Lena" } });
    await screen.findByDisplayValue("Lena");
    fireEvent.blur(screen.getByDisplayValue("Lena"));
    fireEvent.click(screen.getByTitle(/Holy Warriors 1:/i)); // -> in_progress
    await waitFor(() => expect(screen.getByTitle(/Holy Warriors 1:/i).getAttribute("title")).toMatch(/In progress/i));

    tab("Attendance");
    expect(await screen.findByText("Lena")).toBeInTheDocument();

    // cycle week 1: — -> In Person
    const w1 = screen.getByTitle(/Week 1:/i);
    expect(w1.getAttribute("title")).toMatch(/—|In Person|Zoom|Absent/);
    fireEvent.click(w1);
    await waitFor(() => expect(screen.getByTitle(/Week 1:/i).getAttribute("title")).toMatch(/In Person/i));

    // confirm-to-serve toggle
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    expect(await screen.findByRole("button", { name: /Confirmed/i })).toBeInTheDocument();

    // present count reflects 1
    expect(screen.getByText("1/5")).toBeInTheDocument();

    // switch course tab to HW2 (Lena not enrolled -> empty state)
    fireEvent.click(screen.getByRole("button", { name: /Holy Warriors 2/i }));
    expect(await screen.findByText(/No students to track here/i)).toBeInTheDocument();
  });
});

describe("BAPTISMS (HW1)", () => {
  it("HW1 student appears; toggles update counts", async () => {
    renderApp(); await signIn();
    tab("Student Journey");
    fireEvent.click(await screen.findByRole("button", { name: /Add student/i }));
    fireEvent.change(await screen.findByPlaceholderText(/Student name/i), { target: { value: "Grace" } });
    await screen.findByDisplayValue("Grace");
    fireEvent.blur(screen.getByDisplayValue("Grace"));
    fireEvent.click(screen.getByTitle(/Holy Warriors 1:/i)); // enroll HW1
    await waitFor(() => expect(screen.getByTitle(/Holy Warriors 1:/i).getAttribute("title")).toMatch(/In progress/i));
    // baptized milestone now lives in the journey pipeline
    fireEvent.click(screen.getByTitle(/^Baptized:/i));
    await waitFor(() => expect(screen.getByTitle(/^Baptized:/i).getAttribute("title")).toMatch(/done/i));
  });
});

describe("INVENTORY", () => {
  it("increment/decrement, threshold edit, low-stock alert pill", async () => {
    renderApp(); await signIn(); tab("Inventory");
    fireEvent.click(await screen.findByRole("button", { name: /Book stock/i })); // expand stock section
    // HW1 card: starts count 0, threshold 10 -> low stock pill present
    expect((await screen.findAllByText(/Buy more books/i)).length).toBeGreaterThan(0);

    // increment HW1 count via the first "+" button
    const plus = screen.getAllByRole("button", { name: "+" })[0];
    fireEvent.click(plus);
    const numberInputs = screen.getAllByRole("spinbutton");
    await waitFor(() => expect(Number(numberInputs[0].value)).toBeGreaterThanOrEqual(1));

    // set threshold to 0 to clear the alert on HW1 (threshold input is 2nd spinbutton in card group)
    // raise count above threshold: set count to 50
    fireEvent.change(numberInputs[0], { target: { value: "50" } });
    await waitFor(() => expect(Number(numberInputs[0].value)).toBe(50));

    // decrement
    const minus = screen.getAllByRole("button", { name: "−" })[0];
    fireEvent.click(minus);
    await waitFor(() => expect(Number(screen.getAllByRole("spinbutton")[0].value)).toBe(49));
  });
});

describe("BACKUP / IMPORT", () => {
  it("backup button triggers a download", async () => {
    renderApp(); await signIn();
    const createUrl = vi.fn(() => "blob:x");
    global.URL.createObjectURL = createUrl;
    global.URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: /Backup/i }));
    expect(createUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});

describe("ONBOARDING", () => {
  it("shows slides on first use and 'Get started' enters the app", async () => {
    localStorage.removeItem("hw_onboarded_v1"); // simulate first-time user
    renderApp();
    await screen.findByPlaceholderText(/you@church.org/i);
    fireEvent.change(screen.getByPlaceholderText(/you@church.org/i), { target: { value: "new@church.org" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Sign in$/i }).at(-1));
    // onboarding appears (not the dashboard yet)
    expect(await screen.findByText(/Welcome to Holy Warriors/i)).toBeInTheDocument();
    // click Next through all slides until Get started
    for (let k = 0; k < 4; k++) fireEvent.click(screen.getByRole("button", { name: /^Next$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Get started/i }));
    expect(await screen.findByText(/Readiness checklist/i)).toBeInTheDocument();
    expect(localStorage.getItem("hw_onboarded_v1")).toBe("1");
  });

  it("Skip enters the app immediately", async () => {
    localStorage.removeItem("hw_onboarded_v1");
    renderApp();
    await screen.findByPlaceholderText(/you@church.org/i);
    fireEvent.change(screen.getByPlaceholderText(/you@church.org/i), { target: { value: "skip@church.org" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Sign in$/i }).at(-1));
    fireEvent.click(await screen.findByRole("button", { name: /^Skip$/i }));
    expect(await screen.findByText(/Readiness checklist/i)).toBeInTheDocument();
  });
});

describe("ROSTER", () => {
  it("assign coach + table, reassign, unassign, mark dropped and re-activate", async () => {
    renderApp(); await signIn();
    // add a coach
    tab("Volunteers");
    fireEvent.click(await screen.findByRole("button", { name: /Add coach/i }));
    fireEvent.change(await screen.findByPlaceholderText(/First name/i), { target: { value: "Coach Rivera" } });
    await screen.findByDisplayValue("Coach Rivera");
    fireEvent.blur(screen.getByDisplayValue("Coach Rivera"));
    fireEvent.click(screen.getByRole("button", { name: "1" })); // confirm Rivera to serve HW1
    // add + enroll a student in HW1
    tab("Student Journey");
    fireEvent.click(await screen.findByRole("button", { name: /Add student/i }));
    fireEvent.change(await screen.findByPlaceholderText(/Student name/i), { target: { value: "Noah" } });
    await screen.findByDisplayValue("Noah");
    fireEvent.blur(screen.getByDisplayValue("Noah"));
    fireEvent.click(screen.getByTitle(/Holy Warriors 1:/i));
    await waitFor(() => expect(screen.getByTitle(/Holy Warriors 1:/i).getAttribute("title")).toMatch(/In progress/i));

    tab("Roster");
    expect(await screen.findByText("Noah")).toBeInTheDocument();

    // assign coach
    const coachSelect = screen.getAllByRole("combobox").find((el) => Array.from(el.options).some((o) => /Unassigned/i.test(o.textContent)));
    fireEvent.change(coachSelect, { target: { value: within(coachSelect).getByText(/Coach Rivera/i).getAttribute("value") } });
    await waitFor(() => expect(screen.getByRole("button", { name: /^Unassign$/i })).toBeInTheDocument());

    // set table number
    const tableInput = screen.getByPlaceholderText("—");
    fireEvent.change(tableInput, { target: { value: "5" } });
    await waitFor(() => expect(screen.getByDisplayValue("5")).toBeInTheDocument());

    // unassign
    fireEvent.click(screen.getByRole("button", { name: /^Unassign$/i }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Unassign$/i })).not.toBeInTheDocument());

    // mark dropped, then re-activate
    fireEvent.click(screen.getByRole("button", { name: /Mark dropped/i }));
    expect(await screen.findByText("DROPPED")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Re-activate/i }));
    await waitFor(() => expect(screen.queryByText("DROPPED")).not.toBeInTheDocument());
  });

  it("add a student manually from the roster", async () => {
    renderApp(); await signIn(); tab("Roster");
    const input = await screen.findByPlaceholderText(/Add a student to/i);
    fireEvent.change(input, { target: { value: "Manual Mike" } });
    fireEvent.click(screen.getByRole("button", { name: /\+ Add student/i }));
    expect(await screen.findByText("Manual Mike")).toBeInTheDocument();
  });

  it("delete a student from the roster", async () => {
    const orig = window.confirm; window.confirm = () => true;
    try {
      renderApp(); await signIn(); tab("Roster");
      const input = await screen.findByPlaceholderText(/Add a student to/i);
      fireEvent.change(input, { target: { value: "Temp Tess" } });
      fireEvent.click(screen.getByRole("button", { name: /\+ Add student/i }));
      expect(await screen.findByText("Temp Tess")).toBeInTheDocument();
      const dels = screen.getAllByTitle("Delete student");
      fireEvent.click(dels[dels.length - 1]);
      await waitFor(() => expect(screen.queryByText("Temp Tess")).not.toBeInTheDocument());
    } finally { window.confirm = orig; }
  });
});

describe("ROLES / TEAM / ACCOUNT (demo = director)", () => {
  it("director sees the Team tab and their own account row", async () => {
    renderApp(); await signIn();
    expect(screen.getByRole("button", { name: /Director/ })).toBeInTheDocument();
    tab("Director");
    expect(await screen.findByText(/Team & roles/i)).toBeInTheDocument();
    expect(screen.getAllByText(/sam@church.org/i).length).toBeGreaterThan(0);
    // role select present with director option
    expect(screen.getAllByRole("combobox").some((el) => el.value === "director")).toBe(true);
  });

  it("can change own role via the Team role dropdown (demo)", async () => {
    renderApp(); await signIn();
    tab("Director");
    await screen.findByText(/Team & roles/i);
    const roleSel = screen.getAllByRole("combobox").find((el) => el.value === "director");
    fireEvent.change(roleSel, { target: { value: "class_admin" } });
    // after demoting, Director tab should disappear (class_admin can't manage users)
    await waitFor(() => expect(screen.queryByRole("button", { name: /Director/ })).not.toBeInTheDocument());
  });

  it("opens the Account modal and saves a display name", async () => {
    renderApp(); await signIn();
    fireEvent.click(screen.getByRole("button", { name: /sam@church.org/i }));
    expect(await screen.findByText(/Your account/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("First"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByPlaceholderText("Last"), { target: { value: "Director" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(screen.queryByText(/Your account/i)).not.toBeInTheDocument());
    // header now shows the saved name
    expect(await screen.findByText("Sam Director")).toBeInTheDocument();
  });
});

describe("ROUNDS / OUTCOMES / TRAINING (demo = director)", () => {
  it("starts a new round and it becomes active + selectable", async () => {
    renderApp(); await signIn();
    tab("Rounds");
    fireEvent.change(await screen.findByPlaceholderText(/Spring 2026/i), { target: { value: "Spring 2026" } });
    fireEvent.click(screen.getByRole("button", { name: /^Start round$/i }));
    expect(await screen.findByText("Spring 2026")).toBeInTheDocument();
    expect(screen.getByText(/^Active$/)).toBeInTheDocument();
    // header round selector now lists it
    const headerSel = screen.getAllByRole("combobox").find((el) => Array.from(el.options).some((o) => /Spring 2026/.test(o.textContent)));
    expect(headerSel).toBeTruthy();
  });

  it("marks a student graduated in the journey pipeline", async () => {
    renderApp(); await signIn();
    tab("Student Journey");
    fireEvent.click(await screen.findByRole("button", { name: /Add student/i }));
    fireEvent.change(await screen.findByPlaceholderText(/Student name/i), { target: { value: "Ruth" } });
    await screen.findByDisplayValue("Ruth");
    fireEvent.blur(screen.getByDisplayValue("Ruth"));
    // Graduated is the final milestone in the pipeline
    fireEvent.click(screen.getByTitle(/^Graduated:/i));
    await waitFor(() => expect(screen.getByTitle(/^Graduated:/i).getAttribute("title")).toMatch(/done/i));
  });

  it("adds a coach training step and marks it complete", async () => {
    renderApp(); await signIn();
    // add a coach
    tab("Volunteers");
    fireEvent.click(await screen.findByRole("button", { name: /Add coach/i }));
    fireEvent.change(await screen.findByPlaceholderText(/First name/i), { target: { value: "Coach Dan" } });
    await screen.findByDisplayValue("Coach Dan");
    fireEvent.blur(screen.getByDisplayValue("Coach Dan"));
    tab("Training");
    // add a step
    fireEvent.change(await screen.findByPlaceholderText(/Add a step/i), { target: { value: "Complete orientation" } });
    fireEvent.click(screen.getByRole("button", { name: /Add step/i }));
    expect((await screen.findAllByText(/Complete orientation/i)).length).toBeGreaterThan(0);
    // toggle the step for Coach Dan (the ✓ button in the matrix)
    const checks = screen.getAllByRole("button", { name: "✓" });
    fireEvent.click(checks[0]);
    expect(await screen.findByText(/1\/1/)).toBeInTheDocument();
  });
});

describe("FULL BUTTON COVERAGE (demo = director)", () => {
  it("Dashboard 'Review' jumps to Inventory", async () => {
    renderApp(); await signIn();
    fireEvent.click(await screen.findByRole("button", { name: /^Review$/i }));
    expect(await screen.findByText(/Book payments/i)).toBeInTheDocument();
  });

  it("Volunteers: youth-leader toggle works", async () => {
    renderApp(); await signIn(); tab("Volunteers");
    fireEvent.click(await screen.findByRole("button", { name: /Add coach/i }));
    await screen.findByPlaceholderText(/First name/i);
    fireEvent.click(screen.getByRole("button", { name: /Youth leader\?/i }));
    expect(await screen.findByRole("button", { name: /✓ Youth Leader/i })).toBeInTheDocument();
  });

  it("Journey: youth toggle + phone edit", async () => {
    renderApp(); await signIn(); tab("Student Journey");
    fireEvent.click(await screen.findByRole("button", { name: /Add student/i }));
    fireEvent.change(await screen.findByPlaceholderText(/Student name/i), { target: { value: "Kid" } });
    fireEvent.change(screen.getByPlaceholderText(/^Phone$/i), { target: { value: "555-1212" } });
    expect(await screen.findByDisplayValue("555-1212")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Youth\?/i }));
    expect(await screen.findByRole("button", { name: /✓ Youth/i })).toBeInTheDocument();
  });

  it("Roster: course tabs + filter chips", async () => {
    renderApp(); await signIn(); tab("Roster");
    fireEvent.click(await screen.findByRole("button", { name: /Holy Warriors 3/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Unassigned$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Active$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Dropped/i }));
    fireEvent.click(screen.getByRole("button", { name: /^All$/i }));
    expect(screen.getByText(/No students in this course yet|No .* students/i)).toBeInTheDocument();
  });

  it("Inventory: threshold edit", async () => {
    renderApp(); await signIn(); tab("Inventory");
    fireEvent.click(await screen.findByRole("button", { name: /Book stock/i })); // expand stock section
    const nums = await screen.findAllByRole("spinbutton");
    // second spinbutton in first card is threshold; set count(0) then threshold
    fireEvent.change(nums[1], { target: { value: "3" } });
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[1].value).toBe("3"));
  });

  it("Rounds: create, edit goal, add coach, delete", async () => {
    renderApp(); await signIn();
    tab("Volunteers");
    fireEvent.click(await screen.findByRole("button", { name: /Add coach/i }));
    fireEvent.change(await screen.findByPlaceholderText(/First name/i), { target: { value: "Coach Mo" } });
    await screen.findByDisplayValue("Coach Mo");
    fireEvent.blur(screen.getByDisplayValue("Coach Mo"));
    tab("Rounds");
    fireEvent.change(await screen.findByPlaceholderText(/Spring 2026/i), { target: { value: "R1" } });
    fireEvent.click(screen.getByRole("button", { name: /^Start round$/i }));
    expect(await screen.findByText("R1")).toBeInTheDocument();
    // edit a goal (first spinbutton)
    const goals = screen.getAllByRole("spinbutton");
    fireEvent.change(goals[0], { target: { value: "12" } });
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("12"));
    // add coach to round
    fireEvent.click(screen.getByRole("button", { name: /Coach Mo/i }));
    expect(await screen.findByText(/Coaches in this round \(1\)/i)).toBeInTheDocument();
    // delete round
    fireEvent.click(screen.getByTitle(/Delete round/i));
    await waitFor(() => expect(screen.queryByText("R1")).not.toBeInTheDocument());
  });

  it("Journey: milestones toggle (God Encounter, Leading a DG)", async () => {
    renderApp(); await signIn();
    tab("Student Journey");
    fireEvent.click(await screen.findByRole("button", { name: /Add student/i }));
    fireEvent.change(await screen.findByPlaceholderText(/Student name/i), { target: { value: "Eli" } });
    await screen.findByDisplayValue("Eli");
    fireEvent.blur(screen.getByDisplayValue("Eli"));
    fireEvent.click(screen.getByTitle(/^God Encounter:/i));
    await waitFor(() => expect(screen.getByTitle(/^God Encounter:/i).getAttribute("title")).toMatch(/done/i));
    fireEvent.click(screen.getByTitle(/^Leading a DG:/i));
    await waitFor(() => expect(screen.getByTitle(/^Leading a DG:/i).getAttribute("title")).toMatch(/done/i));
  });

  it("Training: switch to admin journey, add + remove a step", async () => {
    renderApp(); await signIn(); tab("Training");
    fireEvent.click(await screen.findByRole("button", { name: /Admin onboarding journey/i }));
    fireEvent.change(await screen.findByPlaceholderText(/Add a step/i), { target: { value: "Background check" } });
    fireEvent.click(screen.getByRole("button", { name: /Add step/i }));
    expect((await screen.findAllByText(/Background check/i)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /^Remove$/i }));
    await waitFor(() => expect(screen.queryByText(/Background check/i)).not.toBeInTheDocument());
  });

  it("Backup import restores data from a file", async () => {
    renderApp(); await signIn();
    const input = document.querySelector('input[type="file"]');
    const file = new File([JSON.stringify({ coaches: [{ id: "imp1", name: "Imported Coach" }] })], "b.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
    tab("Volunteers");
    expect(await screen.findByText("Imported Coach")).toBeInTheDocument(); // shown as a collapsed row
  });
});

describe("ROUND PICKER + inventory perms", () => {
  it("non-manager role picks a round then lands on dashboard; no inventory/coaches tabs", async () => {
    localStorage.setItem("hw_demo_profile", JSON.stringify({ id: "demo", email: "leader@church.org", role: "class_leader", full_name: "", avatar_url: "" }));
    localStorage.setItem("holy_warriors_v1", JSON.stringify({ rounds: [{ id: "r1", name: "Fall 2026", active: true, createdAt: 1 }] }));
    renderApp();
    fireEvent.change(await screen.findByPlaceholderText(/you@church.org/i), { target: { value: "leader@church.org" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Sign in$/i }).at(-1));
    expect(await screen.findByText(/Choose your campus/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByText("Fall 2026"));
    expect(await screen.findByText(/Readiness checklist/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Inventory/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Volunteers/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Attendance/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Roster/ })).toBeInTheDocument();
  });
});

describe("TASKS / GOALS + completion (demo = director)", () => {
  it("director assigns a task, it appears, completes it (confetti-safe), shows done + notif bell", async () => {
    renderApp(); await signIn();
    tab("Tasks");
    fireEvent.change(await screen.findByPlaceholderText(/Call your class/i), { target: { value: "Pray daily" } });
    // pick the role <select> that lists roles, set to director so it shows for the demo director
    const roleSel = screen.getAllByRole("combobox").find((el) => Array.from(el.options).some((o) => /Discipleship Director/.test(o.textContent)));
    fireEvent.change(roleSel, { target: { value: "director" } });
    fireEvent.click(screen.getByRole("button", { name: /^Assign$/i }));
    // shows in "Assigned to me"
    expect((await screen.findAllByText("Pray daily")).length).toBeGreaterThan(0);
    // complete it (the ✓ button in the my-tasks card)
    fireEvent.click(screen.getByRole("button", { name: "✓" }));
    // shows completed in the All-assigned table + notification bell present
    expect(await screen.findByText(/✓ Done/)).toBeInTheDocument();
    expect(screen.getByTitle(/Notifications/i)).toBeInTheDocument();
  });

  it("non-director does not see the assign form", async () => {
    localStorage.setItem("hw_demo_profile", JSON.stringify({ id: "demo", email: "ca@church.org", role: "class_admin", full_name: "", avatar_url: "" }));
    localStorage.setItem("holy_warriors_v1", JSON.stringify({ rounds: [{ id: "r1", name: "Fall 2026", active: true, createdAt: 1 }] }));
    renderApp();
    fireEvent.change(await screen.findByPlaceholderText(/you@church.org/i), { target: { value: "ca@church.org" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Sign in$/i }).at(-1));
    fireEvent.click(await screen.findByText("Fall 2026"));
    await screen.findByText(/Readiness checklist/i);
    tab("Tasks");
    expect(await screen.findByText(/Assigned to me/i)).toBeInTheDocument();
    expect(screen.queryByText(/Assign a task or goal/i)).not.toBeInTheDocument();
  });
});

describe("REPORTS + coach/admin attendance (demo = director)", () => {
  it("Reports tab shows overview and detailed sections", async () => {
    renderApp(); await signIn();
    tab("Reports");
    expect(await screen.findByText(/attendance overview/i)).toBeInTheDocument();
    expect(screen.getByText(/who attended/i)).toBeInTheDocument();
  });

  it("can mark coach attendance on the Attendance tab", async () => {
    renderApp(); await signIn();
    tab("Volunteers");
    fireEvent.click(await screen.findByRole("button", { name: /Add coach/i }));
    fireEvent.change(await screen.findByPlaceholderText(/First name/i), { target: { value: "Coach Amy" } });
    await screen.findByDisplayValue("Coach Amy");
    fireEvent.blur(screen.getByDisplayValue("Coach Amy"));
    tab("Attendance");
    fireEvent.click(await screen.findByRole("button", { name: /^Coaches$/ })); // group toggle (nav tab name has an icon)
    expect(await screen.findByText("Coach Amy")).toBeInTheDocument();
    const w1 = screen.getByTitle(/Week 1:/i);
    fireEvent.click(w1);
    await waitFor(() => expect(screen.getByTitle(/Week 1:/i).getAttribute("title")).toMatch(/In Person/i));
  });
});

describe("SIGNUP requires name + photo", () => {
  it("blocks without name, then signs up with name + photo and shows the name", async () => {
    localStorage.removeItem("hw_demo_profile");
    renderApp();
    // switch to Create account tab
    fireEvent.click((await screen.findAllByRole("button", { name: /Create account/i }))[0]);
    // email is required by the browser, so fill it first
    fireEvent.change(screen.getByPlaceholderText(/you@church.org/i), { target: { value: "t@u.org" } });
    // submit without name -> validation
    fireEvent.click(screen.getAllByRole("button", { name: /Create account/i }).at(-1));
    expect(await screen.findByText(/first and last name/i)).toBeInTheDocument();
    // fill name
    fireEvent.change(screen.getByPlaceholderText("First"), { target: { value: "Test" } });
    fireEvent.change(screen.getByPlaceholderText("Last"), { target: { value: "User" } });
    // submit without photo -> validation
    fireEvent.click(screen.getAllByRole("button", { name: /Create account/i }).at(-1));
    expect(await screen.findByText(/profile photo/i)).toBeInTheDocument();
    // add photo
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
    fireEvent.click(screen.getAllByRole("button", { name: /Create account/i }).at(-1));
    // lands in app, header shows full name
    expect(await screen.findByText(/Readiness checklist/i)).toBeInTheDocument();
    expect(await screen.findByText("Test User")).toBeInTheDocument();
  });
});

describe("DIRECTOR command center (demo = director)", () => {
  it("shows online, activity, team roles and permission matrix", async () => {
    renderApp(); await signIn();
    tab("Director");
    expect(await screen.findByText(/Director Command Center/i)).toBeInTheDocument();
    expect(screen.getByText(/Online now/i)).toBeInTheDocument();
    expect(screen.getByText(/Live activity/i)).toBeInTheDocument();
    expect(screen.getByText(/What each role can do/i)).toBeInTheDocument();
    // role dropdown for the team member (self) present
    expect(screen.getAllByRole("combobox").some((el) => el.value === "director")).toBe(true);
  });
});

describe("PER-COACH SCOPING (class leader)", () => {
  it("a class leader sees only their linked coach's students", async () => {
    localStorage.setItem("hw_demo_profile", JSON.stringify({ id: "demo", email: "l@x.org", role: "class_leader", coach_id: "co1", full_name: "Leader One" }));
    localStorage.setItem("holy_warriors_v1", JSON.stringify({
      rounds: [{ id: "r1", name: "R1", active: true, createdAt: 1 }],
      coaches: [{ id: "co1", name: "My Coach" }, { id: "co2", name: "Other Coach" }],
      students: [
        { id: "s1", name: "Mine Student", roundId: "r1", progress: { HW1: "in_progress" }, assignments: { HW1: { coachId: "co1", table: "" } } },
        { id: "s2", name: "Other Student", roundId: "r1", progress: { HW1: "in_progress" }, assignments: { HW1: { coachId: "co2", table: "" } } },
      ],
    }));
    renderApp();
    fireEvent.change(await screen.findByPlaceholderText(/you@church.org/i), { target: { value: "l@x.org" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Sign in$/i }).at(-1));
    fireEvent.click(await screen.findByText("R1")); // round picker
    fireEvent.click(await screen.findByRole("button", { name: /Roster/ }));
    expect(await screen.findByText("Mine Student")).toBeInTheDocument();
    expect(screen.queryByText("Other Student")).not.toBeInTheDocument();
  });
});
