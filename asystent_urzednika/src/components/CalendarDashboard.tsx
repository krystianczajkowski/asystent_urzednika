import React, { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  AlertCircle,
  Clock,
  CheckCircle2,
  FolderOpen,
} from "lucide-react";
import { Department, WniosekCase, WorkflowStatus } from "../types";
import {
  STATUS_META,
  diffDays,
  formatPlDate,
  getDeadlineUrgency,
} from "../utils/workflow";

interface CalendarDashboardProps {
  cases: WniosekCase[];
  departments: Department[];
  referenceDate: string;
  onChangeReferenceDate: (iso: string) => void;
  onOpenCase: (caseId: string) => void;
  onUpdateCase: (caseId: string, patch: Partial<WniosekCase>) => void;
  onNewRequest: () => void;
}

const WEEKDAYS_PL = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MONTHS_PL = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

export const CalendarDashboard: React.FC<CalendarDashboardProps> = ({
  cases,
  departments,
  referenceDate,
  onChangeReferenceDate,
  onOpenCase,
  onUpdateCase,
  onNewRequest,
}) => {
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "urgent" | "active" | "done"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest" | "urgent">(
    "oldest"
  );
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(
    null
  );

  // Month viewer initialized to the referenceDate's month
  const [calYear, setCalYear] = useState<number>(() =>
    Number(referenceDate.slice(0, 4))
  );
  const [calMonth, setCalMonth] = useState<number>(
    () => Number(referenceDate.slice(5, 7)) - 1
  );

  const yearsAvailable = useMemo(() => {
    const yrs = new Set<string>();
    for (const c of cases) {
      if (c.receivedDate) yrs.add(c.receivedDate.slice(0, 4));
      if (c.dueDate) yrs.add(c.dueDate.slice(0, 4));
    }
    return Array.from(yrs).sort();
  }, [cases]);

  const summaryStats = useMemo(() => {
    let dueTodayOrTomorrow = 0;
    let overdue = 0;
    let inProgress = 0;
    let sent = 0;
    for (const c of cases) {
      if (c.status === "wyslana") {
        sent++;
        continue;
      }
      inProgress++;
      const d = diffDays(referenceDate, c.dueDate);
      if (d < 0) overdue++;
      if (d === 0 || d === 1) dueTodayOrTomorrow++;
    }
    return {
      total: cases.length,
      dueTodayOrTomorrow,
      overdue,
      inProgress,
      sent,
    };
  }, [cases, referenceDate]);

  // Calendar grid for calYear / calMonth
  const calendarCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(calYear, calMonth, 1));
    const daysInMonth = new Date(Date.UTC(calYear, calMonth + 1, 0)).getUTCDate();
    // Monday=0 .. Sunday=6
    const jsDow = firstDay.getUTCDay();
    const startOffset = jsDow === 0 ? 6 : jsDow - 1;

    const cells: Array<{
      iso: string | null;
      dayNum: number | null;
      dueCases: WniosekCase[];
    }> = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ iso: null, dayNum: null, dueCases: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(
        d
      ).padStart(2, "0")}`;
      const dueCases = cases.filter((c) => c.dueDate === iso);
      cells.push({ iso, dayNum: d, dueCases });
    }
    return cells;
  }, [calYear, calMonth, cases]);

  const filteredCases = useMemo(() => {
    let list = [...cases];

    if (selectedYear !== "all") {
      list = list.filter(
        (c) =>
          c.receivedDate.startsWith(selectedYear) ||
          c.dueDate.startsWith(selectedYear)
      );
    }

    if (selectedCalendarDay) {
      // Highlight cases due on selectedCalendarDay or the preceding/next day
      list = list.filter((c) => {
        const delta = diffDays(selectedCalendarDay, c.dueDate);
        return delta === 0 || delta === 1;
      });
    }

    if (statusFilter === "urgent") {
      list = list.filter((c) => {
        if (c.status === "wyslana") return false;
        const d = diffDays(referenceDate, c.dueDate);
        return d <= 1;
      });
    } else if (statusFilter === "active") {
      list = list.filter((c) => c.status !== "wyslana");
    } else if (statusFilter === "done") {
      list = list.filter((c) => c.status === "wyslana");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(q) ||
          c.applicant.toLowerCase().includes(q) ||
          c.subject.toLowerCase().includes(q) ||
          c.assignee.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortOrder === "oldest") {
        return a.receivedDate.localeCompare(b.receivedDate) || a.lp - b.lp;
      }
      if (sortOrder === "newest") {
        return b.receivedDate.localeCompare(a.receivedDate) || b.lp - a.lp;
      }
      // urgent: active first sorted by smallest days left
      if (a.status === "wyslana" && b.status !== "wyslana") return 1;
      if (a.status !== "wyslana" && b.status === "wyslana") return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    return list;
  }, [
    cases,
    selectedYear,
    selectedCalendarDay,
    statusFilter,
    searchQuery,
    sortOrder,
    referenceDate,
  ]);

  const shiftMonth = (delta: number) => {
    const dt = new Date(Date.UTC(calYear, calMonth + delta, 1));
    setCalYear(dt.getUTCFullYear());
    setCalMonth(dt.getUTCMonth());
  };

  const handleSetRefDate = (iso: string) => {
    onChangeReferenceDate(iso);
    setCalYear(Number(iso.slice(0, 4)));
    setCalMonth(Number(iso.slice(5, 7)) - 1);
    setSelectedCalendarDay(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Title + Reference Date Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Biuro Komunikacji Społecznej · Urząd Miasta Bydgoszczy
          </p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Kalendarz i rejestr wniosków UDIP
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500">Dzień odniesienia:</span>
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => handleSetRefDate("2026-09-18")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                referenceDate === "2026-09-18"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              18.09.2026 (Terminy CSV)
            </button>
            <button
              type="button"
              onClick={() => handleSetRefDate("2026-11-21")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                referenceDate === "2026-11-21"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              21.11.2026 (Dzisiaj)
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Strip (Flat 1px border, tabular-nums, no pills) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Wszystkie sprawy</span>
            <FolderOpen className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {summaryStats.total}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Rejestr wniosków BKS.IV.1431
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-red-700 font-medium">
            <span>Termin dziś lub jutro</span>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-red-700 tabular-nums">
            {summaryStats.dueTodayOrTomorrow}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Wymaga priorytetowej odpowiedzi
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-amber-700 font-medium">
            <span>Sprawy w toku / kwerenda</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {summaryStats.inProgress}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {summaryStats.overdue > 0
              ? `W tym po terminie: ${summaryStats.overdue}`
              : "Wszystkie w bieżącym obiegu"}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-emerald-700 font-medium">
            <span>Odpowiedzi wysłane</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {summaryStats.sent}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Zarchiwizowane w Bazie Wiedzy
          </div>
        </div>
      </div>

      {/* Integrated Calendar + Table Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Compact Month Calendar */}
        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-700" />
              <h2 className="text-base font-semibold text-slate-900">
                {MONTHS_PL[calMonth]} {calYear}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Poprzedni miesiąc"
                className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Następny miesiąc"
                className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 mb-2">
            {WEEKDAYS_PL.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              if (!cell.iso || !cell.dayNum) {
                return <div key={`empty-${idx}`} className="h-11" />;
              }
              const isRef = cell.iso === referenceDate;
              const isSelected = cell.iso === selectedCalendarDay;
              const hasActiveDue = cell.dueCases.some(
                (c) => c.status !== "wyslana"
              );
              const hasAnyDue = cell.dueCases.length > 0;
              const isPrevDayToDue = cases.some(
                (c) =>
                  c.status !== "wyslana" &&
                  diffDays(cell.iso!, c.dueDate) === 1
              );

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() =>
                    setSelectedCalendarDay(isSelected ? null : cell.iso)
                  }
                  className={`h-11 rounded-md border text-xs flex flex-col items-center justify-center transition-colors tabular-nums cursor-pointer ${
                    isSelected
                      ? "bg-blue-700 text-white border-blue-700 font-semibold"
                      : isRef
                      ? "bg-blue-50 text-blue-900 border-blue-400 font-semibold"
                      : hasActiveDue
                      ? "bg-red-50 text-red-900 border-red-200 font-semibold hover:bg-red-100"
                      : isPrevDayToDue
                      ? "bg-amber-50 text-amber-900 border-amber-200 font-medium hover:bg-amber-100"
                      : hasAnyDue
                      ? "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      : "bg-white text-slate-700 border-transparent hover:border-slate-200"
                  }`}
                >
                  <span>{cell.dayNum}</span>
                  {hasAnyDue && (
                    <span
                      className={`text-[10px] leading-none mt-0.5 ${
                        isSelected
                          ? "text-blue-100"
                          : hasActiveDue
                          ? "text-red-700"
                          : "text-slate-500"
                      }`}
                    >
                      {cell.dueCases.length} spr.
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 space-y-2 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span>Dzień odniesienia:</span>
              <span className="font-mono font-medium text-blue-800">
                {formatPlDate(referenceDate)}
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap text-[11px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-red-100 border border-red-300 inline-block" />
                Termin wysyłki
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-amber-100 border border-amber-300 inline-block" />
                Dzień poprzedzający
              </span>
            </div>
            {selectedCalendarDay && (
              <div className="pt-2 flex items-center justify-between text-xs text-blue-700 font-medium">
                <span>
                  Filtr kalendarza: {formatPlDate(selectedCalendarDay)} (+1 dz.)
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCalendarDay(null)}
                  className="underline cursor-pointer"
                >
                  Wyczyść
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right: Organizer Table */}
        <section className="xl:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
          {/* Table Controls */}
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                {[
                  { id: "all", label: "Wszystkie" },
                  { id: "urgent", label: "Pilne (dziś/jutro)" },
                  { id: "active", label: "W toku" },
                  { id: "done", label: "Wysłane" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setStatusFilter(tab.id as typeof statusFilter)
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === tab.id
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                aria-label="Wybierz rok wniosków"
                className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 cursor-pointer"
              >
                <option value="all">Wszystkie lata</option>
                {yearsAvailable.map((y) => (
                  <option key={y} value={y}>
                    Rok {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Szukaj sprawy, osoby..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setSortOrder((prev) =>
                    prev === "oldest"
                      ? "urgent"
                      : prev === "urgent"
                      ? "newest"
                      : "oldest"
                  )
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {sortOrder === "oldest"
                  ? "Od najstarszego"
                  : sortOrder === "newest"
                  ? "Od najnowszego"
                  : "Najpilniejsze"}
              </button>
            </div>
          </div>

          {/* Dense Spreadsheet Table */}
          {filteredCases.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-900">
                Brak wniosków spełniających wybrane kryteria
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Zmień filtry kalendarza lub wgraj nowy wniosek o informację
                publiczną.
              </p>
              <button
                type="button"
                onClick={onNewRequest}
                className="mt-4 px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-lg hover:bg-blue-800 cursor-pointer"
              >
                Wgraj nowy wniosek
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-3 w-10">Lp.</th>
                    <th className="py-2.5 px-3">Numer sprawy</th>
                    <th className="py-2.5 px-3">Wnioskodawca i temat</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Wpływ</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Termin</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Pozostało</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Prowadz.</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 text-right">Akcja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredCases.map((item) => {
                    const urgency = getDeadlineUrgency(
                      item.dueDate,
                      item.status,
                      referenceDate
                    );
                    const dept = departments.find(
                      (d) => d.id === item.recommendedDepartmentId
                    );
                    const rowBg =
                      urgency.level === "today" || urgency.level === "overdue"
                        ? "bg-red-50/75 hover:bg-red-50"
                        : urgency.level === "tomorrow"
                        ? "bg-amber-50/75 hover:bg-amber-50"
                        : "bg-white hover:bg-slate-50";

                    const urgencyTextClass =
                      urgency.level === "overdue" || urgency.level === "today"
                        ? "text-red-700 font-semibold"
                        : urgency.level === "tomorrow"
                        ? "text-amber-700 font-semibold"
                        : urgency.level === "done"
                        ? "text-emerald-700 font-medium"
                        : "text-slate-600";

                    return (
                      <tr
                        key={item.id}
                        className={`${rowBg} transition-colors`}
                      >
                        <td className="py-3 px-3 font-mono text-slate-500 tabular-nums align-top">
                          {item.lp}
                        </td>
                        <td className="py-3 px-3 align-top">
                          <div className="font-mono font-medium text-slate-900 whitespace-nowrap">
                            {item.caseNumber}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {dept ? dept.code : "BKS"}
                            {item.kwerendaDays > 0 &&
                              ` · Kwerenda +${item.kwerendaDays} dn.`}
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top max-w-xs">
                          <div className="font-medium text-slate-900 truncate">
                            {item.applicant}
                          </div>
                          <div className="text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                            {item.subject}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap tabular-nums align-top">
                          {formatPlDate(item.receivedDate)}
                        </td>
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <div className="font-mono text-slate-900 tabular-nums">
                            {formatPlDate(item.dueDate)}
                          </div>
                          {item.responseDate && (
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              Odp.: {formatPlDate(item.responseDate)}
                            </div>
                          )}
                        </td>
                        <td
                          className={`py-3 px-3 whitespace-nowrap tabular-nums align-top ${urgencyTextClass}`}
                        >
                          {urgency.label}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-700 align-top">
                          {item.assignee}
                        </td>
                        <td className="py-3 px-3 align-top">
                          <select
                            value={item.status}
                            onChange={(e) =>
                              onUpdateCase(item.id, {
                                status: e.target.value as WorkflowStatus,
                                responseDate:
                                  e.target.value === "wyslana"
                                    ? referenceDate
                                    : null,
                              })
                            }
                            aria-label={`Status sprawy ${item.caseNumber}`}
                            className={`text-xs font-medium bg-transparent border border-slate-200 rounded px-2 py-1 cursor-pointer ${
                              STATUS_META[item.status].textClass
                            }`}
                          >
                            {Object.entries(STATUS_META).map(([key, meta]) => (
                              <option key={key} value={key}>
                                {meta.shortLabel}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3 text-right align-top">
                          <button
                            type="button"
                            onClick={() => onOpenCase(item.id)}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:text-white hover:bg-blue-700 border border-blue-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                          >
                            Otwórz
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
