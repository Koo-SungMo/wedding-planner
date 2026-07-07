import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "weddingPlannerGoogleSheetsV2";
const DEFAULT_APP = {
  settings: {
    weddingDate: "2027-02-27",
    sheetApiUrl: "",
    apiSecret: "",
    taskCategories: ["웨딩홀", "스드메", "촬영", "본식", "예복", "예물", "청첩장", "허니문", "혼수", "기타"],
    expenseCategories: ["웨딩홀", "스드메", "촬영", "본식", "예복", "예물", "청첩장", "허니문", "혼수", "기타"],
    vendorCategories: ["웨딩홀", "스튜디오", "드레스", "메이크업", "본식스냅", "DVD", "예복", "예물", "허니문", "기타"],
    guestGroups: ["가족", "친척", "회사", "친구", "지인", "기타"],
    owners: ["성모", "신부", "같이", "양가", "기타"],
    taskStatuses: ["미시작", "진행중", "확인필요", "완료"],
  },
  tasks: [
    { id: 1, title: "스드메 최종 확정", category: "스드메", dueDate: "2026-08-31", status: "진행중", owner: "같이", memo: "계약서/추가금 조건 확인" },
    { id: 2, title: "본식스냅/DVD 업체 계약", category: "본식", dueDate: "2026-09-30", status: "미시작", owner: "성모", memo: "원본/수정본 제공 범위 확인" },
    { id: 3, title: "본식 최종 보증인원 확정", category: "본식", dueDate: "2027-02-10", status: "미시작", owner: "같이", memo: "웨딩홀 마감일 확인" },
  ],
  expenses: [
    { id: 101, item: "웨딩홀 계약금", category: "웨딩홀", total: 0, paidAmount: 0, dueDate: "2026-08-31", vendor: "", paid: false, memo: "계약금/잔금 분리 입력" },
    { id: 102, item: "스드메 계약금", category: "스드메", total: 0, paidAmount: 0, dueDate: "2026-08-31", vendor: "", paid: false, memo: "원본/수정본 필수 비용 확인" },
    { id: 103, item: "예복", category: "예복", total: 0, paidAmount: 0, dueDate: "2026-11-30", vendor: "", paid: false, memo: "맞춤정장/구두 포함 여부" },
  ],
  guests: [
    { id: 201, name: "회사 동료", side: "신랑", group: "회사", invite: "미발송", rsvp: "미정", count: 1, meal: "일반", memo: "" },
    { id: 202, name: "친구", side: "신랑", group: "친구", invite: "미발송", rsvp: "미정", count: 1, meal: "일반", memo: "" },
  ],
  vendors: [
    { id: 301, name: "웨딩홀", category: "웨딩홀", contact: "", manager: "", contractDate: "2026-07-31", balanceDate: "2027-02-10", amount: 0, status: "상담중", memo: "보증인원/식대/주차 확인" },
    { id: 302, name: "헤로하우스", category: "스튜디오", contact: "", manager: "", contractDate: "2026-08-31", balanceDate: "2026-10-31", amount: 0, status: "검토중", memo: "셀렉시간/원본수정본/야간씬 추가비 확인" },
  ],
  timeline: [
    { id: 401, time: "08:00", title: "신랑 준비", owner: "성모", place: "자택/샵", memo: "예복, 구두, 반지, 보조배터리" },
    { id: 402, time: "10:00", title: "메이크업샵 도착", owner: "같이", place: "메이크업샵", memo: "혼주 동선 확인" },
    { id: 403, time: "15:00", title: "예식 시작", owner: "같이", place: "웨딩홀", memo: "반지/혼인서약/성혼선언문" },
  ],
};

const TABS = ["대시보드", "일정", "비용", "하객", "업체", "타임라인", "설정"];
const INVITE_OPTIONS = ["미발송", "발송완료", "보류"];
const RSVP_OPTIONS = ["미정", "참석", "불참"];
const VENDOR_STATUS = ["검토중", "상담중", "계약완료", "취소"];

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return DEFAULT_APP;
    return { ...DEFAULT_APP, ...saved, settings: { ...DEFAULT_APP.settings, ...(saved.settings || {}) } };
  } catch {
    return DEFAULT_APP;
  }
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function daysUntil(date) {
  if (!date) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target - today) / 86400000);
}

function nextId(list) {
  return Math.max(0, ...list.map((x) => Number(x.id) || 0)) + 1;
}

function listToText(list) {
  return Array.isArray(list) ? list.join(", ") : "";
}

function textToList(text) {
  return String(text || "").split(",").map((x) => x.trim()).filter(Boolean);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  rows.forEach((row) => lines.push(headers.map((h) => csvEscape(row[h])).join(",")));
  return "\uFEFF" + lines.join("\n");
}

function download(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function badge(value) {
  if (["완료", "계약완료", "참석", "발송완료", "결제완료"].includes(value)) return "bg-emerald-100 text-emerald-700";
  if (["진행중", "상담중"].includes(value)) return "bg-blue-100 text-blue-700";
  if (["확인필요", "검토중", "미정", "미결제"].includes(value)) return "bg-amber-100 text-amber-700";
  if (["불참", "취소"].includes(value)) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

function jsonp(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const callback = `jsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const sep = url.includes("?") ? "&" : "?";
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("요청 시간이 초과되었습니다."));
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
    }
    window[callback] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("Google Apps Script 호출에 실패했습니다."));
    };
    script.src = `${url}${sep}callback=${callback}`;
    document.body.appendChild(script);
  });
}

export default function WeddingPlannerGoogleSheetsV2() {
  const [app, setApp] = useState(loadSaved);
  const [tab, setTab] = useState("대시보드");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ tasks: "전체", expenses: "전체", guests: "전체", vendors: "전체" });
  const [editing, setEditing] = useState({ section: "", id: null });
  const [syncStatus, setSyncStatus] = useState("로컬 저장 모드입니다. Google Apps Script URL 설정 후 시트 저장/불러오기를 사용할 수 있습니다.");
  const [busy, setBusy] = useState(false);

  const emptyTask = { title: "", category: app.settings.taskCategories[0] || "본식", dueDate: "2026-12-31", status: app.settings.taskStatuses[0] || "미시작", owner: app.settings.owners[0] || "같이", memo: "" };
  const emptyExpense = { item: "", category: app.settings.expenseCategories[0] || "본식", total: 0, paidAmount: 0, dueDate: "2026-12-31", vendor: "", paid: false, memo: "" };
  const emptyGuest = { name: "", side: "신랑", group: app.settings.guestGroups[0] || "친구", invite: "미발송", rsvp: "미정", count: 1, meal: "일반", memo: "" };
  const emptyVendor = { name: "", category: app.settings.vendorCategories[0] || "본식", contact: "", manager: "", contractDate: "2026-12-31", balanceDate: app.settings.weddingDate, amount: 0, status: "검토중", memo: "" };
  const emptyTimeline = { time: "12:00", title: "", owner: app.settings.owners[0] || "성모", place: "", memo: "" };

  const [taskForm, setTaskForm] = useState(emptyTask);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [guestForm, setGuestForm] = useState(emptyGuest);
  const [vendorForm, setVendorForm] = useState(emptyVendor);
  const [timelineForm, setTimelineForm] = useState(emptyTimeline);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app));
  }, [app]);

  const stats = useMemo(() => {
    const taskDone = app.tasks.filter((x) => x.status === "완료").length;
    const progress = app.tasks.length ? Math.round((taskDone / app.tasks.length) * 100) : 0;
    const totalCost = app.expenses.reduce((sum, x) => sum + Number(x.total || 0), 0);
    const paidCost = app.expenses.reduce((sum, x) => sum + Number(x.paidAmount || 0), 0);
    const remainingCost = Math.max(totalCost - paidCost, 0);
    const urgentTasks = app.tasks.filter((x) => x.status !== "완료" && daysUntil(x.dueDate) <= 30).length;
    const urgentPayments = app.expenses.filter((x) => Number(x.total || 0) > Number(x.paidAmount || 0) && daysUntil(x.dueDate) <= 30).length;
    const guestTotal = app.guests.reduce((sum, x) => sum + Number(x.count || 1), 0);
    const rsvpYes = app.guests.filter((x) => x.rsvp === "참석").reduce((sum, x) => sum + Number(x.count || 1), 0);
    const inviteSent = app.guests.filter((x) => x.invite === "발송완료").length;
    return { progress, totalCost, paidCost, remainingCost, urgentTasks, urgentPayments, guestTotal, rsvpYes, inviteSent };
  }, [app]);

  function update(section, nextList) {
    setApp((prev) => ({ ...prev, [section]: nextList }));
  }

  function saveRow(section, form, setter, empty) {
    const titleKey = section === "expenses" ? "item" : section === "guests" || section === "vendors" ? "name" : "title";
    if (!String(form[titleKey] || "").trim()) return;
    const list = app[section];
    const clean = { ...form };
    if (section === "expenses") {
      clean.total = Number(clean.total || 0);
      clean.paidAmount = Number(clean.paidAmount || 0);
      clean.paid = clean.total > 0 && clean.paidAmount >= clean.total;
    }
    if (section === "guests") clean.count = Number(clean.count || 1);
    if (section === "vendors") clean.amount = Number(clean.amount || 0);
    const next = editing.section === section && editing.id
      ? list.map((x) => x.id === editing.id ? { ...clean, id: editing.id } : x)
      : [...list, { ...clean, id: nextId(list) }];
    update(section, next);
    setEditing({ section: "", id: null });
    setter(empty);
  }

  function editRow(section, row, setter) {
    setEditing({ section, id: row.id });
    setter(row);
  }

  function deleteRow(section, id) {
    update(section, app[section].filter((x) => x.id !== id));
  }

  function cancelEdit(setter, empty) {
    setEditing({ section: "", id: null });
    setter(empty);
  }

  function filtered(section, fields, categoryField, filterKey) {
    const q = query.trim().toLowerCase();
    const filterValue = filters[filterKey];
    return app[section].filter((row) => {
      const matchText = !q || fields.some((f) => String(row[f] ?? "").toLowerCase().includes(q));
      const matchFilter = !categoryField || filterValue === "전체" || row[categoryField] === filterValue;
      return matchText && matchFilter;
    });
  }

  const taskRows = filtered("tasks", ["title", "category", "status", "owner", "memo"], "category", "tasks").sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const expenseRows = filtered("expenses", ["item", "category", "vendor", "memo"], "category", "expenses").sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const guestRows = filtered("guests", ["name", "side", "group", "invite", "rsvp", "memo"], "group", "guests").sort((a, b) => String(a.group).localeCompare(String(b.group), "ko") || String(a.name).localeCompare(String(b.name), "ko"));
  const vendorRows = filtered("vendors", ["name", "category", "contact", "manager", "memo"], "category", "vendors").sort((a, b) => new Date(a.balanceDate) - new Date(b.balanceDate));
  const timelineRows = app.timeline.filter((x) => !query.trim() || ["time", "title", "owner", "place", "memo"].some((f) => String(x[f] ?? "").toLowerCase().includes(query.toLowerCase()))).sort((a, b) => String(a.time).localeCompare(String(b.time)));

  function getApiBase() {
    return app.settings.sheetApiUrl.trim();
  }

  function buildPayload() {
    return { ...app, savedAt: new Date().toISOString() };
  }

  async function saveToSheet() {
    if (!getApiBase()) {
      setSyncStatus("Google Apps Script Web App URL을 먼저 입력하세요.");
      return;
    }
    setBusy(true);
    setSyncStatus("Google Sheet 저장 중...");
    try {
      const body = { action: "save", secret: app.settings.apiSecret, payload: buildPayload() };
      await fetch(getApiBase(), { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
      setSyncStatus(`저장 요청 완료: ${new Date().toLocaleString("ko-KR")} / Google Apps Script 특성상 저장 성공 응답은 읽지 못할 수 있습니다. 불러오기로 확인하세요.`);
    } catch (err) {
      setSyncStatus(`저장 요청 실패: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadFromSheet() {
    if (!getApiBase()) {
      setSyncStatus("Google Apps Script Web App URL을 먼저 입력하세요.");
      return;
    }
    setBusy(true);
    setSyncStatus("Google Sheet에서 불러오는 중...");
    try {
      const url = `${getApiBase()}?action=load&secret=${encodeURIComponent(app.settings.apiSecret || "")}`;
      const result = await jsonp(url);
      if (!result || !result.ok || !result.payload) throw new Error(result?.error || "저장된 데이터가 없습니다.");
      const merged = { ...DEFAULT_APP, ...result.payload, settings: { ...DEFAULT_APP.settings, ...(result.payload.settings || {}) } };
      setApp(merged);
      setSyncStatus(`불러오기 완료: ${new Date().toLocaleString("ko-KR")}`);
    } catch (err) {
      setSyncStatus(`불러오기 실패: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    download("wedding-planner-google-sheets-backup.json", JSON.stringify(buildPayload(), null, 2), "application/json;charset=utf-8");
  }

  function exportCsv() {
    download("wedding-tasks.csv", toCsv(app.tasks), "text/csv;charset=utf-8");
    setTimeout(() => download("wedding-expenses.csv", toCsv(app.expenses), "text/csv;charset=utf-8"), 150);
    setTimeout(() => download("wedding-guests.csv", toCsv(app.guests), "text/csv;charset=utf-8"), 300);
    setTimeout(() => download("wedding-vendors.csv", toCsv(app.vendors), "text/csv;charset=utf-8"), 450);
    setTimeout(() => download("wedding-timeline.csv", toCsv(app.timeline), "text/csv;charset=utf-8"), 600);
  }

  async function importJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      setApp({ ...DEFAULT_APP, ...imported, settings: { ...DEFAULT_APP.settings, ...(imported.settings || {}) } });
      setSyncStatus("JSON 백업을 불러왔습니다. 공유 시트에 반영하려면 시트 저장을 누르세요.");
    } catch {
      setSyncStatus("JSON 파일 형식이 올바르지 않습니다.");
    }
    e.target.value = "";
  }

  const Input = (props) => <input {...props} className={`w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-200 ${props.className || ""}`} />;
  const Select = ({ children, ...props }) => <select {...props} className={`w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-200 ${props.className || ""}`}>{children}</select>;
  const Btn = ({ children, className = "", ...props }) => <button {...props} className={`rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${className}`}>{children}</button>;
  const Box = ({ children, className = "" }) => <div className={`rounded-3xl border border-slate-100 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
  const Grid = ({ children }) => <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{children}</div>;
  const Badge = ({ value }) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge(value)}`}>{value}</span>;

  const toolbar = (key, options) => (
    <Box>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="검색" className="md:max-w-sm" />
        <div className="flex flex-wrap gap-2">
          {["전체", ...options].map((x) => <button key={x} onClick={() => setFilters((p) => ({ ...p, [key]: x }))} className={`rounded-full px-3 py-1.5 text-sm ${filters[key] === x ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"}`}>{x}</button>)}
        </div>
      </div>
    </Box>
  );

  const statData = [
    ["본식까지", `D-${daysUntil(app.settings.weddingDate)}`],
    ["진행률", `${stats.progress}%`],
    ["총 금액", formatMoney(stats.totalCost)],
    ["결제한 금액", formatMoney(stats.paidCost)],
    ["남은 금액", formatMoney(stats.remainingCost)],
    ["참석/예상", `${stats.rsvpYes}/${stats.guestTotal}명`],
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-slate-100 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Box className="border-rose-100 bg-white/90">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-rose-500">Wedding Planner · Google Sheets Sync</p>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">결혼 준비 통합 관리 앱</h1>
              <p className="mt-2 text-slate-500">엑셀처럼 Google Drive의 스프레드시트를 저장소로 사용하고, 여러 사람이 같은 데이터를 불러와 최신화할 수 있습니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={saveToSheet} disabled={busy} className="bg-slate-900 text-white">시트 저장</Btn>
              <Btn onClick={loadFromSheet} disabled={busy} className="border bg-white">시트 불러오기</Btn>
              <Btn onClick={exportJson} className="border bg-white">JSON</Btn>
              <Btn onClick={exportCsv} className="border bg-white">CSV</Btn>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">상태: {syncStatus}</div>
        </Box>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
          {TABS.map((x) => <button key={x} onClick={() => setTab(x)} className={`rounded-2xl px-3 py-3 text-sm font-semibold ${tab === x ? "bg-slate-900 text-white shadow" : "border border-slate-100 bg-white text-slate-600"}`}>{x}</button>)}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          {statData.map(([label, value]) => <Box key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></Box>)}
        </div>

        {tab === "대시보드" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Box className="xl:col-span-2"><h2 className="mb-4 text-xl font-bold">임박한 일정</h2><div className="space-y-3">{app.tasks.filter((x) => x.status !== "완료").sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 7).map((x) => <div key={x.id} className="flex justify-between gap-3 rounded-2xl border bg-white p-4"><div><p className="font-semibold">{x.title}</p><p className="text-sm text-slate-500">{x.category} · {x.dueDate} · 담당 {x.owner} · {daysUntil(x.dueDate) >= 0 ? `D-${daysUntil(x.dueDate)}` : `${Math.abs(daysUntil(x.dueDate))}일 지남`}</p></div><Badge value={x.status} /></div>)}</div></Box>
            <Box><h2 className="mb-4 text-xl font-bold">비용 요약</h2><div className="space-y-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">총 금액</p><p className="text-2xl font-bold">{formatMoney(stats.totalCost)}</p></div><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-sm text-slate-500">결제한 금액</p><p className="text-2xl font-bold">{formatMoney(stats.paidCost)}</p></div><div className="rounded-2xl bg-rose-50 p-4"><p className="text-sm text-slate-500">남은 금액</p><p className="text-2xl font-bold">{formatMoney(stats.remainingCost)}</p></div></div></Box>
          </div>
        )}

        {tab === "일정" && <>{toolbar("tasks", app.settings.taskCategories)}<Box><h2 className="mb-4 text-xl font-bold">일정/체크리스트</h2><Grid><Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="할 일" /><Select value={taskForm.category} onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}>{app.settings.taskCategories.map((x) => <option key={x}>{x}</option>)}</Select><Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} /><Select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}>{app.settings.taskStatuses.map((x) => <option key={x}>{x}</option>)}</Select><Select value={taskForm.owner} onChange={(e) => setTaskForm({ ...taskForm, owner: e.target.value })}>{app.settings.owners.map((x) => <option key={x}>{x}</option>)}</Select><Input value={taskForm.memo} onChange={(e) => setTaskForm({ ...taskForm, memo: e.target.value })} placeholder="메모" /></Grid><div className="mt-3 flex gap-2"><Btn onClick={() => saveRow("tasks", taskForm, setTaskForm, emptyTask)} className="bg-slate-900 text-white">{editing.section === "tasks" ? "수정 저장" : "일정 추가"}</Btn>{editing.section === "tasks" && <Btn onClick={() => cancelEdit(setTaskForm, emptyTask)} className="border bg-white">취소</Btn>}</div><div className="mt-5 space-y-3">{taskRows.map((x) => <div key={x.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between gap-3"><div><div className="mb-2 flex flex-wrap gap-2"><Badge value={x.status} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.category}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.owner}</span></div><p className="font-semibold">{x.title}</p><p className="text-sm text-slate-500">마감 {x.dueDate} · {daysUntil(x.dueDate) >= 0 ? `D-${daysUntil(x.dueDate)}` : `${Math.abs(daysUntil(x.dueDate))}일 지남`}</p>{x.memo && <p className="text-sm text-slate-500">{x.memo}</p>}</div><div className="flex gap-1"><button onClick={() => editRow("tasks", x, setTaskForm)} className="rounded-xl p-2 hover:bg-slate-100">수정</button><button onClick={() => deleteRow("tasks", x.id)} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50">삭제</button></div></div></div>)}</div></Box></>}

        {tab === "비용" && <>{toolbar("expenses", app.settings.expenseCategories)}<Box><h2 className="mb-4 text-xl font-bold">비용 관리</h2><Grid><Input value={expenseForm.item} onChange={(e) => setExpenseForm({ ...expenseForm, item: e.target.value })} placeholder="비용 항목" /><Select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>{app.settings.expenseCategories.map((x) => <option key={x}>{x}</option>)}</Select><Input type="number" value={expenseForm.total} onChange={(e) => setExpenseForm({ ...expenseForm, total: Number(e.target.value) })} placeholder="총 금액" /><Input type="number" value={expenseForm.paidAmount} onChange={(e) => setExpenseForm({ ...expenseForm, paidAmount: Number(e.target.value) })} placeholder="결제한 금액" /><Input type="date" value={expenseForm.dueDate} onChange={(e) => setExpenseForm({ ...expenseForm, dueDate: e.target.value })} /><Input value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })} placeholder="업체명" /><Input value={expenseForm.memo} onChange={(e) => setExpenseForm({ ...expenseForm, memo: e.target.value })} placeholder="메모" className="md:col-span-2" /></Grid><div className="mt-3 flex gap-2"><Btn onClick={() => saveRow("expenses", expenseForm, setExpenseForm, emptyExpense)} className="bg-slate-900 text-white">{editing.section === "expenses" ? "수정 저장" : "비용 추가"}</Btn>{editing.section === "expenses" && <Btn onClick={() => cancelEdit(setExpenseForm, emptyExpense)} className="border bg-white">취소</Btn>}</div><div className="my-5 grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">총 금액</p><p className="text-2xl font-bold">{formatMoney(stats.totalCost)}</p></div><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-sm text-slate-500">결제한 금액</p><p className="text-2xl font-bold">{formatMoney(stats.paidCost)}</p></div><div className="rounded-2xl bg-rose-50 p-4"><p className="text-sm text-slate-500">남은 금액</p><p className="text-2xl font-bold">{formatMoney(stats.remainingCost)}</p></div></div><div className="space-y-3">{expenseRows.map((x) => { const left = Math.max(Number(x.total || 0) - Number(x.paidAmount || 0), 0); return <div key={x.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between gap-3"><div><div className="mb-2 flex flex-wrap gap-2"><Badge value={left === 0 && Number(x.total || 0) > 0 ? "결제완료" : "미결제"} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.category}</span></div><p className="font-semibold">{x.item}</p><p className="text-sm text-slate-500">총 {formatMoney(x.total)} · 결제 {formatMoney(x.paidAmount)} · 남음 {formatMoney(left)}</p><p className="text-sm text-slate-500">잔금/마감 {x.dueDate} · {daysUntil(x.dueDate) >= 0 ? `D-${daysUntil(x.dueDate)}` : `${Math.abs(daysUntil(x.dueDate))}일 지남`}</p>{x.vendor && <p className="text-sm text-slate-500">업체 {x.vendor}</p>}{x.memo && <p className="text-sm text-slate-500">{x.memo}</p>}</div><div className="flex gap-1"><button onClick={() => editRow("expenses", x, setExpenseForm)} className="rounded-xl p-2 hover:bg-slate-100">수정</button><button onClick={() => deleteRow("expenses", x.id)} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50">삭제</button></div></div></div>})}</div></Box></>}

        {tab === "하객" && <>{toolbar("guests", app.settings.guestGroups)}<Box><h2 className="mb-4 text-xl font-bold">하객/청첩장 관리</h2><Grid><Input value={guestForm.name} onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })} placeholder="이름/그룹명" /><Select value={guestForm.side} onChange={(e) => setGuestForm({ ...guestForm, side: e.target.value })}><option>신랑</option><option>신부</option><option>양가</option></Select><Select value={guestForm.group} onChange={(e) => setGuestForm({ ...guestForm, group: e.target.value })}>{app.settings.guestGroups.map((x) => <option key={x}>{x}</option>)}</Select><Input type="number" value={guestForm.count} onChange={(e) => setGuestForm({ ...guestForm, count: Number(e.target.value) })} placeholder="인원" /><Select value={guestForm.invite} onChange={(e) => setGuestForm({ ...guestForm, invite: e.target.value })}>{INVITE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</Select><Select value={guestForm.rsvp} onChange={(e) => setGuestForm({ ...guestForm, rsvp: e.target.value })}>{RSVP_OPTIONS.map((x) => <option key={x}>{x}</option>)}</Select><Input value={guestForm.meal} onChange={(e) => setGuestForm({ ...guestForm, meal: e.target.value })} placeholder="식사" /><Input value={guestForm.memo} onChange={(e) => setGuestForm({ ...guestForm, memo: e.target.value })} placeholder="메모" /></Grid><div className="mt-3 flex gap-2"><Btn onClick={() => saveRow("guests", guestForm, setGuestForm, emptyGuest)} className="bg-slate-900 text-white">{editing.section === "guests" ? "수정 저장" : "하객 추가"}</Btn>{editing.section === "guests" && <Btn onClick={() => cancelEdit(setGuestForm, emptyGuest)} className="border bg-white">취소</Btn>}</div><div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">{guestRows.map((x) => <div key={x.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between gap-3"><div><div className="mb-2 flex flex-wrap gap-2"><Badge value={x.rsvp} /><Badge value={x.invite} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.side}</span></div><p className="font-semibold">{x.name}</p><p className="text-sm text-slate-500">{x.group} · {x.count}명 · 식사 {x.meal}</p>{x.memo && <p className="text-sm text-slate-500">{x.memo}</p>}</div><div className="flex gap-1"><button onClick={() => editRow("guests", x, setGuestForm)} className="rounded-xl p-2 hover:bg-slate-100">수정</button><button onClick={() => deleteRow("guests", x.id)} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50">삭제</button></div></div></div>)}</div></Box></>}

        {tab === "업체" && <>{toolbar("vendors", app.settings.vendorCategories)}<Box><h2 className="mb-4 text-xl font-bold">업체/연락처 관리</h2><Grid><Input value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} placeholder="업체명" /><Select value={vendorForm.category} onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}>{app.settings.vendorCategories.map((x) => <option key={x}>{x}</option>)}</Select><Input value={vendorForm.contact} onChange={(e) => setVendorForm({ ...vendorForm, contact: e.target.value })} placeholder="연락처" /><Input value={vendorForm.manager} onChange={(e) => setVendorForm({ ...vendorForm, manager: e.target.value })} placeholder="담당자" /><Input type="date" value={vendorForm.contractDate} onChange={(e) => setVendorForm({ ...vendorForm, contractDate: e.target.value })} /><Input type="date" value={vendorForm.balanceDate} onChange={(e) => setVendorForm({ ...vendorForm, balanceDate: e.target.value })} /><Input type="number" value={vendorForm.amount} onChange={(e) => setVendorForm({ ...vendorForm, amount: Number(e.target.value) })} placeholder="계약 금액" /><Select value={vendorForm.status} onChange={(e) => setVendorForm({ ...vendorForm, status: e.target.value })}>{VENDOR_STATUS.map((x) => <option key={x}>{x}</option>)}</Select><Input value={vendorForm.memo} onChange={(e) => setVendorForm({ ...vendorForm, memo: e.target.value })} placeholder="메모" className="md:col-span-2" /></Grid><div className="mt-3 flex gap-2"><Btn onClick={() => saveRow("vendors", vendorForm, setVendorForm, emptyVendor)} className="bg-slate-900 text-white">{editing.section === "vendors" ? "수정 저장" : "업체 추가"}</Btn>{editing.section === "vendors" && <Btn onClick={() => cancelEdit(setVendorForm, emptyVendor)} className="border bg-white">취소</Btn>}</div><div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">{vendorRows.map((x) => <div key={x.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between gap-3"><div><div className="mb-2 flex flex-wrap gap-2"><Badge value={x.status} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.category}</span></div><p className="font-semibold">{x.name}</p><p className="text-sm text-slate-500">담당 {x.manager || "-"} · 연락처 {x.contact || "-"}</p><p className="text-sm text-slate-500">잔금 {x.balanceDate} · {daysUntil(x.balanceDate) >= 0 ? `D-${daysUntil(x.balanceDate)}` : `${Math.abs(daysUntil(x.balanceDate))}일 지남`}</p><p className="text-sm text-slate-500">금액 {formatMoney(x.amount)}</p>{x.memo && <p className="text-sm text-slate-500">{x.memo}</p>}</div><div className="flex gap-1"><button onClick={() => editRow("vendors", x, setVendorForm)} className="rounded-xl p-2 hover:bg-slate-100">수정</button><button onClick={() => deleteRow("vendors", x.id)} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50">삭제</button></div></div></div>)}</div></Box></>}

        {tab === "타임라인" && <Box><h2 className="mb-4 text-xl font-bold">본식 당일 타임라인</h2><Grid><Input type="time" value={timelineForm.time} onChange={(e) => setTimelineForm({ ...timelineForm, time: e.target.value })} /><Input value={timelineForm.title} onChange={(e) => setTimelineForm({ ...timelineForm, title: e.target.value })} placeholder="일정명" /><Select value={timelineForm.owner} onChange={(e) => setTimelineForm({ ...timelineForm, owner: e.target.value })}>{app.settings.owners.map((x) => <option key={x}>{x}</option>)}</Select><Input value={timelineForm.place} onChange={(e) => setTimelineForm({ ...timelineForm, place: e.target.value })} placeholder="장소" /><Input value={timelineForm.memo} onChange={(e) => setTimelineForm({ ...timelineForm, memo: e.target.value })} placeholder="메모" className="md:col-span-2" /></Grid><div className="mt-3 flex gap-2"><Btn onClick={() => saveRow("timeline", timelineForm, setTimelineForm, emptyTimeline)} className="bg-slate-900 text-white">{editing.section === "timeline" ? "수정 저장" : "타임라인 추가"}</Btn>{editing.section === "timeline" && <Btn onClick={() => cancelEdit(setTimelineForm, emptyTimeline)} className="border bg-white">취소</Btn>}</div><div className="relative mt-5 ml-4 space-y-4 border-l-2 border-rose-200">{timelineRows.map((x) => <div key={x.id} className="relative pl-6"><div className="absolute -left-[9px] top-4 h-4 w-4 rounded-full bg-rose-500" /><div className="rounded-2xl border bg-white p-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-bold text-rose-500">{x.time}</p><p className="font-semibold">{x.title}</p><p className="text-sm text-slate-500">담당 {x.owner} · 장소 {x.place || "-"}</p>{x.memo && <p className="text-sm text-slate-500">{x.memo}</p>}</div><div className="flex gap-1"><button onClick={() => editRow("timeline", x, setTimelineForm)} className="rounded-xl p-2 hover:bg-slate-100">수정</button><button onClick={() => deleteRow("timeline", x.id)} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50">삭제</button></div></div></div></div>)}</div></Box>}

        {tab === "설정" && <Box><h2 className="mb-4 text-xl font-bold">설정 / Google Sheet 저장소</h2><div className="space-y-5"><Grid><div><label className="mb-1 block text-sm font-semibold">결혼 날짜</label><Input type="date" value={app.settings.weddingDate} onChange={(e) => setApp((p) => ({ ...p, settings: { ...p.settings, weddingDate: e.target.value } }))} /></div><div><label className="mb-1 block text-sm font-semibold">D-day</label><Input readOnly value={`D-${daysUntil(app.settings.weddingDate)}`} /></div><div className="md:col-span-2"><label className="mb-1 block text-sm font-semibold">Google Apps Script Web App URL</label><Input value={app.settings.sheetApiUrl} onChange={(e) => setApp((p) => ({ ...p, settings: { ...p.settings, sheetApiUrl: e.target.value } }))} placeholder="https://script.google.com/macros/s/.../exec" /></div><div className="md:col-span-2"><label className="mb-1 block text-sm font-semibold">공유 비밀키</label><Input value={app.settings.apiSecret} onChange={(e) => setApp((p) => ({ ...p, settings: { ...p.settings, apiSecret: e.target.value } }))} placeholder="본인만 아는 긴 문자열" /></div><div><label className="mb-1 block text-sm font-semibold">일정 탭 필터</label><Input value={listToText(app.settings.taskCategories)} onChange={(e) => setApp((p) => ({ ...p, settings: { ...p.settings, taskCategories: textToList(e.target.value) } }))} /></div><div><label className="mb-1 block text-sm font-semibold">비용 탭 필터</label><Input value={listToText(app.settings.expenseCategories)} onChange={(e) => setApp((p) => ({ ...p, settings: { ...p.settings, expenseCategories: textToList(e.target.value) } }))} /></div><div><label className="mb-1 block text-sm font-semibold">하객 탭 필터</label><Input value={listToText(app.settings.guestGroups)} onChange={(e) => setApp((p) => ({ ...p, settings: { ...p.settings, guestGroups: textToList(e.target.value) } }))} /></div><div><label className="mb-1 block text-sm font-semibold">업체 탭 필터</label><Input value={listToText(app.settings.vendorCategories)} onChange={(e) => setApp((p) => ({ ...p, settings: { ...p.settings, vendorCategories: textToList(e.target.value) } }))} /></div><div><label className="mb-1 block text-sm font-semibold">담당자 목록</label><Input value={listToText(app.settings.owners)} onChange={(e) => setApp((p) => ({ ...p, settings: { ...p.settings, owners: textToList(e.target.value) } }))} /></div><div><label className="mb-1 block text-sm font-semibold">일정 상태 목록</label><Input value={listToText(app.settings.taskStatuses)} onChange={(e) => setApp((p) => ({ ...p, settings: { ...p.settings, taskStatuses: textToList(e.target.value) } }))} /></div></Grid><div className="flex flex-wrap gap-2"><Btn onClick={saveToSheet} disabled={busy} className="bg-slate-900 text-white">시트 저장</Btn><Btn onClick={loadFromSheet} disabled={busy} className="border bg-white">시트 불러오기</Btn><label className="cursor-pointer rounded-xl border bg-white px-3 py-2 text-sm font-semibold">JSON 불러오기<input type="file" accept="application/json" onChange={importJson} className="hidden" /></label><Btn onClick={() => { if (confirm("샘플 데이터로 초기화할까요?")) setApp(DEFAULT_APP); }} className="border border-rose-200 bg-white text-rose-600">샘플 초기화</Btn></div><div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">{syncStatus}</div></div></Box>}
      </div>
    </div>
  );
}