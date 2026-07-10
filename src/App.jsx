import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "weddingPlannerGoogleDriveExcelV3";

const DEFAULT_APP = {
  settings: {
    weddingDate: "2027-02-27",
    sheetApiUrl: "",
    apiSecret: "",
    autoDriveSave: false,
    lastLoadedAt: "",
    lastSavedAt: "",
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
    { id: 101, item: "웨딩홀 계약", category: "웨딩홀", total: 0, paidAmount: 0, deposit: 0, interimPayment: 0, finalPayment: 0, dueDate: "2027-02-10", vendor: "", memo: "계약금/중도금/잔금 분리 입력" },
    { id: 102, item: "스드메 계약", category: "스드메", total: 0, paidAmount: 0, deposit: 0, interimPayment: 0, finalPayment: 0, dueDate: "2026-08-31", vendor: "", memo: "원본/수정본 필수 비용 확인" },
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

function Field({ label, help, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-slate-500">{help}</span>}
    </label>
  );
}

function TextInput(props) {
  return <input {...props} className={`w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-200 ${props.className || ""}`} />;
}

function SelectInput({ children, ...props }) {
  return <select {...props} className={`w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-200 ${props.className || ""}`}>{children}</select>;
}

function Button({ children, className = "", ...props }) {
  return <button {...props} className={`rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${className}`}>{children}</button>;
}

function Card({ children, className = "" }) {
  return <div className={`rounded-3xl border border-slate-100 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

function StatusBadge({ value }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge(value)}`}>{value}</span>;
}

function Modal({ title, children, onClose, width = "max-w-2xl" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className={`w-full ${width} max-h-[90vh] overflow-auto rounded-3xl bg-white p-5 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-slate-500 hover:bg-slate-100">닫기</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CategoryManager({ title, value, onChange, onClose }) {
  const [draft, setDraft] = useState(listToText(value));
  return (
    <Modal title={`${title} 카테고리 관리`} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">콤마(,)로 구분해서 입력하세요. 저장 후 해당 탭의 필터와 입력 선택 목록에 바로 반영됩니다.</p>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="h-36 w-full rounded-2xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-rose-200" />
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose} className="border bg-white">취소</Button>
        <Button onClick={() => { onChange(textToList(draft)); onClose(); }} className="bg-slate-900 text-white">저장</Button>
      </div>
    </Modal>
  );
}

export default function WeddingPlannerGoogleDriveExcelV3() {
  const [app, setApp] = useState(loadSaved);
  const [tab, setTab] = useState("대시보드");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ tasks: "전체", expenses: "전체", guests: "전체", vendors: "전체" });
  const [syncStatus, setSyncStatus] = useState("로컬 저장 모드입니다. Google Apps Script URL 설정 후 Drive 저장/불러오기를 사용할 수 있습니다.");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const autoSaveTimer = useRef(null);
  const didMount = useRef(false);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(app)), [app]);

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

  function updateSettings(nextSettings) {
    setApp((prev) => ({ ...prev, settings: { ...prev.settings, ...nextSettings } }));
  }

  function updateSection(section, nextList) {
    setApp((prev) => ({ ...prev, [section]: nextList }));
  }

  function getApiBase() {
    return app.settings.sheetApiUrl.trim();
  }

  function buildPayload(sourceApp = app) {
    return { ...sourceApp, savedAt: new Date().toISOString() };
  }

  async function saveToDrive(manual = true) {
    if (!getApiBase()) {
      if (manual) setSyncStatus("Google Apps Script Web App URL을 먼저 입력하세요.");
      return;
    }
    if (manual) setBusy(true);
    setSyncStatus(manual ? "Google Drive에 저장 중..." : "자동 저장 중...");
    try {
      const body = { action: "save", secret: app.settings.apiSecret, payload: buildPayload() };
      await fetch(getApiBase(), { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
      const now = new Date().toLocaleString("ko-KR");
      updateSettings({ lastSavedAt: now });
      setSyncStatus(`${manual ? "Drive 저장 요청 완료" : "자동 저장 요청 완료"}: ${now} / Drive 파일에서 확인 가능합니다.`);
    } catch (err) {
      setSyncStatus(`Drive 저장 요청 실패: ${err.message}`);
    } finally {
      if (manual) setBusy(false);
    }
  }

  async function loadFromDrive() {
    if (!getApiBase()) {
      setSyncStatus("Google Apps Script Web App URL을 먼저 입력하세요.");
      return;
    }
    setBusy(true);
    setSyncStatus("Google Drive에서 불러오는 중...");
    try {
      const url = `${getApiBase()}?action=load&secret=${encodeURIComponent(app.settings.apiSecret || "")}`;
      const result = await jsonp(url);
      if (!result || !result.ok || !result.payload) throw new Error(result?.error || "저장된 데이터가 없습니다.");
      const loaded = { ...DEFAULT_APP, ...result.payload, settings: { ...DEFAULT_APP.settings, ...(result.payload.settings || {}) } };
      loaded.settings.lastLoadedAt = new Date().toLocaleString("ko-KR");
      setApp(loaded);
      setSyncStatus(`불러오기 완료: ${loaded.settings.lastLoadedAt}`);
    } catch (err) {
      setSyncStatus(`불러오기 실패: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (!app.settings.autoDriveSave || !app.settings.sheetApiUrl || !app.settings.apiSecret) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveToDrive(false), 1600);
    return () => clearTimeout(autoSaveTimer.current);
  }, [app.tasks, app.expenses, app.guests, app.vendors, app.timeline, app.settings.weddingDate]);

  function filtered(section, fields, filterField, filterKey) {
    const q = query.trim().toLowerCase();
    const filterValue = filters[filterKey];
    return app[section].filter((row) => {
      const matchText = !q || fields.some((field) => String(row[field] ?? "").toLowerCase().includes(q));
      const matchFilter = !filterField || filterValue === "전체" || row[filterField] === filterValue;
      return matchText && matchFilter;
    });
  }

  const taskRows = filtered("tasks", ["title", "category", "status", "owner", "memo"], "category", "tasks").sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const expenseRows = filtered("expenses", ["item", "category", "vendor", "memo"], "category", "expenses").sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const guestRows = filtered("guests", ["name", "side", "group", "invite", "rsvp", "memo"], "group", "guests").sort((a, b) => String(a.group).localeCompare(String(b.group), "ko") || String(a.name).localeCompare(String(b.name), "ko"));
  const vendorRows = filtered("vendors", ["name", "category", "contact", "manager", "memo"], "category", "vendors").sort((a, b) => new Date(a.balanceDate) - new Date(b.balanceDate));
  const timelineRows = app.timeline.filter((row) => !query.trim() || ["time", "title", "owner", "place", "memo"].some((field) => String(row[field] ?? "").toLowerCase().includes(query.toLowerCase()))).sort((a, b) => String(a.time).localeCompare(String(b.time)));

  function openForm(section, row = null) {
    const defaults = {
      tasks: { title: "", category: app.settings.taskCategories[0] || "본식", dueDate: "2026-12-31", status: app.settings.taskStatuses[0] || "미시작", owner: app.settings.owners[0] || "같이", memo: "" },
      expenses: { item: "", category: app.settings.expenseCategories[0] || "본식", total: 0, paidAmount: 0, deposit: 0, interimPayment: 0, finalPayment: 0, dueDate: "2026-12-31", vendor: "", memo: "" },
      guests: { name: "", side: "신랑", group: app.settings.guestGroups[0] || "친구", invite: "미발송", rsvp: "미정", count: 1, meal: "일반", memo: "" },
      vendors: { name: "", category: app.settings.vendorCategories[0] || "본식", contact: "", manager: "", contractDate: "2026-12-31", balanceDate: app.settings.weddingDate, amount: 0, status: "검토중", memo: "" },
      timeline: { time: "12:00", title: "", owner: app.settings.owners[0] || "성모", place: "", memo: "" },
    };
    setModal({ section, form: row ? { ...row } : defaults[section], isEdit: Boolean(row) });
  }

  function saveModalForm() {
    if (!modal) return;
    const { section, form, isEdit } = modal;
    const requiredKey = section === "expenses" ? "item" : section === "guests" || section === "vendors" ? "name" : "title";
    if (!String(form[requiredKey] || "").trim()) return alert("필수 항목을 입력하세요.");
    const clean = { ...form };
    if (section === "expenses") {
      clean.total = Number(clean.total || 0);
      clean.paidAmount = Number(clean.paidAmount || 0);
      clean.deposit = Number(clean.deposit || 0);
      clean.interimPayment = Number(clean.interimPayment || 0);
      clean.finalPayment = Number(clean.finalPayment || 0);
    }
    if (section === "guests") clean.count = Number(clean.count || 1);
    if (section === "vendors") clean.amount = Number(clean.amount || 0);
    const list = app[section];
    const nextList = isEdit ? list.map((item) => item.id === clean.id ? clean : item) : [...list, { ...clean, id: nextId(list) }];
    updateSection(section, nextList);
    setModal(null);
  }

  function requestDelete(section, row) {
    setPendingDelete({ section, row });
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    updateSection(pendingDelete.section, app[pendingDelete.section].filter((row) => row.id !== pendingDelete.row.id));
    setPendingDelete(null);
  }

  function exportJson() {
    download("wedding-planner-drive-excel-backup.json", JSON.stringify(buildPayload(), null, 2), "application/json;charset=utf-8");
  }

  function exportCsv() {
    download("wedding-tasks.csv", toCsv(app.tasks), "text/csv;charset=utf-8");
    setTimeout(() => download("wedding-expenses.csv", toCsv(app.expenses), "text/csv;charset=utf-8"), 150);
    setTimeout(() => download("wedding-guests.csv", toCsv(app.guests), "text/csv;charset=utf-8"), 300);
    setTimeout(() => download("wedding-vendors.csv", toCsv(app.vendors), "text/csv;charset=utf-8"), 450);
    setTimeout(() => download("wedding-timeline.csv", toCsv(app.timeline), "text/csv;charset=utf-8"), 600);
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      setApp({ ...DEFAULT_APP, ...imported, settings: { ...DEFAULT_APP.settings, ...(imported.settings || {}) } });
      setSyncStatus("JSON 백업을 불러왔습니다. Drive에 반영하려면 Drive 저장을 누르세요.");
    } catch {
      setSyncStatus("JSON 파일 형식이 올바르지 않습니다.");
    }
    event.target.value = "";
  }

  function categoryToolbar(key, options, title) {
    return (
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="검색" className="md:max-w-sm" />
          <div className="flex flex-wrap items-center gap-2">
            {["전체", ...options].map((item) => (
              <button key={item} onClick={() => setFilters((prev) => ({ ...prev, [key]: item }))} className={`rounded-full px-3 py-1.5 text-sm ${filters[key] === item ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"}`}>{item}</button>
            ))}
            <Button onClick={() => setCategoryModal({ key, title })} className="border border-rose-200 bg-white text-rose-600">카테고리 관리</Button>
          </div>
        </div>
      </Card>
    );
  }

  function renderModalForm() {
    if (!modal) return null;
    const f = modal.form;
    const setF = (patch) => setModal((prev) => ({ ...prev, form: { ...prev.form, ...patch } }));

    const titles = { tasks: "일정", expenses: "비용", guests: "하객", vendors: "업체", timeline: "타임라인" };

    return (
      <Modal title={`${titles[modal.section]} ${modal.isEdit ? "수정" : "추가"}`} onClose={() => setModal(null)}>
        {modal.section === "tasks" && <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="할 일"><TextInput value={f.title} onChange={(e) => setF({ title: e.target.value })} /></Field>
          <Field label="카테고리"><SelectInput value={f.category} onChange={(e) => setF({ category: e.target.value })}>{app.settings.taskCategories.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field>
          <Field label="마감일"><TextInput type="date" value={f.dueDate} onChange={(e) => setF({ dueDate: e.target.value })} /></Field>
          <Field label="상태"><SelectInput value={f.status} onChange={(e) => setF({ status: e.target.value })}>{app.settings.taskStatuses.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field>
          <Field label="담당자"><SelectInput value={f.owner} onChange={(e) => setF({ owner: e.target.value })}>{app.settings.owners.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field>
          <Field label="메모"><TextInput value={f.memo} onChange={(e) => setF({ memo: e.target.value })} /></Field>
        </div>}

        {modal.section === "expenses" && <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="비용 항목"><TextInput value={f.item} onChange={(e) => setF({ item: e.target.value })} placeholder="예: 웨딩홀, 예복, 청첩장" /></Field>
          <Field label="카테고리"><SelectInput value={f.category} onChange={(e) => setF({ category: e.target.value })}>{app.settings.expenseCategories.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field>
          <Field label="총 금액" help="해당 항목의 전체 계약/예상 금액입니다."><TextInput type="number" value={f.total} onChange={(e) => setF({ total: e.target.value })} /></Field>
          <Field label="결제한 금액" help="현재까지 실제 결제한 누적 금액입니다."><TextInput type="number" value={f.paidAmount} onChange={(e) => setF({ paidAmount: e.target.value })} /></Field>
          <Field label="계약금" help="계약 시 선결제한 금액입니다."><TextInput type="number" value={f.deposit} onChange={(e) => setF({ deposit: e.target.value })} /></Field>
          <Field label="중도금" help="중간 결제 예정 또는 결제한 금액입니다."><TextInput type="number" value={f.interimPayment} onChange={(e) => setF({ interimPayment: e.target.value })} /></Field>
          <Field label="잔금" help="최종 납부해야 할 금액입니다."><TextInput type="number" value={f.finalPayment} onChange={(e) => setF({ finalPayment: e.target.value })} /></Field>
          <Field label="잔금/마감일"><TextInput type="date" value={f.dueDate} onChange={(e) => setF({ dueDate: e.target.value })} /></Field>
          <Field label="업체명"><TextInput value={f.vendor} onChange={(e) => setF({ vendor: e.target.value })} /></Field>
          <Field label="남은 금액"><TextInput readOnly value={formatMoney(Math.max(Number(f.total || 0) - Number(f.paidAmount || 0), 0))} /></Field>
          <Field label="메모"><TextInput value={f.memo} onChange={(e) => setF({ memo: e.target.value })} /></Field>
        </div>}

        {modal.section === "guests" && <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="이름/그룹명"><TextInput value={f.name} onChange={(e) => setF({ name: e.target.value })} /></Field>
          <Field label="구분"><SelectInput value={f.side} onChange={(e) => setF({ side: e.target.value })}><option>신랑</option><option>신부</option><option>양가</option></SelectInput></Field>
          <Field label="그룹"><SelectInput value={f.group} onChange={(e) => setF({ group: e.target.value })}>{app.settings.guestGroups.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field>
          <Field label="인원"><TextInput type="number" value={f.count} onChange={(e) => setF({ count: e.target.value })} /></Field>
          <Field label="청첩장"><SelectInput value={f.invite} onChange={(e) => setF({ invite: e.target.value })}>{INVITE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field>
          <Field label="참석 여부"><SelectInput value={f.rsvp} onChange={(e) => setF({ rsvp: e.target.value })}>{RSVP_OPTIONS.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field>
          <Field label="식사"><TextInput value={f.meal} onChange={(e) => setF({ meal: e.target.value })} /></Field>
          <Field label="메모"><TextInput value={f.memo} onChange={(e) => setF({ memo: e.target.value })} /></Field>
        </div>}

        {modal.section === "vendors" && <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="업체명"><TextInput value={f.name} onChange={(e) => setF({ name: e.target.value })} /></Field>
          <Field label="카테고리"><SelectInput value={f.category} onChange={(e) => setF({ category: e.target.value })}>{app.settings.vendorCategories.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field>
          <Field label="연락처"><TextInput value={f.contact} onChange={(e) => setF({ contact: e.target.value })} /></Field>
          <Field label="담당자"><TextInput value={f.manager} onChange={(e) => setF({ manager: e.target.value })} /></Field>
          <Field label="계약일"><TextInput type="date" value={f.contractDate} onChange={(e) => setF({ contractDate: e.target.value })} /></Field>
          <Field label="잔금일"><TextInput type="date" value={f.balanceDate} onChange={(e) => setF({ balanceDate: e.target.value })} /></Field>
          <Field label="계약 금액"><TextInput type="number" value={f.amount} onChange={(e) => setF({ amount: e.target.value })} /></Field>
          <Field label="상태"><SelectInput value={f.status} onChange={(e) => setF({ status: e.target.value })}>{VENDOR_STATUS.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field>
          <Field label="메모"><TextInput value={f.memo} onChange={(e) => setF({ memo: e.target.value })} /></Field>
        </div>}

        {modal.section === "timeline" && <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="시간"><TextInput type="time" value={f.time} onChange={(e) => setF({ time: e.target.value })} /></Field>
          <Field label="일정명"><TextInput value={f.title} onChange={(e) => setF({ title: e.target.value })} /></Field>
          <Field label="담당자"><SelectInput value={f.owner} onChange={(e) => setF({ owner: e.target.value })}>{app.settings.owners.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field>
          <Field label="장소"><TextInput value={f.place} onChange={(e) => setF({ place: e.target.value })} /></Field>
          <Field label="메모"><TextInput value={f.memo} onChange={(e) => setF({ memo: e.target.value })} /></Field>
        </div>}

        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setModal(null)} className="border bg-white">취소</Button>
          <Button onClick={saveModalForm} className="bg-slate-900 text-white">저장</Button>
        </div>
      </Modal>
    );
  }

  function updateCategoryList(key, nextList) {
    const map = { tasks: "taskCategories", expenses: "expenseCategories", guests: "guestGroups", vendors: "vendorCategories" };
    const settingKey = map[key];
    updateSettings({ [settingKey]: nextList });
    setFilters((prev) => ({ ...prev, [key]: "전체" }));
  }

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
        <Card className="border-rose-100 bg-white/90">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-rose-500">Wedding Planner · Google Drive Excel Sync</p>
              <div className="flex flex-wrap items-end gap-3">
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">결혼 준비 통합 관리 앱</h1>
                <span className="rounded-2xl bg-rose-100 px-4 py-2 text-lg font-bold text-rose-700">D-{daysUntil(app.settings.weddingDate)}</span>
              </div>
              <p className="mt-2 text-slate-500">Google Drive의 Excel 파일을 저장/백업 파일로 사용하고, 여러 사람이 같은 데이터를 불러와 최신화할 수 있습니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveToDrive(true)} disabled={busy} className="bg-slate-900 text-white">Drive 저장</Button>
              <Button onClick={loadFromDrive} disabled={busy} className="border bg-white">Drive 불러오기</Button>
              <Button onClick={exportJson} className="border bg-white">JSON</Button>
              <Button onClick={exportCsv} className="border bg-white">CSV</Button>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">상태: {syncStatus}</div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          {statData.map(([label, value]) => <Card key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></Card>)}
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
          {TABS.map((item) => <button key={item} onClick={() => { setTab(item); setQuery(""); }} className={`rounded-2xl px-3 py-3 text-sm font-semibold ${tab === item ? "bg-slate-900 text-white shadow" : "border border-slate-100 bg-white text-slate-600"}`}>{item}</button>)}
        </div>

        {tab === "대시보드" && <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2"><h2 className="mb-4 text-xl font-bold">임박한 일정</h2><div className="space-y-3">{app.tasks.filter((x) => x.status !== "완료").sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 7).map((x) => <div key={x.id} className="flex justify-between gap-3 rounded-2xl border bg-white p-4"><div><p className="font-semibold">{x.title}</p><p className="text-sm text-slate-500">{x.category} · {x.dueDate} · 담당 {x.owner} · {daysUntil(x.dueDate) >= 0 ? `D-${daysUntil(x.dueDate)}` : `${Math.abs(daysUntil(x.dueDate))}일 지남`}</p></div><StatusBadge value={x.status} /></div>)}</div></Card>
          <Card><h2 className="mb-4 text-xl font-bold">비용 요약</h2><div className="space-y-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">총 금액</p><p className="text-2xl font-bold">{formatMoney(stats.totalCost)}</p></div><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-sm text-slate-500">결제한 금액</p><p className="text-2xl font-bold">{formatMoney(stats.paidCost)}</p></div><div className="rounded-2xl bg-rose-50 p-4"><p className="text-sm text-slate-500">남은 금액</p><p className="text-2xl font-bold">{formatMoney(stats.remainingCost)}</p></div></div></Card>
        </div>}

        {tab === "일정" && <>{categoryToolbar("tasks", app.settings.taskCategories, "일정")}<Card><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">일정/체크리스트</h2><Button onClick={() => openForm("tasks")} className="bg-slate-900 text-white">일정 추가</Button></div><div className="space-y-3">{taskRows.map((x) => <div key={x.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between gap-3"><div><div className="mb-2 flex flex-wrap gap-2"><StatusBadge value={x.status} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.category}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.owner}</span></div><p className="font-semibold">{x.title}</p><p className="text-sm text-slate-500">마감 {x.dueDate} · {daysUntil(x.dueDate) >= 0 ? `D-${daysUntil(x.dueDate)}` : `${Math.abs(daysUntil(x.dueDate))}일 지남`}</p>{x.memo && <p className="text-sm text-slate-500">{x.memo}</p>}</div><div className="flex gap-1"><button onClick={() => openForm("tasks", x)} className="rounded-xl p-2 hover:bg-slate-100">수정</button><button onClick={() => requestDelete("tasks", x)} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50">삭제</button></div></div></div>)}</div></Card></>}

        {tab === "비용" && <>{categoryToolbar("expenses", app.settings.expenseCategories, "비용")}<Card><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">비용 관리</h2><Button onClick={() => openForm("expenses")} className="bg-slate-900 text-white">비용 추가</Button></div><div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">총 금액</p><p className="text-2xl font-bold">{formatMoney(stats.totalCost)}</p></div><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-sm text-slate-500">결제한 금액</p><p className="text-2xl font-bold">{formatMoney(stats.paidCost)}</p></div><div className="rounded-2xl bg-rose-50 p-4"><p className="text-sm text-slate-500">남은 금액</p><p className="text-2xl font-bold">{formatMoney(stats.remainingCost)}</p></div></div><div className="space-y-3">{expenseRows.map((x) => { const left = Math.max(Number(x.total || 0) - Number(x.paidAmount || 0), 0); return <div key={x.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between gap-3"><div><div className="mb-2 flex flex-wrap gap-2"><StatusBadge value={left === 0 && Number(x.total || 0) > 0 ? "결제완료" : "미결제"} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.category}</span></div><p className="font-semibold">{x.item}</p><p className="text-sm text-slate-500">총 {formatMoney(x.total)} · 결제 {formatMoney(x.paidAmount)} · 남음 {formatMoney(left)}</p><p className="text-sm text-slate-500">계약금 {formatMoney(x.deposit)} · 중도금 {formatMoney(x.interimPayment)} · 잔금 {formatMoney(x.finalPayment)}</p><p className="text-sm text-slate-500">잔금/마감 {x.dueDate} · {daysUntil(x.dueDate) >= 0 ? `D-${daysUntil(x.dueDate)}` : `${Math.abs(daysUntil(x.dueDate))}일 지남`}</p>{x.vendor && <p className="text-sm text-slate-500">업체 {x.vendor}</p>}{x.memo && <p className="text-sm text-slate-500">{x.memo}</p>}</div><div className="flex gap-1"><button onClick={() => openForm("expenses", x)} className="rounded-xl p-2 hover:bg-slate-100">수정</button><button onClick={() => requestDelete("expenses", x)} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50">삭제</button></div></div></div>})}</div></Card></>}

        {tab === "하객" && <>{categoryToolbar("guests", app.settings.guestGroups, "하객")}<Card><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">하객/청첩장 관리</h2><Button onClick={() => openForm("guests")} className="bg-slate-900 text-white">하객 추가</Button></div><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{guestRows.map((x) => <div key={x.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between gap-3"><div><div className="mb-2 flex flex-wrap gap-2"><StatusBadge value={x.rsvp} /><StatusBadge value={x.invite} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.side}</span></div><p className="font-semibold">{x.name}</p><p className="text-sm text-slate-500">{x.group} · {x.count}명 · 식사 {x.meal}</p>{x.memo && <p className="text-sm text-slate-500">{x.memo}</p>}</div><div className="flex gap-1"><button onClick={() => openForm("guests", x)} className="rounded-xl p-2 hover:bg-slate-100">수정</button><button onClick={() => requestDelete("guests", x)} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50">삭제</button></div></div></div>)}</div></Card></>}

        {tab === "업체" && <>{categoryToolbar("vendors", app.settings.vendorCategories, "업체")}<Card><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">업체/연락처 관리</h2><Button onClick={() => openForm("vendors")} className="bg-slate-900 text-white">업체 추가</Button></div><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{vendorRows.map((x) => <div key={x.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between gap-3"><div><div className="mb-2 flex flex-wrap gap-2"><StatusBadge value={x.status} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.category}</span></div><p className="font-semibold">{x.name}</p><p className="text-sm text-slate-500">담당 {x.manager || "-"} · 연락처 {x.contact || "-"}</p><p className="text-sm text-slate-500">잔금 {x.balanceDate} · {daysUntil(x.balanceDate) >= 0 ? `D-${daysUntil(x.balanceDate)}` : `${Math.abs(daysUntil(x.balanceDate))}일 지남`}</p><p className="text-sm text-slate-500">금액 {formatMoney(x.amount)}</p>{x.memo && <p className="text-sm text-slate-500">{x.memo}</p>}</div><div className="flex gap-1"><button onClick={() => openForm("vendors", x)} className="rounded-xl p-2 hover:bg-slate-100">수정</button><button onClick={() => requestDelete("vendors", x)} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50">삭제</button></div></div></div>)}</div></Card></>}

        {tab === "타임라인" && <Card><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">본식 당일 타임라인</h2><Button onClick={() => openForm("timeline")} className="bg-slate-900 text-white">타임라인 추가</Button></div><div className="relative ml-4 space-y-4 border-l-2 border-rose-200">{timelineRows.map((x) => <div key={x.id} className="relative pl-6"><div className="absolute -left-[9px] top-4 h-4 w-4 rounded-full bg-rose-500" /><div className="rounded-2xl border bg-white p-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-bold text-rose-500">{x.time}</p><p className="font-semibold">{x.title}</p><p className="text-sm text-slate-500">담당 {x.owner} · 장소 {x.place || "-"}</p>{x.memo && <p className="text-sm text-slate-500">{x.memo}</p>}</div><div className="flex gap-1"><button onClick={() => openForm("timeline", x)} className="rounded-xl p-2 hover:bg-slate-100">수정</button><button onClick={() => requestDelete("timeline", x)} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50">삭제</button></div></div></div></div>)}</div></Card>}

        {tab === "설정" && <Card><h2 className="mb-4 text-xl font-bold">설정 / Google Drive Excel 저장소</h2><div className="space-y-5"><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><Field label="결혼 날짜"><TextInput type="date" value={app.settings.weddingDate} onChange={(e) => updateSettings({ weddingDate: e.target.value })} /></Field><Field label="D-day"><TextInput readOnly value={`D-${daysUntil(app.settings.weddingDate)}`} /></Field><Field label="Google Apps Script Web App URL"><TextInput value={app.settings.sheetApiUrl} onChange={(e) => updateSettings({ sheetApiUrl: e.target.value })} placeholder="https://script.google.com/macros/s/.../exec" /></Field><Field label="공유 비밀키"><TextInput value={app.settings.apiSecret} onChange={(e) => updateSettings({ apiSecret: e.target.value })} /></Field><label className="flex items-center gap-2 rounded-2xl border p-3 md:col-span-2"><input type="checkbox" checked={app.settings.autoDriveSave} onChange={(e) => updateSettings({ autoDriveSave: e.target.checked })} /> 변경 후 자동으로 Drive 저장</label></div><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><Field label="담당자 목록"><TextInput value={listToText(app.settings.owners)} onChange={(e) => updateSettings({ owners: textToList(e.target.value) })} /></Field><Field label="일정 상태 목록"><TextInput value={listToText(app.settings.taskStatuses)} onChange={(e) => updateSettings({ taskStatuses: textToList(e.target.value) })} /></Field></div><div className="flex flex-wrap gap-2"><Button onClick={() => saveToDrive(true)} disabled={busy} className="bg-slate-900 text-white">Drive 저장</Button><Button onClick={loadFromDrive} disabled={busy} className="border bg-white">Drive 불러오기</Button><label className="cursor-pointer rounded-xl border bg-white px-3 py-2 text-sm font-semibold">JSON 불러오기<input type="file" accept="application/json" onChange={importJson} className="hidden" /></label><Button onClick={() => { if (confirm("샘플 데이터로 초기화할까요?")) setApp(DEFAULT_APP); }} className="border border-rose-200 bg-white text-rose-600">샘플 초기화</Button></div><div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">마지막 불러오기: {app.settings.lastLoadedAt || "-"}<br />마지막 저장: {app.settings.lastSavedAt || "-"}<br />{syncStatus}</div></div></Card>}

        {renderModalForm()}

        {categoryModal && <CategoryManager title={categoryModal.title} value={categoryModal.key === "tasks" ? app.settings.taskCategories : categoryModal.key === "expenses" ? app.settings.expenseCategories : categoryModal.key === "guests" ? app.settings.guestGroups : app.settings.vendorCategories} onChange={(next) => updateCategoryList(categoryModal.key, next)} onClose={() => setCategoryModal(null)} />}

        {pendingDelete && <Modal title="삭제 확인" onClose={() => setPendingDelete(null)} width="max-w-md"><p className="text-slate-700">정말 삭제할까요?</p><p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">{pendingDelete.row.title || pendingDelete.row.item || pendingDelete.row.name}</p><div className="mt-5 flex justify-end gap-2"><Button onClick={() => setPendingDelete(null)} className="border bg-white">취소</Button><Button onClick={confirmDelete} className="bg-rose-600 text-white">삭제</Button></div></Modal>}
      </div>
    </div>
  );
}