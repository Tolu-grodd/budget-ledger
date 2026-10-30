import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft, ChevronRight, Plus, Trash2, X, Settings2,
  Download, ArrowUpRight, ArrowDownRight, Wallet, PiggyBank, Calendar,
  Cloud, CloudOff, LogOut, Download as DownloadIcon, MoreVertical, Check,
  Copy, Search, CalendarDays, Target,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";
import { useCloudDoc } from "./useCloudDoc.js";

/* ----------------------------- constants ------------------------------ */

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const GROUP_COLORS = {
  "Housing": "#3B5A6B",
  "Transport": "#8A6D3B",
  "Health & Fitness": "#4C7A5E",
  "Giving": "#8C5383",
  "Daily Living": "#B5502B",
  "Entertainment": "#3B6B8A",
  "Savings & Investments": "#2F6B4F",
  "Debt & Obligations": "#7A3B3B",
  "Miscellaneous": "#6B6357",
};
const GROUP_ORDER = Object.keys(GROUP_COLORS);

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_CATEGORIES = [
  { id: uid(), name: "Salary / Wages", group: null, type: "income", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },
  { id: uid(), name: "Other Income", group: null, type: "income", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },

  { id: uid(), name: "Rent / Mortgage", group: "Housing", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },
  { id: uid(), name: "Electricity", group: "Housing", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },
  { id: uid(), name: "Gas", group: "Housing", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },
  { id: uid(), name: "Water & Waste", group: "Housing", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },
  { id: uid(), name: "Phone", group: "Housing", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },
  { id: uid(), name: "Internet", group: "Housing", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },

  { id: uid(), name: "Fuel", group: "Transport", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },
  { id: uid(), name: "Bus / Taxi / Ride-hail", group: "Transport", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },

  { id: uid(), name: "Health Insurance", group: "Health & Fitness", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },
  { id: uid(), name: "Gym", group: "Health & Fitness", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },

  { id: uid(), name: "Tithe / Donations", group: "Giving", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },

  { id: uid(), name: "Groceries", group: "Daily Living", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },
  { id: uid(), name: "Salon / Barber", group: "Daily Living", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },

  { id: uid(), name: "Subscriptions", group: "Entertainment", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },

  { id: uid(), name: "Emergency Fund", group: "Savings & Investments", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },

  { id: uid(), name: "Other", group: "Miscellaneous", type: "expense", defaultAmount: 0, createdAt: null, archivedFrom: null, plannedAmount: 0, goalTarget: 0 },
];

const DEFAULT_SETTINGS = {
  rolloverMonthly: false,
  rolloverYearly: false,
  startingBalance: 0,
  anchorYear: new Date().getFullYear(),
  anchorMonth: new Date().getMonth(),
  theme: "light",
};

const DEFAULT_STATE = {
  categories: DEFAULT_CATEGORIES,
  entries: {},
  settings: DEFAULT_SETTINGS,
  customGroups: [],
  savingsGoals: [],
};

const pad2 = (n) => String(n).padStart(2, "0");
const monthKey = (y, m) => `${y}-${pad2(m + 1)}`;
const keyToLabel = (mk) => `${MONTHS_SHORT[parseInt(mk.slice(5, 7), 10) - 1]} ${mk.slice(0, 4)}`;
const fmt = (n) => "₦" + Math.round(Number(n) || 0).toLocaleString("en-NG");
const fmtCompact = (n) => {
  const v = Number(n) || 0;
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1e6) return sign + "₦" + (a / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return sign + "₦" + (a / 1e3).toFixed(1) + "k";
  return sign + "₦" + a;
};

// A category is visible in a given month if it existed by then (createdAt)
// and hasn't been deleted as of that month yet (archivedFrom). Both being
// null/undefined means "always visible" — keeps old saved data working
// without any migration.
const isCatActiveInMonth = (cat, monthK) =>
  (!cat.createdAt || monthK >= cat.createdAt) &&
  (!cat.archivedFrom || monthK < cat.archivedFrom);

const activeCategoriesFor = (categories, monthK) =>
  categories.filter((c) => isCatActiveInMonth(c, monthK));

const monthsBetween = (startKey, endKey) => {
  const [sy, sm] = startKey.split("-").map(Number);
  const [ey, em] = endKey.split("-").map(Number);
  const out = [];
  let y = sy, m = sm - 1;
  const endIndex = ey * 12 + (em - 1);
  let guard = 0;
  while (y * 12 + m <= endIndex && guard < 2400) {
    out.push(monthKey(y, m));
    m++;
    if (m > 11) { m = 0; y++; }
    guard++;
  }
  return out;
};

function computeMonthTotals(categories, entries, monthK) {
  let income = 0, expense = 0;
  const byGroup = {};
  activeCategoriesFor(categories, monthK).forEach((c) => {
    const m = entries[monthK];
    const amt = (m && Object.prototype.hasOwnProperty.call(m, c.id)) ? m[c.id] : c.defaultAmount;
    if (c.type === "income") income += amt;
    else {
      expense += amt;
      byGroup[c.group] = (byGroup[c.group] || 0) + amt;
    }
  });
  return { income, expense, net: income - expense, byGroup };
}

function computeSeriesUpTo(categories, entries, settings, targetY, targetM) {
  const results = {};
  let { anchorYear: y, anchorMonth: m } = settings;
  let running = Number(settings.startingBalance) || 0;
  let guard = 0;
  const targetIndex = targetY * 12 + targetM;
  let curIndex = y * 12 + m;

  if (targetIndex < curIndex) {
    y = targetY; m = targetM; curIndex = targetIndex; running = Number(settings.startingBalance) || 0;
  }

  while (curIndex <= targetIndex && guard < 2400) {
    guard++;
    const mk = monthKey(y, m);
    const t = computeMonthTotals(categories, entries, mk);
    const startBalance = settings.rolloverMonthly ? running : 0;
    const endBalance = startBalance + t.net;
    results[mk] = { ...t, startBalance, endBalance };
    running = settings.rolloverMonthly ? endBalance : 0;
    m++;
    if (m > 11) {
      m = 0; y++;
      if (!settings.rolloverYearly) running = 0;
    }
    curIndex = y * 12 + m;
  }
  return results;
}

/* ------------------------------ component ------------------------------ */

export default function BudgetLedger({ uid: userId, userEmail, onSignOut, installPrompt, onInstall }) {
  const now = new Date();
  const [state, updateState, ready] = useCloudDoc(userId, DEFAULT_STATE);
  const { categories, entries, settings, customGroups } = state;
  const savingsGoals = state.savingsGoals || [];

  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const [showSettings, setShowSettings] = useState(false);
  const [showRangeDelete, setShowRangeDelete] = useState(false);
  const [showYearReport, setShowYearReport] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSavings, setShowSavings] = useState(false);
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const [addRowFor, setAddRowFor] = useState(null); // 'income' | group name | null
  const [newName, setNewName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [online, setOnline] = useState(navigator.onLine);
  const [openMenuId, setOpenMenuId] = useState(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (addRowFor && nameInputRef.current) nameInputRef.current.focus();
  }, [addRowFor]);

  // Theme is applied at the <body> level (not just this component's root) so
  // that portaled elements (the row menu, which renders outside this tree)
  // pick up the same CSS variables too.
  useEffect(() => {
    const dark = settings.theme === "dark";
    document.body.classList.toggle("bl-theme-dark", dark);
    document.body.classList.toggle("bl-theme-light", !dark);
  }, [settings.theme]);

  const setCategories = (fn) => updateState((prev) => ({ ...prev, categories: typeof fn === "function" ? fn(prev.categories) : fn }));
  const setEntries = (fn) => updateState((prev) => ({ ...prev, entries: typeof fn === "function" ? fn(prev.entries) : fn }));
  const setSettings = (fn) => updateState((prev) => ({ ...prev, settings: typeof fn === "function" ? fn(prev.settings) : fn }));
  const setCustomGroups = (fn) => updateState((prev) => ({ ...prev, customGroups: typeof fn === "function" ? fn(prev.customGroups) : fn }));
  const setSavingsGoals = (fn) => updateState((prev) => ({ ...prev, savingsGoals: typeof fn === "function" ? fn(prev.savingsGoals || []) : fn }));

  const allGroups = useMemo(() => {
    const extra = (customGroups || []).filter((g) => !GROUP_ORDER.includes(g));
    return [...GROUP_ORDER, ...extra];
  }, [customGroups]);

  const key = monthKey(cursor.y, cursor.m);

  const getAmount = useCallback(
    (catId, monthK) => {
      const m = entries[monthK];
      if (m && Object.prototype.hasOwnProperty.call(m, catId)) return m[catId];
      const cat = categories.find((c) => c.id === catId);
      return cat ? cat.defaultAmount : 0;
    },
    [entries, categories]
  );

  const setAmount = (catId, monthK, value) => {
    setEntries((prev) => ({
      ...prev,
      [monthK]: { ...(prev[monthK] || {}), [catId]: value === "" ? 0 : Number(value) },
    }));
  };

  const monthTotals = useCallback((monthK) => computeMonthTotals(categories, entries, monthK), [categories, entries]);

  const balanceSeries = useMemo(
    () => computeSeriesUpTo(categories, entries, settings, cursor.y, cursor.m),
    [categories, entries, settings, cursor]
  );

  const current = balanceSeries[key] || monthTotals(key);

  const trend = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      let y = cursor.y, m = cursor.m - i;
      while (m < 0) { m += 12; y -= 1; }
      const mk = monthKey(y, m);
      const t = monthTotals(mk);
      out.push({ key: mk, label: MONTHS_SHORT[m], net: t.net, income: t.income, expense: t.expense });
    }
    return out;
  }, [cursor, monthTotals]);

  const pieData = useMemo(() => {
    return Object.entries(current.byGroup || {})
      .filter(([, v]) => v > 0)
      .map(([g, v]) => ({ name: g, value: v }));
  }, [current]);

  const visibleCategories = useMemo(() => activeCategoriesFor(categories, key), [categories, key]);
  const incomeCats = visibleCategories.filter((c) => c.type === "income");
  const expenseByGroup = allGroups.map((g) => ({
    group: g,
    cats: visibleCategories.filter((c) => c.type === "expense" && c.group === g),
  })).filter((g) => g.cats.length > 0 || (customGroups || []).includes(g.group));

  const savingsRate = current.income > 0 ? Math.round((current.net / current.income) * 100) : 0;
  const topGroup = pieData.slice().sort((a, b) => b.value - a.value)[0];
  const savingsGoalCats = visibleCategories.filter((c) => c.goalTarget > 0);

  /* --------------------------- actions ---------------------------- */

  const goMonth = (delta) => {
    setCursor((prev) => {
      let m = prev.m + delta, y = prev.y;
      while (m < 0) { m += 12; y -= 1; }
      while (m > 11) { m -= 12; y += 1; }
      return { y, m };
    });
  };

  const openPicker = () => { setPickerYear(cursor.y); setShowPicker(true); };
  const jumpTo = (m) => { setCursor({ y: pickerYear, m }); setShowPicker(false); };
  const jumpToday = () => { setCursor({ y: now.getFullYear(), m: now.getMonth() }); setShowPicker(false); };

  // "Delete" only stops a category from appearing from this month onward —
  // it stays intact (and part of past totals/exports) for every month before it.
  const archiveCategory = (id) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, archivedFrom: key } : c)));
    setOpenMenuId(null);
  };

  const setCategoryDefault = (id) => {
    const amt = getAmount(id, key);
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, defaultAmount: amt } : c)));
    setOpenMenuId(null);
  };

  const setCategoryPlanned = (id) => {
    const cat = categories.find((c) => c.id === id);
    const cur = cat && cat.plannedAmount ? cat.plannedAmount : "";
    const input = prompt(`Monthly budget target for "${cat ? cat.name : ""}" (₦). Leave blank or 0 to remove:`, cur);
    setOpenMenuId(null);
    if (input === null) return;
    const val = Number(input) || 0;
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, plannedAmount: val } : c)));
  };

  const setCategoryGoal = (id) => {
    const cat = categories.find((c) => c.id === id);
    const cur = cat && cat.goalTarget ? cat.goalTarget : "";
    const input = prompt(`Savings goal target for "${cat ? cat.name : ""}" (₦). Leave blank or 0 to remove:`, cur);
    setOpenMenuId(null);
    if (input === null) return;
    const val = Number(input) || 0;
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, goalTarget: val } : c)));
  };

  const commitAddRow = () => {
    if (!newName.trim()) { setAddRowFor(null); return; }
    const isIncome = addRowFor === "income";
    setCategories((prev) => [
      ...prev,
      {
        id: uid(),
        name: newName.trim(),
        group: isIncome ? null : addRowFor,
        type: isIncome ? "income" : "expense",
        defaultAmount: 0,
        createdAt: key,
        archivedFrom: null,
        plannedAmount: 0,
        goalTarget: 0,
      },
    ]);
    setNewName("");
    setAddRowFor(null);
  };

  const commitAddGroup = () => {
    const name = newGroupName.trim();
    if (name && !allGroups.includes(name)) setCustomGroups((prev) => [...prev, name]);
    setNewGroupName("");
    setAddingGroup(false);
  };

  const toggleCollapse = (g) => setCollapsed((prev) => ({ ...prev, [g]: !prev[g] }));

  const copyLastMonth = () => {
    let py = cursor.y, pm = cursor.m - 1;
    if (pm < 0) { pm = 11; py -= 1; }
    const prevKey = monthKey(py, pm);
    const prevEntries = entries[prevKey];
    if (!prevEntries || Object.keys(prevEntries).length === 0) {
      alert(`No entries recorded for ${keyToLabel(prevKey)} to copy.`);
      return;
    }
    if (entries[key] && Object.keys(entries[key]).length > 0) {
      if (!confirm(`${keyToLabel(key)} already has entered values. Overwrite them with ${keyToLabel(prevKey)}'s amounts?`)) return;
    }
    setEntries((prev) => ({ ...prev, [key]: { ...prevEntries } }));
  };

  const cumulativeForCategory = (catId) => {
    let total = 0;
    Object.keys(entries).forEach((mk) => {
      if (mk <= key && entries[mk] && Object.prototype.hasOwnProperty.call(entries[mk], catId)) {
        total += entries[mk][catId];
      }
    });
    return total;
  };

  const exportCSV = () => {
    const rows = [["Type", "Group", "Category", "Month", "Amount"]];
    Object.keys(entries).sort().forEach((mk) => {
      activeCategoriesFor(categories, mk).forEach((c) => {
        const amt = getAmount(c.id, mk);
        rows.push([c.type, c.group || "", c.name, mk, amt]);
      });
    });
    if (!entries[key]) {
      activeCategoriesFor(categories, key).forEach((c) => rows.push([c.type, c.group || "", c.name, key, getAmount(c.id, key)]));
    }
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `budget-${key}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearAllValues = () => {
    updateState((prev) => ({ ...prev, entries: {} }));
  };

  const deleteRange = (monthKeys, mode) => {
    updateState((prev) => {
      const nextEntries = { ...prev.entries };
      if (mode === "values") {
        monthKeys.forEach((mk) => { delete nextEntries[mk]; });
      } else {
        monthKeys.forEach((mk) => {
          const zeroed = {};
          activeCategoriesFor(prev.categories, mk).forEach((c) => { zeroed[c.id] = 0; });
          nextEntries[mk] = zeroed;
        });
      }
      return { ...prev, entries: nextEntries };
    });
  };

  const resetAll = () => {
    updateState((prev) => ({
      categories: DEFAULT_CATEGORIES,
      entries: {},
      customGroups: [],
      settings: { ...DEFAULT_SETTINGS, theme: prev.settings.theme, anchorYear: now.getFullYear(), anchorMonth: now.getMonth() },
    }));
  };

  if (!ready) {
    return (
      <div style={S.page}>
        <div style={S.loadingWrap}>
          <div style={S.loadingText}>Loading your ledger...</div>
        </div>
      </div>
    );
  }

  /* ------------------------------ render ------------------------------ */

  return (
    <div style={S.page} className={settings.theme === "dark" ? "bl-theme-dark" : "bl-theme-light"}>
      <style>{GLOBAL_CSS}</style>

      {/* account bar */}
      <div className="bl-account-bar" style={S.accountBar}>
        <div style={S.accountLeft}>
          <span className={online ? "bl-sync-dot" : "bl-sync-dot bl-sync-dot-off"} title={online ? "Synced" : "Offline - changes will sync later"} />
          <span style={S.accountEmail}>{userEmail}</span>
          <span style={S.syncLabel}>{online ? <><Cloud size={12} /> synced</> : <><CloudOff size={12} /> offline</>}</span>
        </div>
        <div style={S.accountRight}>
          {installPrompt && (
            <button style={S.installBtn} onClick={onInstall}><DownloadIcon size={13} /> Install app</button>
          )}
          <button style={S.signOutBtn} onClick={onSignOut}><LogOut size={13} /> Sign out</button>
        </div>
      </div>

      {/* header */}
      <div style={S.header}>
        <div>
          <div style={S.eyebrow}>Personal Ledger</div>
          <div style={S.monthNav}>
            <button style={S.navBtn} onClick={() => goMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
            <div style={S.monthTitle}>{MONTHS[cursor.m]} <span style={{ color: "var(--bl-text-muted)" }}>{cursor.y}</span></div>
            <button style={S.navBtn} onClick={() => goMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button>
            <div style={{ position: "relative" }}>
              <button style={S.navBtn} onClick={openPicker} aria-label="Jump to month and year"><Calendar size={16} /></button>
              {showPicker && (
                <>
                  <div style={S.pickerBackdrop} onClick={() => setShowPicker(false)} />
                  <div style={S.pickerPopover}>
                    <div style={S.pickerYearRow}>
                      <button style={S.navBtn} onClick={() => setPickerYear((y) => y - 1)}><ChevronLeft size={15} /></button>
                      <span style={S.pickerYearLabel}>{pickerYear}</span>
                      <button style={S.navBtn} onClick={() => setPickerYear((y) => y + 1)}><ChevronRight size={15} /></button>
                    </div>
                    <div style={S.pickerMonthGrid}>
                      {MONTHS_SHORT.map((label, i) => {
                        const isActive = pickerYear === cursor.y && i === cursor.m;
                        return (
                          <button
                            key={label}
                            style={isActive ? S.pickerMonthBtnActive : S.pickerMonthBtn}
                            onClick={() => jumpTo(i)}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <button style={S.pickerTodayBtn} onClick={jumpToday}>Jump to this month</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button style={S.iconBtn} onClick={copyLastMonth} title="Copy last month's amounts into this month"><Copy size={16} /></button>
          <button style={S.iconBtn} onClick={() => setShowSavings(true)} title="Savings tracker"><PiggyBank size={16} /></button>
          <button style={S.iconBtn} onClick={() => setShowSearch(true)} title="Search entries"><Search size={16} /></button>
          <button style={S.iconBtn} onClick={() => { setReportYear(cursor.y); setShowYearReport(true); }} title="Yearly report"><CalendarDays size={16} /></button>
          <button style={S.iconBtn} onClick={exportCSV} title="Export CSV"><Download size={17} /></button>
          <button style={S.iconBtn} onClick={() => setShowSettings(true)} title="Settings"><Settings2 size={17} /></button>
        </div>
      </div>

      <BalanceThread trend={trend} rollover={settings.rolloverMonthly} balanceSeries={balanceSeries} />

      <div className="bl-summary-grid">
        <SummaryCard label="Income" value={current.income} icon={<ArrowUpRight size={16} />} tone="#2F6B4F" />
        <SummaryCard label="Expenses" value={current.expense} icon={<ArrowDownRight size={16} />} tone="#B5502B" />
        <SummaryCard label="Net this month" value={current.net} icon={<Wallet size={16} />} tone={current.net >= 0 ? "#2F6B4F" : "#B5502B"} />
        <SummaryCard
          label={settings.rolloverMonthly ? "Ending balance" : "Balance (monthly view)"}
          value={current.endBalance}
          icon={<PiggyBank size={16} />}
          tone="#1B2A4A"
        />
      </div>

      {!settings.rolloverMonthly && (
        <div style={S.hint}>Viewing this month on its own - turn on rollover in settings to carry balances forward.</div>
      )}

      <div className="bl-body-grid">
        <div style={S.ledgerCol}>
          <LedgerSection
            title="Income"
            rows={incomeCats}
            getAmount={(id) => getAmount(id, key)}
            setAmount={(id, v) => setAmount(id, key, v)}
            onSetDefault={setCategoryDefault}
            onSetPlanned={setCategoryPlanned}
            onSetGoal={setCategoryGoal}
            onDelete={archiveCategory}
            openMenuId={openMenuId}
            onToggleMenu={setOpenMenuId}
            monthLabel={keyToLabel(key)}
            onAdd={() => setAddRowFor("income")}
            adding={addRowFor === "income"}
            newName={newName} setNewName={setNewName}
            onCommit={commitAddRow} onCancel={() => { setAddRowFor(null); setNewName(""); }}
            nameInputRef={nameInputRef}
            total={current.income}
            accent="#2F6B4F"
          />

          {expenseByGroup.map(({ group, cats }) => (
            <LedgerSection
              key={group}
              title={group}
              rows={cats}
              getAmount={(id) => getAmount(id, key)}
              setAmount={(id, v) => setAmount(id, key, v)}
              onSetDefault={setCategoryDefault}
              onSetPlanned={setCategoryPlanned}
              onSetGoal={setCategoryGoal}
              onDelete={archiveCategory}
              openMenuId={openMenuId}
              onToggleMenu={setOpenMenuId}
              monthLabel={keyToLabel(key)}
              onAdd={() => setAddRowFor(group)}
              adding={addRowFor === group}
              newName={newName} setNewName={setNewName}
              onCommit={commitAddRow} onCancel={() => { setAddRowFor(null); setNewName(""); }}
              nameInputRef={nameInputRef}
              total={(current.byGroup || {})[group] || 0}
              accent={GROUP_COLORS[group] || "#6B6357"}
              collapsed={!!collapsed[group]}
              onToggleCollapse={() => toggleCollapse(group)}
            />
          ))}

          {addingGroup ? (
            <div style={S.newGroupRow}>
              <input
                autoFocus
                style={S.newGroupInput}
                placeholder="New category group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitAddGroup(); if (e.key === "Escape") setAddingGroup(false); }}
              />
              <button style={S.smallBtn} onClick={commitAddGroup}>Add</button>
              <button style={S.smallBtnGhost} onClick={() => setAddingGroup(false)}>Cancel</button>
            </div>
          ) : (
            <button style={S.addGroupBtn} onClick={() => setAddingGroup(true)}>
              <Plus size={14} /> New expense group
            </button>
          )}
        </div>

        <div className="bl-insight-col" style={S.insightCol}>
          <div style={S.card}>
            <div style={S.cardTitle}>Where it went</div>
            {pieData.length === 0 ? (
              <div style={S.emptyText}>No expenses recorded yet this month.</div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 130, height: 130, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2} stroke="none">
                        {pieData.map((d, i) => <Cell key={i} fill={GROUP_COLORS[d.name] || "#6B6357"} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={S.tooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {pieData.slice().sort((a, b) => b.value - a.value).map((d) => (
                    <div key={d.name} style={S.legendRow}>
                      <span style={{ ...S.legendDot, background: GROUP_COLORS[d.name] || "#6B6357" }} />
                      <span style={S.legendLabel}>{d.name}</span>
                      <span className="bl-num" style={S.legendValue}>{fmtCompact(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Last 6 months — net (income minus expenses)</div>
            <div style={S.chartCaption}>Each bar is that month's income minus its expenses. Green means you came out ahead; red means you spent more than you brought in. Numbers above each bar are the actual amount.</div>
            <div style={{ width: "100%", height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 20, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bl-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--bl-text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--bl-text-muted)" }} axisLine={false} tickLine={false} width={44} tickFormatter={fmtCompact} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={S.tooltip} />
                  <Bar dataKey="net" radius={[3, 3, 0, 0]}>
                    {trend.map((d, i) => <Cell key={i} fill={d.net >= 0 ? "#2F6B4F" : "#B5502B"} />)}
                    <LabelList dataKey="net" position="top" formatter={fmtCompact} style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono', monospace", fill: "var(--bl-text-soft)", fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {savingsGoalCats.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>Savings goals</div>
              {savingsGoalCats.map((c) => {
                const total = cumulativeForCategory(c.id);
                const pct = Math.min(100, Math.round((total / c.goalTarget) * 100));
                return (
                  <div key={c.id} style={{ marginBottom: 12 }}>
                    <div style={S.goalRow}>
                      <span style={S.goalName}>{c.name}</span>
                      <span className="bl-num" style={S.goalAmt}>{fmtCompact(total)} / {fmtCompact(c.goalTarget)}</span>
                    </div>
                    <div style={S.progressTrack}>
                      <div style={{ ...S.progressFill, width: pct + "%", background: pct >= 100 ? "#2F6B4F" : "#3B6B8A" }} />
                    </div>
                  </div>
                );
              })}
              <div style={S.chartCaption}>Counts amounts you've actually entered, up to the month you're viewing.</div>
            </div>
          )}

          <div style={S.card}>
            <div style={S.cardTitle}>Quick read</div>
            <div style={S.insightLine}><strong className="bl-num">{savingsRate}%</strong> of income kept this month</div>
            {topGroup && <div style={S.insightLine}>Biggest spend: <strong>{topGroup.name}</strong> ({fmtCompact(topGroup.value)})</div>}
            <div style={S.insightLine}>
              Rollover: <strong>{settings.rolloverMonthly ? "monthly on" : "monthly off"}</strong>, <strong>{settings.rolloverYearly ? "yearly on" : "yearly off"}</strong>
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          setSettings={setSettings}
          onClose={() => setShowSettings(false)}
          onReset={resetAll}
          onClearValues={clearAllValues}
          onOpenRangeDelete={() => { setShowSettings(false); setShowRangeDelete(true); }}
        />
      )}

      {showRangeDelete && (
        <RangeDeleteModal
          entries={entries}
          onConfirm={(monthKeys, mode) => { deleteRange(monthKeys, mode); setShowRangeDelete(false); }}
          onClose={() => setShowRangeDelete(false)}
        />
      )}

      {showYearReport && (
        <YearReportModal
          categories={categories}
          entries={entries}
          settings={settings}
          year={reportYear}
          onYearChange={setReportYear}
          onClose={() => setShowYearReport(false)}
          onJumpTo={(m) => { setCursor({ y: reportYear, m }); setShowYearReport(false); }}
        />
      )}

      {showSearch && (
        <SearchModal
          categories={categories}
          entries={entries}
          onClose={() => setShowSearch(false)}
          onJumpTo={(mk) => {
            const [y, m] = mk.split("-").map(Number);
            setCursor({ y, m: m - 1 });
            setShowSearch(false);
          }}
        />
      )}

      {showSavings && (
        <SavingsModal
          savingsGoals={savingsGoals}
          setSavingsGoals={setSavingsGoals}
          onClose={() => setShowSavings(false)}
        />
      )}
    </div>
  );
}

/* --------------------------- subcomponents --------------------------- */

function SummaryCard({ label, value, icon, tone }) {
  return (
    <div style={S.summaryCard}>
      <div style={{ ...S.summaryIcon, color: tone }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={S.summaryLabel}>{label}</div>
        <div className="bl-num" style={{ ...S.summaryValue, color: tone }}>{fmt(value)}</div>
      </div>
    </div>
  );
}

function BalanceThread({ trend, rollover, balanceSeries }) {
  const w = 640, h = 46, pad = 14;
  const vals = trend.map((t) => (balanceSeries[t.key] ? balanceSeries[t.key].endBalance : t.net));
  const max = Math.max(...vals, 1), min = Math.min(...vals, 0);
  const range = Math.max(max - min, 1);
  const pts = vals.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (vals.length - 1);
    const yy = (h - pad) - ((v - min) / range) * (h - pad * 2);
    return [x, yy];
  });
  const pathD = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");

  return (
    <div style={S.threadWrap}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: "block" }} preserveAspectRatio="none">
        {rollover ? (
          <path d={pathD} fill="none" stroke="#C9A227" strokeWidth="2" />
        ) : (
          pts.map((p, i) => i < pts.length - 1 && (
            <line key={i} x1={p[0]} y1={p[1]} x2={pts[i + 1][0]} y2={pts[i + 1][1]} stroke="#D8D0C0" strokeWidth="1.5" strokeDasharray="3 4" />
          ))
        )}
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4.5 : 3} fill={i === pts.length - 1 ? "#1B2A4A" : (rollover ? "#C9A227" : "#B7AF9C")} />
        ))}
      </svg>
      <div style={S.threadLabels}>
        {trend.map((t, i) => <span key={t.key} style={i === trend.length - 1 ? S.threadLabelActive : S.threadLabel}>{t.label}</span>)}
      </div>
    </div>
  );
}

function LedgerRow({ cat, amount, onChange, menuOpen, onToggleMenu, onSetDefault, onSetPlanned, onSetGoal, onDelete, monthLabel }) {
  const btnRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);

  const openMenu = () => {
    const r = btnRef.current ? btnRef.current.getBoundingClientRect() : null;
    if (r) {
      const width = 220;
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      setMenuPos({ top: r.bottom + 4, left });
    }
    onToggleMenu(cat.id);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => onToggleMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  const planned = cat.plannedAmount || 0;
  const pct = planned > 0 ? Math.min(100, (amount / planned) * 100) : 0;
  const over = planned > 0 && amount > planned;

  return (
    <div>
      <div className="bl-row" style={S.row}>
        <div style={S.rowName}>{cat.name}</div>
        <div style={S.rowAmtWrap}>
          <span style={S.rowCurrency}>₦</span>
          <input
            className="bl-amt-input"
            style={S.rowInput}
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onChange(cat.id, e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <button
          ref={btnRef}
          style={S.rowMenuBtn}
          onClick={() => (menuOpen ? onToggleMenu(null) : openMenu())}
          title="Row options"
          aria-label="Row options"
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen && menuPos && createPortal(
          <>
            <div style={S.pickerBackdrop} onClick={() => onToggleMenu(null)} />
            <div style={{ ...S.rowMenu, position: "fixed", top: menuPos.top, left: menuPos.left }}>
              <button className="bl-menu-item" style={S.rowMenuItem} onClick={() => onSetDefault(cat.id)}>
                <Check size={13} /> Set as default
              </button>
              <button className="bl-menu-item" style={S.rowMenuItem} onClick={() => onSetPlanned(cat.id)}>
                <Target size={13} /> Set budget target...
              </button>
              <button className="bl-menu-item" style={S.rowMenuItem} onClick={() => onSetGoal(cat.id)}>
                <PiggyBank size={13} /> Set savings goal...
              </button>
              <button className="bl-menu-item" style={{ ...S.rowMenuItem, color: "#B5502B" }} onClick={() => onDelete(cat.id)}>
                <Trash2 size={13} /> Delete
              </button>
              <div style={S.rowMenuHint}>Delete applies from {monthLabel} onward - earlier months keep their history.</div>
            </div>
          </>,
          document.body
        )}
      </div>
      {planned > 0 && (
        <div style={S.progressTrackRow}>
          <div style={{ ...S.progressFill, width: pct + "%", background: over ? "#B5502B" : (pct >= 80 ? "#C9A227" : "#2F6B4F") }} />
        </div>
      )}
    </div>
  );
}

function LedgerSection({
  title, rows, getAmount, setAmount, onSetDefault, onSetPlanned, onSetGoal, onDelete, onAdd, adding, newName, setNewName, onCommit, onCancel,
  nameInputRef, total, accent, collapsed, onToggleCollapse, openMenuId, onToggleMenu, monthLabel,
}) {
  const isIncome = onToggleCollapse === undefined;
  return (
    <div style={S.section}>
      <div style={S.sectionHead} onClick={!isIncome ? onToggleCollapse : undefined}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...S.sectionDot, background: accent }} />
          <span style={S.sectionTitle}>{title}</span>
        </div>
        <span className="bl-num" style={{ ...S.sectionTotal, color: accent }}>{fmt(total)}</span>
      </div>
      {!collapsed && (
        <div className="bl-fade-in">
          {rows.map((c) => (
            <LedgerRow
              key={c.id}
              cat={c}
              amount={getAmount(c.id)}
              onChange={(id, v) => setAmount(id, v)}
              menuOpen={openMenuId === c.id}
              onToggleMenu={onToggleMenu}
              onSetDefault={onSetDefault}
              onSetPlanned={onSetPlanned}
              onSetGoal={onSetGoal}
              onDelete={onDelete}
              monthLabel={monthLabel}
            />
          ))}
          {rows.length === 0 && <div style={S.emptyRow}>No categories yet.</div>}

          {adding ? (
            <div style={S.addRow}>
              <input
                ref={nameInputRef}
                style={S.addInput}
                placeholder="Category name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onCommit(); if (e.key === "Escape") onCancel(); }}
              />
              <button style={S.smallBtn} onClick={onCommit}><Plus size={13} /></button>
              <button style={S.smallBtnGhost} onClick={onCancel}><X size={13} /></button>
            </div>
          ) : (
            <button style={S.addLink} onClick={onAdd}><Plus size={13} /> Add {isIncome ? "income" : "category"}</button>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({ settings, setSettings, onClose, onReset, onClearValues, onOpenRangeDelete }) {
  const [local, setLocal] = useState(settings);
  useEffect(() => setLocal(settings), [settings]);

  const apply = (patch) => {
    const next = { ...local, ...patch };
    setLocal(next);
    setSettings(next);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        <div style={S.panelHead}>
          <div style={S.panelTitle}>Settings</div>
          <button style={S.iconBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={S.panelFieldGroup}>
          <div style={S.panelLabel}>Appearance</div>
          <div style={S.segRow}>
            <button style={local.theme !== "dark" ? S.segBtnActive : S.segBtn} onClick={() => apply({ theme: "light" })}>Light</button>
            <button style={local.theme === "dark" ? S.segBtnActive : S.segBtn} onClick={() => apply({ theme: "dark" })}>Dark</button>
          </div>
        </div>

        <ToggleRow
          label="Roll over month to month"
          sub="Carry each month's leftover (or shortfall) into the next month's balance."
          value={local.rolloverMonthly}
          onChange={(v) => apply({ rolloverMonthly: v })}
        />
        <ToggleRow
          label="Roll over year to year"
          sub="Carry December's ending balance into next January, instead of resetting."
          value={local.rolloverYearly}
          onChange={(v) => apply({ rolloverYearly: v })}
          disabled={!local.rolloverMonthly}
        />

        <div style={S.panelFieldGroup}>
          <div style={S.panelLabel}>Starting balance & rollover start month</div>
          <div style={S.panelSub}>
            This sets both the balance to begin counting from, and which month rollover accumulation starts.
            Pick the month/year below to shift the starting point - months before it aren't affected by rollover math.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <input
              className="bl-num"
              type="number"
              inputMode="decimal"
              style={S.panelInput}
              value={local.startingBalance}
              onChange={(e) => apply({ startingBalance: Number(e.target.value) || 0 })}
            />
            <select
              style={S.panelSelect}
              value={local.anchorMonth}
              onChange={(e) => apply({ anchorMonth: Number(e.target.value) })}
            >
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <input
              className="bl-num"
              type="number"
              inputMode="numeric"
              style={{ ...S.panelInput, width: 80 }}
              value={local.anchorYear}
              onChange={(e) => apply({ anchorYear: Number(e.target.value) || local.anchorYear })}
            />
          </div>
        </div>

        <button
          style={S.clearBtn}
          onClick={() => {
            if (confirm("Clear every entered amount for every month? Categories, groups and settings stay as they are. This can't be undone.")) onClearValues();
          }}
        >
          Clear all entered values
        </button>

        <button style={S.clearBtn} onClick={onOpenRangeDelete}>
          Delete a range of months...
        </button>

        <button style={S.dangerBtn} onClick={() => { if (confirm("Reset all categories, entries and settings? This can't be undone.")) onReset(); }}>
          Reset all data
        </button>
      </div>
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange, disabled }) {
  return (
    <div style={{ ...S.toggleRow, opacity: disabled ? 0.45 : 1 }}>
      <div style={{ flex: 1 }}>
        <div style={S.panelLabel}>{label}</div>
        <div style={S.panelSub}>{sub}</div>
      </div>
      <div
        className="bl-toggle"
        style={{ background: value ? "#2F6B4F" : "var(--bl-border-strong)", pointerEvents: disabled ? "none" : "auto" }}
        onClick={() => onChange(!value)}
      >
        <div style={{ position: "absolute", top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#FAF7F0", transition: "left .2s" }} />
      </div>
    </div>
  );
}

function MonthYearInline({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
      <select style={S.panelSelect} value={value.m} onChange={(e) => onChange({ ...value, m: Number(e.target.value) })}>
        {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
      </select>
      <input
        className="bl-num"
        type="number"
        inputMode="numeric"
        style={{ ...S.panelInput, width: 90 }}
        value={value.y}
        onChange={(e) => onChange({ ...value, y: Number(e.target.value) || value.y })}
      />
    </div>
  );
}

function RangeDeleteModal({ entries, onConfirm, onClose }) {
  const now = new Date();
  const [mode, setMode] = useState("range"); // 'before' | 'range' | 'after'
  const [a, setA] = useState({ y: now.getFullYear(), m: 0 });
  const [b, setB] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const aKey = monthKey(a.y, a.m);
  const bKey = monthKey(b.y, b.m);

  const affected = useMemo(() => {
    if (mode === "range") {
      if (aKey > bKey) return [];
      return monthsBetween(aKey, bKey);
    }
    const existing = Object.keys(entries).sort();
    if (mode === "before") {
      if (existing.length === 0) return [];
      let endY = a.y, endM = a.m - 1;
      if (endM < 0) { endM = 11; endY -= 1; }
      const endKey = monthKey(endY, endM);
      const earliest = existing[0];
      if (endKey < earliest) return [];
      return monthsBetween(earliest, endKey);
    }
    // after
    if (existing.length === 0) return [];
    const latest = existing[existing.length - 1];
    if (aKey > latest) return [];
    return monthsBetween(aKey, latest);
  }, [mode, a, b, entries]);

  const label = mode === "before"
    ? `Before ${keyToLabel(aKey)}`
    : mode === "after"
    ? `${keyToLabel(aKey)} onward`
    : `${keyToLabel(aKey)} - ${keyToLabel(bKey)}`;

  const run = (kind) => {
    if (affected.length === 0) { alert("No recorded months fall in that range - nothing to delete."); return; }
    const verb = kind === "values"
      ? "clear the entered values for"
      : "wipe all data (set every category to ₦0) for";
    if (!confirm(`This will ${verb} ${affected.length} month${affected.length === 1 ? "" : "s"} (${label}). This can't be undone. Continue?`)) return;
    onConfirm(affected, kind);
  };

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={S.panelHead}>
          <div style={S.panelTitle}>Delete a range of months</div>
          <button style={S.iconBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={S.segRow}>
          <button style={mode === "before" ? S.segBtnActive : S.segBtn} onClick={() => setMode("before")}>Before...</button>
          <button style={mode === "range" ? S.segBtnActive : S.segBtn} onClick={() => setMode("range")}>A range</button>
          <button style={mode === "after" ? S.segBtnActive : S.segBtn} onClick={() => setMode("after")}>...and after</button>
        </div>

        {mode !== "range" ? (
          <div style={S.panelFieldGroup}>
            <div style={S.panelLabel}>{mode === "before" ? "Before this month" : "From this month"}</div>
            <MonthYearInline value={a} onChange={setA} />
          </div>
        ) : (
          <div style={S.panelFieldGroup}>
            <div style={S.panelLabel}>From</div>
            <MonthYearInline value={a} onChange={setA} />
            <div style={{ ...S.panelLabel, marginTop: 12 }}>To</div>
            <MonthYearInline value={b} onChange={setB} />
          </div>
        )}

        <div style={S.rangePreview}>
          Affects <strong>{label}</strong> - {affected.length} month{affected.length === 1 ? "" : "s"} with recorded data.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          <button style={S.clearBtn} onClick={() => run("values")}>Clear values only (reverts to category defaults)</button>
          <button style={S.dangerBtn} onClick={() => run("full")}>Delete full data (sets every amount to ₦0)</button>
        </div>
      </div>
    </div>
  );
}

function YearReportModal({ categories, entries, settings, year, onYearChange, onClose, onJumpTo }) {
  const series = useMemo(() => computeSeriesUpTo(categories, entries, settings, year, 11), [categories, entries, settings, year]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => monthKey(year, i)), [year]);
  const totals = months.reduce((acc, mk) => {
    const t = series[mk] || { income: 0, expense: 0, net: 0 };
    acc.income += t.income; acc.expense += t.expense; acc.net += t.net;
    return acc;
  }, { income: 0, expense: 0, net: 0 });

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={{ ...S.modalCard, width: 540 }} onClick={(e) => e.stopPropagation()}>
        <div style={S.panelHead}>
          <div style={S.panelTitle}>Yearly report</div>
          <button style={S.iconBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 16 }}>
          <button style={S.navBtn} onClick={() => onYearChange(year - 1)}><ChevronLeft size={15} /></button>
          <span style={{ ...S.pickerYearLabel, fontSize: 20 }}>{year}</span>
          <button style={S.navBtn} onClick={() => onYearChange(year + 1)}><ChevronRight size={15} /></button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={S.yearTable}>
            <thead>
              <tr>
                <th style={S.yearTh}>Month</th>
                <th style={{ ...S.yearTh, textAlign: "right" }}>Income</th>
                <th style={{ ...S.yearTh, textAlign: "right" }}>Expenses</th>
                <th style={{ ...S.yearTh, textAlign: "right" }}>Net</th>
                {settings.rolloverMonthly && <th style={{ ...S.yearTh, textAlign: "right" }}>End balance</th>}
              </tr>
            </thead>
            <tbody>
              {months.map((mk, i) => {
                const t = series[mk] || { income: 0, expense: 0, net: 0, endBalance: 0 };
                return (
                  <tr key={mk} className="bl-year-row" onClick={() => onJumpTo(i)}>
                    <td style={S.yearTd}>{MONTHS_SHORT[i]}</td>
                    <td className="bl-num" style={{ ...S.yearTd, textAlign: "right" }}>{fmtCompact(t.income)}</td>
                    <td className="bl-num" style={{ ...S.yearTd, textAlign: "right" }}>{fmtCompact(t.expense)}</td>
                    <td className="bl-num" style={{ ...S.yearTd, textAlign: "right", color: t.net >= 0 ? "#2F6B4F" : "#B5502B" }}>{fmtCompact(t.net)}</td>
                    {settings.rolloverMonthly && <td className="bl-num" style={{ ...S.yearTd, textAlign: "right" }}>{fmtCompact(t.endBalance)}</td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={S.yearTdTotal}>Total</td>
                <td className="bl-num" style={{ ...S.yearTdTotal, textAlign: "right" }}>{fmtCompact(totals.income)}</td>
                <td className="bl-num" style={{ ...S.yearTdTotal, textAlign: "right" }}>{fmtCompact(totals.expense)}</td>
                <td className="bl-num" style={{ ...S.yearTdTotal, textAlign: "right", color: totals.net >= 0 ? "#2F6B4F" : "#B5502B" }}>{fmtCompact(totals.net)}</td>
                {settings.rolloverMonthly && <td style={S.yearTdTotal} />}
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{ ...S.chartCaption, marginTop: 10 }}>Tap a row to jump straight to that month.</div>
      </div>
    </div>
  );
}

function SearchModal({ categories, entries, onClose, onJumpTo }) {
  const [query, setQuery] = useState("");
  const [minAmount, setMinAmount] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minAmount === "" ? null : Number(minAmount);
    if (!q && min === null) return [];
    const out = [];
    Object.keys(entries).forEach((mk) => {
      const monthEntries = entries[mk] || {};
      Object.keys(monthEntries).forEach((catId) => {
        const cat = categories.find((c) => c.id === catId);
        if (!cat) return;
        const amt = monthEntries[catId];
        if (q && !cat.name.toLowerCase().includes(q)) return;
        if (min !== null && amt < min) return;
        out.push({ mk, name: cat.name, amt, type: cat.type, group: cat.group });
      });
    });
    return out.sort((a, b) => (a.mk < b.mk ? 1 : -1));
  }, [query, minAmount, categories, entries]);

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={S.panelHead}>
          <div style={S.panelTitle}>Search entries</div>
          <button style={S.iconBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <input
            style={{ ...S.addInput, flex: 2, minWidth: 140 }}
            placeholder="Category name contains..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <input
            style={{ ...S.addInput, flex: 1, minWidth: 100 }}
            type="number"
            placeholder="Min amount"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
          />
        </div>
        {(!query.trim() && minAmount === "") ? (
          <div style={S.emptyText}>Type a category name or a minimum amount to search across every recorded month.</div>
        ) : results.length === 0 ? (
          <div style={S.emptyText}>No matches.</div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {results.map((r, i) => (
              <div key={i} className="bl-year-row" style={S.searchRow} onClick={() => onJumpTo(r.mk)}>
                <div style={{ minWidth: 0 }}>
                  <div style={S.searchName}>{r.name}</div>
                  <div style={S.chartCaption}>{keyToLabel(r.mk)}{r.group ? ` - ${r.group}` : ""}</div>
                </div>
                <span className="bl-num" style={{ color: r.type === "income" ? "#2F6B4F" : "#B5502B", fontWeight: 600, flexShrink: 0 }}>{fmt(r.amt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GoalCard({ g, totalOf, onOpen, completed }) {
  const total = totalOf(g);
  const pct = g.target > 0 ? Math.min(100, Math.round((total / g.target) * 100)) : 0;
  const remaining = Math.max(0, g.target - total);
  return (
    <div className="bl-year-row" style={{ ...S.card, marginBottom: 10, cursor: "pointer" }} onClick={onOpen}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: "var(--bl-text)", display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
          {completed && <Check size={13} style={{ color: "#2F6B4F", flexShrink: 0 }} />}
        </div>
        <span className="bl-num" style={{ fontSize: 12.5, color: "var(--bl-text-muted)", flexShrink: 0 }}>{fmtCompact(total)} / {fmtCompact(g.target)}</span>
      </div>
      <div style={{ ...S.progressTrack, marginTop: 8 }}>
        <div style={{ ...S.progressFill, width: pct + "%", background: pct >= 100 ? "#2F6B4F" : "#3B6B8A" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--bl-text-muted)" }}>
        <span>{pct}% saved</span>
        <span>{completed ? "Goal reached" : `${fmtCompact(remaining)} to go`}</span>
      </div>
    </div>
  );
}

function SavingsGoalDetail({ goal, onBack, onClose, setSavingsGoals, onDeleteGoal }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(goal.target);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(goal.name);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState(goal.deadline || "");

  const contributions = (goal.contributions || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = contributions.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const remaining = Math.max(0, goal.target - total);
  const pct = goal.target > 0 ? Math.min(100, Math.round((total / goal.target) * 100)) : 0;
  const reached = total >= goal.target && goal.target > 0;

  const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline) - new Date()) / 86400000) : null;
  const suggestedMonthly = (goal.deadline && daysLeft > 0) ? Math.ceil(remaining / Math.max(1, daysLeft / 30)) : null;

  const patchGoal = (patch) => setSavingsGoals((prev) => (prev || []).map((g) => (g.id === goal.id ? { ...g, ...patch } : g)));

  const addContribution = () => {
    const l = label.trim() || "Contribution";
    const a = Number(amount);
    if (!a || a <= 0) return;
    patchGoal({ contributions: [...(goal.contributions || []), { id: uid(), label: l, amount: a, date: new Date().toISOString().slice(0, 10) }] });
    setLabel(""); setAmount("");
  };

  const removeContribution = (id) => {
    patchGoal({ contributions: (goal.contributions || []).filter((c) => c.id !== id) });
  };

  const saveTarget = () => {
    const v = Number(targetInput) || 0;
    if (v > 0) patchGoal({ target: v });
    setEditingTarget(false);
  };

  const saveName = () => {
    const v = nameInput.trim();
    if (v) patchGoal({ name: v });
    setEditingName(false);
  };

  const saveDeadline = () => {
    patchGoal({ deadline: deadlineInput || null });
    setEditingDeadline(false);
  };

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={{ ...S.modalCard, width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={S.panelHead}>
          <button style={S.smallBtnGhost} onClick={onBack}><ChevronLeft size={14} /> Back</button>
          <button style={S.iconBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {editingName ? (
          <input
            autoFocus
            style={{ ...S.addInput, fontSize: 16, fontWeight: 600, marginBottom: 10 }}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
            onBlur={saveName}
          />
        ) : (
          <div
            style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: "var(--bl-navy-text)", cursor: "pointer", marginBottom: 10 }}
            onClick={() => { setNameInput(goal.name); setEditingName(true); }}
            title="Click to rename"
          >
            {goal.name}
          </div>
        )}

        {reached && (
          <div style={{ ...S.clearBtn, borderColor: "#B7D4C0", color: "#2F6B4F", textAlign: "center", marginTop: 0, marginBottom: 10, cursor: "default" }}>
            Goal reached!
          </div>
        )}

        <div style={S.progressTrack}>
          <div style={{ ...S.progressFill, width: pct + "%", background: reached ? "#2F6B4F" : "#3B6B8A" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, marginBottom: 10, fontSize: 12, color: "var(--bl-text-muted)" }}>
          <span>{pct}% saved</span>
          {editingTarget ? (
            <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
              Target:
              <input
                autoFocus
                type="number"
                style={{ ...S.panelInput, width: 100, padding: "3px 6px" }}
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveTarget(); if (e.key === "Escape") setEditingTarget(false); }}
                onBlur={saveTarget}
              />
            </span>
          ) : (
            <span style={{ cursor: "pointer", textDecoration: "underline dotted" }} onClick={() => { setTargetInput(goal.target); setEditingTarget(true); }}>
              Target: {fmt(goal.target)}
            </span>
          )}
        </div>

        <div style={{ ...S.chartCaption, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ minWidth: 0 }}>
            {goal.deadline
              ? (daysLeft > 0
                  ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left${suggestedMonthly ? ` — save about ${fmt(suggestedMonthly)}/month to make it` : ""}`
                  : "Target date has passed")
              : "No target date set"}
          </span>
          {editingDeadline ? (
            <input
              autoFocus
              type="date"
              style={{ ...S.panelInput, width: 140, padding: "3px 6px", flexShrink: 0 }}
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              onBlur={saveDeadline}
            />
          ) : (
            <button style={{ ...S.addLink, width: "auto", padding: "2px 0", flexShrink: 0 }} onClick={() => { setDeadlineInput(goal.deadline || ""); setEditingDeadline(true); }}>
              {goal.deadline ? "Change" : "Set date"}
            </button>
          )}
        </div>

        <div className="bl-scrollbar" style={{ maxHeight: 220, overflowY: "auto", marginBottom: 10 }}>
          {contributions.length === 0 ? (
            <div style={S.emptyText}>No contributions yet — add what's going toward this below.</div>
          ) : contributions.map((c) => (
            <div key={c.id} style={S.searchRow}>
              <div style={{ minWidth: 0 }}>
                <div style={S.searchName}>{c.label}</div>
                <div style={S.chartCaption}>{new Date(c.date).toLocaleDateString()}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span className="bl-num" style={{ color: "#2F6B4F", fontWeight: 600 }}>{fmt(c.amount)}</span>
                <button style={{ ...S.rowMenuBtn, padding: 3 }} onClick={() => removeContribution(c.id)} title="Remove contribution"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <input
            style={{ ...S.addInput, flex: 2, minWidth: 130 }}
            placeholder="What's this from? (e.g. salary, gift)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addContribution(); }}
          />
          <input
            style={{ ...S.addInput, flex: 1, minWidth: 90 }}
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addContribution(); }}
          />
          <button style={S.smallBtn} onClick={addContribution}><Plus size={14} /></button>
        </div>

        <div style={{ borderTop: "1px solid var(--bl-border-strong)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 600, color: "var(--bl-text)" }}>
            <span>Total</span>
            <span className="bl-num">{fmt(total)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--bl-text-muted)" }}>
            <span>Amount needed</span>
            <span className="bl-num">{reached ? "₦0 — done" : fmt(remaining)}</span>
          </div>
        </div>

        <button style={S.dangerBtn} onClick={onDeleteGoal}>Delete this goal</button>
      </div>
    </div>
  );
}

function SavingsModal({ savingsGoals, setSavingsGoals, onClose }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const goals = savingsGoals || [];
  const totalOf = (g) => (g.contributions || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const active = goals.filter((g) => !(g.target > 0 && totalOf(g) >= g.target));
  const completed = goals.filter((g) => g.target > 0 && totalOf(g) >= g.target);
  const overallSaved = goals.reduce((s, g) => s + totalOf(g), 0);

  const addGoal = () => {
    const name = goalName.trim();
    const target = Number(goalTarget) || 0;
    if (!name || target <= 0) return;
    setSavingsGoals((prev) => [...(prev || []), { id: uid(), name, target, deadline: goalDeadline || null, createdAt: Date.now(), contributions: [] }]);
    setGoalName(""); setGoalTarget(""); setGoalDeadline(""); setShowNewGoal(false);
  };

  const removeGoal = (id) => {
    if (!confirm("Delete this savings goal and all its contributions? This can't be undone.")) return;
    setSavingsGoals((prev) => (prev || []).filter((g) => g.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const selected = goals.find((g) => g.id === selectedId);
  if (selected) {
    return (
      <SavingsGoalDetail
        goal={selected}
        onBack={() => setSelectedId(null)}
        onClose={onClose}
        setSavingsGoals={setSavingsGoals}
        onDeleteGoal={() => removeGoal(selected.id)}
      />
    );
  }

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={{ ...S.modalCard, width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={S.panelHead}>
          <div style={S.panelTitle}>Savings tracker</div>
          <button style={S.iconBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {goals.length > 0 && (
          <div style={{ ...S.card, marginBottom: 14 }}>
            <div style={S.chartCaption}>Total saved across all goals</div>
            <div className="bl-num" style={{ fontSize: 20, fontWeight: 700, color: "#2F6B4F" }}>{fmt(overallSaved)}</div>
          </div>
        )}

        {goals.length === 0 && !showNewGoal && (
          <div style={S.emptyText}>No savings goals yet. Create one for something you're saving toward — a phone, rent, a trip — then log what goes into it as you save.</div>
        )}

        {active.map((g) => <GoalCard key={g.id} g={g} totalOf={totalOf} onOpen={() => setSelectedId(g.id)} />)}

        {completed.length > 0 && (
          <>
            <button style={{ ...S.addLink, padding: "8px 0" }} onClick={() => setShowCompleted((v) => !v)}>
              {showCompleted ? "Hide" : "Show"} completed goals ({completed.length})
            </button>
            {showCompleted && completed.map((g) => <GoalCard key={g.id} g={g} totalOf={totalOf} onOpen={() => setSelectedId(g.id)} completed />)}
          </>
        )}

        {showNewGoal ? (
          <div style={{ ...S.panelFieldGroup, marginTop: 14 }}>
            <div style={S.panelLabel}>New savings goal</div>
            <input
              autoFocus
              style={{ ...S.addInput, marginTop: 8, width: "100%" }}
              placeholder="What are you saving for? (e.g. Phone)"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
            />
            <input
              style={{ ...S.addInput, marginTop: 8, width: "100%" }}
              type="number"
              placeholder="Target amount (₦)"
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
            />
            <input
              style={{ ...S.addInput, marginTop: 8, width: "100%" }}
              type="date"
              value={goalDeadline}
              onChange={(e) => setGoalDeadline(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={S.smallBtn} onClick={addGoal}>Create goal</button>
              <button style={S.smallBtnGhost} onClick={() => setShowNewGoal(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button style={{ ...S.addGroupBtn, marginTop: 14 }} onClick={() => setShowNewGoal(true)}>
            <Plus size={14} /> New savings goal
          </button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- global css -------------------------------- */

const GLOBAL_CSS = `
  :root, .bl-theme-light {
    --bl-bg: #FAF7F0; --bl-card: #ffffff; --bl-border: #EFE9DC; --bl-border-strong: #E7E1D3;
    --bl-text: #2A2620; --bl-text-soft: #463F33; --bl-text-muted: #8A8371; --bl-text-faint: #B7AF9C;
    --bl-navy-text: #1B2A4A; --bl-input-bg: #FCFAF4; --bl-row-border: #F5F1E7; --bl-section-border: #F3EEE2;
    --bl-overlay: rgba(27,42,74,0.35); --bl-badge-bg: #FFF9E8;
  }
  .bl-theme-dark {
    --bl-bg: #171B26; --bl-card: #1F2433; --bl-border: #2B3145; --bl-border-strong: #333A52;
    --bl-text: #EDE9DD; --bl-text-soft: #C9C3B4; --bl-text-muted: #9198AC; --bl-text-faint: #656B80;
    --bl-navy-text: #93B4E8; --bl-input-bg: #242A3B; --bl-row-border: #2B3145; --bl-section-border: #2B3145;
    --bl-overlay: rgba(5,8,16,0.6); --bl-badge-bg: #2E2717;
  }
  * { box-sizing: border-box; }
  .bl-num { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
  .bl-amt-input { font-family: 'IBM Plex Mono', monospace; }
  .bl-amt-input:focus { outline: none; border-bottom-color: var(--bl-navy-text); }
  .bl-menu-item:hover { background: var(--bl-bg); }
  .bl-year-row:hover { background: var(--bl-bg); }
  .bl-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
  .bl-scrollbar::-webkit-scrollbar-thumb { background: var(--bl-border-strong); border-radius: 3px; }
  .bl-toggle { position: relative; width: 40px; height: 22px; border-radius: 11px; cursor: pointer; transition: background .2s; flex-shrink:0; }
  .bl-fade-in { animation: blfade .25s ease; }
  @keyframes blfade { from { opacity: 0; transform: translateY(-2px);} to { opacity: 1; transform: translateY(0);} }
  .bl-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 10px; }
  .bl-body-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; align-items: start; }
  .bl-sync-dot { width: 7px; height: 7px; border-radius: 50%; background: #2F6B4F; flex-shrink: 0; }
  .bl-sync-dot-off { background: #B5502B; }

  @media (max-width: 760px) {
    .bl-summary-grid { grid-template-columns: repeat(2, 1fr); }
    .bl-body-grid { grid-template-columns: 1fr; }
    .bl-insight-col { position: static !important; }
  }

  @media (max-width: 480px) {
    body { -webkit-text-size-adjust: 100%; }
    .bl-account-bar { flex-wrap: wrap; gap: 8px !important; }
    .bl-summary-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  }
  @media (max-width: 380px) {
    .bl-summary-grid { grid-template-columns: 1fr 1fr; }
  }
`;

/* --------------------------------- styles -------------------------------- */

const S = {
  page: {
    fontFamily: "'Inter', sans-serif",
    background: "var(--bl-bg)",
    color: "var(--bl-text)",
    minHeight: "100%",
    padding: "max(12px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 40px max(14px, env(safe-area-inset-left))",
    maxWidth: 1040,
    margin: "0 auto",
  },
  loadingWrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" },
  loadingText: { color: "var(--bl-text-muted)", fontSize: 14 },

  accountBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, fontSize: 12.5, gap: 10 },
  accountLeft: { display: "flex", alignItems: "center", gap: 8, minWidth: 0, color: "var(--bl-text-muted)" },
  accountEmail: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 },
  syncLabel: { display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" },
  accountRight: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  installBtn: { display: "flex", alignItems: "center", gap: 5, border: "1px solid #C9A227", background: "var(--bl-badge-bg)", color: "#8A6D1B", borderRadius: 7, padding: "6px 10px", fontSize: 12, cursor: "pointer" },
  signOutBtn: { display: "flex", alignItems: "center", gap: 5, border: "1px solid var(--bl-border-strong)", background: "var(--bl-card)", color: "var(--bl-text-muted)", borderRadius: 7, padding: "6px 10px", fontSize: 12, cursor: "pointer" },

  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap", gap: 12 },
  eyebrow: { fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bl-text-muted)", fontWeight: 600, marginBottom: 4 },
  monthNav: { display: "flex", alignItems: "center", gap: 6 },
  monthTitle: { fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 600, color: "var(--bl-navy-text)", letterSpacing: "-0.01em" },
  navBtn: { border: "1px solid var(--bl-border-strong)", background: "var(--bl-card)", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--bl-navy-text)" },
  iconBtn: { border: "1px solid var(--bl-border-strong)", background: "var(--bl-card)", borderRadius: 8, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--bl-navy-text)" },

  pickerBackdrop: { position: "fixed", inset: 0, zIndex: 39 },
  pickerPopover: {
    position: "absolute", top: 40, left: "50%", transform: "translateX(-50%)", zIndex: 40,
    background: "var(--bl-card)", border: "1px solid var(--bl-border-strong)", borderRadius: 12, padding: 14,
    boxShadow: "0 10px 30px rgba(27,42,74,0.15)", width: 220, maxWidth: "80vw",
  },
  pickerYearRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  pickerYearLabel: { fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, color: "var(--bl-navy-text)" },
  pickerMonthGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10 },
  pickerMonthBtn: { border: "1px solid var(--bl-border)", background: "var(--bl-bg)", borderRadius: 7, padding: "8px 0", fontSize: 12.5, cursor: "pointer", color: "var(--bl-text-soft)" },
  pickerMonthBtnActive: { border: "1px solid #1B2A4A", background: "#1B2A4A", borderRadius: 7, padding: "8px 0", fontSize: 12.5, cursor: "pointer", color: "#fff", fontWeight: 600 },
  pickerTodayBtn: { width: "100%", border: "none", background: "none", color: "var(--bl-text-muted)", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: "4px 0" },

  threadWrap: { marginBottom: 18, background: "var(--bl-card)", border: "1px solid var(--bl-border)", borderRadius: 12, padding: "10px 14px 8px" },
  threadLabels: { display: "flex", justifyContent: "space-between", marginTop: 2 },
  threadLabel: { fontSize: 10.5, color: "var(--bl-text-faint)", fontWeight: 500 },
  threadLabelActive: { fontSize: 10.5, color: "var(--bl-navy-text)", fontWeight: 700 },

  summaryCard: { background: "var(--bl-card)", border: "1px solid var(--bl-border)", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 },
  summaryIcon: { marginTop: 3, flexShrink: 0 },
  summaryLabel: { fontSize: 11.5, color: "var(--bl-text-muted)", fontWeight: 500, marginBottom: 3 },
  summaryValue: { fontSize: 17, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

  hint: { fontSize: 12.5, color: "var(--bl-text-muted)", marginBottom: 14, fontStyle: "italic" },

  ledgerCol: { display: "flex", flexDirection: "column", gap: 12, minWidth: 0 },
  insightCol: { display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 20, minWidth: 0 },

  section: { background: "var(--bl-card)", border: "1px solid var(--bl-border)", borderRadius: 12, overflow: "hidden" },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid var(--bl-section-border)" },
  sectionDot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  sectionTitle: { fontFamily: "'Fraunces', serif", fontSize: 15.5, fontWeight: 600, color: "var(--bl-text)" },
  sectionTotal: { fontSize: 14, fontWeight: 600 },

  row: { display: "flex", alignItems: "center", padding: "9px 14px", borderBottom: "1px solid var(--bl-row-border)", gap: 10 },
  rowName: { flex: 1, fontSize: 13.5, color: "var(--bl-text-soft)", minWidth: 0 },
  rowAmtWrap: { display: "flex", alignItems: "baseline", gap: 2, flexShrink: 0 },
  rowCurrency: { fontSize: 13, color: "var(--bl-text-faint)" },
  rowInput: { border: "none", borderBottom: "1px solid transparent", background: "transparent", fontSize: 14, textAlign: "right", width: 96, padding: "4px 2px", color: "var(--bl-text)" },
  rowMenuBtn: { border: "none", background: "none", color: "var(--bl-text-muted)", cursor: "pointer", padding: 6, display: "flex", borderRadius: 6, flexShrink: 0 },
  rowMenu: {
    background: "var(--bl-card)", border: "1px solid var(--bl-border-strong)", borderRadius: 10,
    boxShadow: "0 10px 24px rgba(27,42,74,0.2)", padding: 6, width: 220, zIndex: 40,
  },
  rowMenuItem: { display: "flex", alignItems: "center", gap: 8, width: "100%", border: "none", background: "none", padding: "8px 8px", fontSize: 12.5, color: "var(--bl-text)", cursor: "pointer", borderRadius: 6, textAlign: "left" },
  rowMenuHint: { fontSize: 10.5, color: "var(--bl-text-faint)", padding: "6px 8px 2px", lineHeight: 1.4, borderTop: "1px solid var(--bl-row-border)", marginTop: 4 },

  progressTrackRow: { height: 4, background: "var(--bl-row-border)", borderRadius: 2, margin: "-2px 14px 8px", overflow: "hidden" },
  progressTrack: { height: 5, background: "var(--bl-row-border)", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, transition: "width .2s" },
  goalRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, fontSize: 12.5 },
  goalName: { color: "var(--bl-text-soft)" },
  goalAmt: { color: "var(--bl-text-muted)" },

  emptyRow: { padding: "10px 14px", fontSize: 12.5, color: "var(--bl-text-faint)", fontStyle: "italic" },
  addRow: { display: "flex", gap: 6, padding: "8px 14px", alignItems: "center" },
  addInput: { flex: 1, border: "1px solid var(--bl-border-strong)", borderRadius: 6, padding: "8px 8px", fontSize: 13, background: "var(--bl-input-bg)", minWidth: 0, color: "var(--bl-text)" },
  addLink: { display: "flex", alignItems: "center", gap: 5, border: "none", background: "none", color: "var(--bl-text-muted)", fontSize: 12.5, padding: "10px 14px", cursor: "pointer", width: "100%", textAlign: "left" },

  newGroupRow: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  newGroupInput: { flex: 1, border: "1px dashed var(--bl-border-strong)", borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "transparent", minWidth: 140, color: "var(--bl-text)" },
  addGroupBtn: { display: "flex", alignItems: "center", gap: 6, justifyContent: "center", border: "1px dashed var(--bl-border-strong)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "var(--bl-text-muted)", background: "transparent", cursor: "pointer" },

  smallBtn: { border: "none", background: "#1B2A4A", color: "#fff", borderRadius: 6, padding: "8px 10px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center" },
  smallBtnGhost: { border: "1px solid var(--bl-border-strong)", background: "var(--bl-card)", color: "var(--bl-text-muted)", borderRadius: 6, padding: "8px 10px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center" },

  card: { background: "var(--bl-card)", border: "1px solid var(--bl-border)", borderRadius: 12, padding: "14px 16px" },
  cardTitle: { fontFamily: "'Fraunces', serif", fontSize: 14.5, fontWeight: 600, marginBottom: 6, color: "var(--bl-text)" },
  chartCaption: { fontSize: 11, color: "var(--bl-text-muted)", marginBottom: 8, lineHeight: 1.4 },
  emptyText: { fontSize: 12.5, color: "var(--bl-text-faint)", fontStyle: "italic" },
  legendRow: { display: "flex", alignItems: "center", gap: 7, fontSize: 12, padding: "3px 0" },
  legendDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  legendLabel: { flex: 1, color: "var(--bl-text-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 },
  legendValue: { color: "var(--bl-text-muted)", fontWeight: 500 },
  insightLine: { fontSize: 13, color: "var(--bl-text-soft)", padding: "4px 0", borderTop: "1px solid var(--bl-row-border)" },
  tooltip: { fontSize: 12, border: "1px solid var(--bl-border)", borderRadius: 8, fontFamily: "'IBM Plex Mono', monospace", background: "var(--bl-card)", color: "var(--bl-text)" },

  overlay: { position: "fixed", inset: 0, background: "var(--bl-overlay)", display: "flex", justifyContent: "flex-end", zIndex: 50 },
  panel: { width: 360, maxWidth: "90vw", background: "var(--bl-bg)", height: "100%", padding: 20, overflowY: "auto", boxShadow: "-8px 0 24px rgba(0,0,0,0.08)" },
  panelHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  panelTitle: { fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: "var(--bl-navy-text)" },
  panelFieldGroup: { background: "var(--bl-card)", border: "1px solid var(--bl-border)", borderRadius: 10, padding: 14, marginTop: 14, marginBottom: 14 },
  panelLabel: { fontSize: 13.5, fontWeight: 600, color: "var(--bl-text)", marginBottom: 3 },
  panelSub: { fontSize: 12, color: "var(--bl-text-muted)", lineHeight: 1.4 },
  panelInput: { flex: 1, border: "1px solid var(--bl-border-strong)", borderRadius: 6, padding: "8px 8px", fontSize: 13, minWidth: 90, background: "var(--bl-card)", color: "var(--bl-text)" },
  panelSelect: { border: "1px solid var(--bl-border-strong)", borderRadius: 6, padding: "8px 6px", fontSize: 12.5, background: "var(--bl-card)", color: "var(--bl-text)" },
  toggleRow: { display: "flex", alignItems: "center", gap: 12, background: "var(--bl-card)", border: "1px solid var(--bl-border)", borderRadius: 10, padding: 14, marginBottom: 10 },
  clearBtn: { width: "100%", marginTop: 8, border: "1px solid #E3D3A4", color: "#8A6D1B", background: "var(--bl-card)", borderRadius: 8, padding: "10px 12px", fontSize: 13, cursor: "pointer" },
  dangerBtn: { width: "100%", marginTop: 8, border: "1px solid #E3B7A4", color: "#B5502B", background: "var(--bl-card)", borderRadius: 8, padding: "10px 12px", fontSize: 13, cursor: "pointer" },

  modalOverlay: { position: "fixed", inset: 0, background: "var(--bl-overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 },
  modalCard: { background: "var(--bl-bg)", borderRadius: 14, padding: 20, width: 420, maxWidth: "92vw", maxHeight: "86vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" },
  segRow: { display: "flex", gap: 6, marginBottom: 4 },
  segBtn: { flex: 1, border: "1px solid var(--bl-border-strong)", background: "var(--bl-card)", color: "var(--bl-text-soft)", borderRadius: 8, padding: "8px 6px", fontSize: 12, cursor: "pointer" },
  segBtnActive: { flex: 1, border: "1px solid #1B2A4A", background: "#1B2A4A", color: "#fff", borderRadius: 8, padding: "8px 6px", fontSize: 12, cursor: "pointer", fontWeight: 600 },
  rangePreview: { fontSize: 12.5, color: "var(--bl-text-soft)", background: "var(--bl-card)", border: "1px solid var(--bl-border)", borderRadius: 8, padding: "10px 12px", marginTop: 14 },

  yearTable: { width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 420 },
  yearTh: { textAlign: "left", padding: "6px 8px", color: "var(--bl-text-muted)", fontWeight: 600, fontSize: 11, borderBottom: "1px solid var(--bl-border-strong)" },
  yearTd: { padding: "7px 8px", color: "var(--bl-text-soft)", borderBottom: "1px solid var(--bl-row-border)" },
  yearTdTotal: { padding: "8px 8px", color: "var(--bl-text)", fontWeight: 700, borderTop: "2px solid var(--bl-border-strong)" },

  searchRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 6px", borderBottom: "1px solid var(--bl-row-border)", cursor: "pointer" },
  searchName: { fontSize: 13, color: "var(--bl-text-soft)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
};
