import { PiiSpan, WorkflowStatus } from "../types";

export const STATUS_META: Record<
  WorkflowStatus,
  { label: string; shortLabel: string; textClass: string; bgClass: string }
> = {
  brak_dzialan: {
    label: "Brak działań",
    shortLabel: "Brak działań",
    textClass: "text-slate-700",
    bgClass: "bg-slate-100",
  },
  zapytania_wyslane: {
    label: "Zapytania wysłane do wydziałów",
    shortLabel: "W wydziałach",
    textClass: "text-blue-700",
    bgClass: "bg-blue-50",
  },
  kwerenda: {
    label: "Kwerenda (przedłużenie terminu)",
    shortLabel: "Kwerenda",
    textClass: "text-amber-700",
    bgClass: "bg-amber-50",
  },
  doprecyzowanie: {
    label: "Wezwanie do doprecyzowania",
    shortLabel: "Doprecyzowanie",
    textClass: "text-amber-800",
    bgClass: "bg-amber-50",
  },
  przygotowana: {
    label: "Przygotowana odpowiedź",
    shortLabel: "Przygotowana",
    textClass: "text-indigo-700",
    bgClass: "bg-indigo-50",
  },
  wyslana: {
    label: "Odpowiedź wysłana",
    shortLabel: "Wysłana",
    textClass: "text-emerald-700",
    bgClass: "bg-emerald-50",
  },
};

export function formatPlDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function diffDays(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

export function addDaysIso(baseIso: string, days: number): string {
  const [y, m, d] = baseIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function getDeadlineUrgency(
  dueDate: string,
  status: WorkflowStatus,
  referenceDate: string
): {
  daysLeft: number;
  level: "done" | "overdue" | "today" | "tomorrow" | "soon" | "normal";
  label: string;
} {
  if (status === "wyslana") {
    return { daysLeft: 0, level: "done", label: "Zakończono" };
  }
  const daysLeft = diffDays(referenceDate, dueDate);
  if (daysLeft < 0) {
    return {
      daysLeft,
      level: "overdue",
      label: `Po terminie (${Math.abs(daysLeft)} dn.)`,
    };
  }
  if (daysLeft === 0) {
    return { daysLeft: 0, level: "today", label: "Dziś termin" };
  }
  if (daysLeft === 1) {
    return { daysLeft: 1, level: "tomorrow", label: "Jutro termin" };
  }
  if (daysLeft <= 3) {
    return { daysLeft, level: "soon", label: `Za ${daysLeft} dni` };
  }
  return { daysLeft, level: "normal", label: `Za ${daysLeft} dni` };
}

export function buildExportTextWithRedactions(
  text: string,
  piiItems: PiiSpan[]
): string {
  const accepted = [...piiItems]
    .filter((p) => p.state === "accepted")
    .sort((a, b) => a.start - b.start);

  if (accepted.length === 0) return text;

  let cursor = 0;
  let output = "";
  for (const span of accepted) {
    if (span.start < cursor || span.end > text.length) continue;
    output += text.slice(cursor, span.start);
    output += "[ANONIMIZOWANO]";
    cursor = span.end;
  }
  output += text.slice(cursor);
  return output;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku."));
    reader.readAsDataURL(file);
  });
}
