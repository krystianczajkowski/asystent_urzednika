import React, { useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Building2,
  FilePlus2,
  Scale,
  Search,
  ShieldAlert,
} from "lucide-react";
import { Department, KnowledgeBaseEntry } from "../types";
import { fileToBase64, formatPlDate } from "../utils/workflow";

interface KnowledgeBaseViewProps {
  entries: KnowledgeBaseEntry[];
  departments: Department[];
  anonymizationRules: string[];
  onAddEntry: (entry: KnowledgeBaseEntry) => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  entries,
  departments,
  anonymizationRules,
  onAddEntry,
}) => {
  const [activeTab, setActiveTab] = useState<"kb" | "departments" | "rodo">(
    "kb"
  );
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "archival_qa" | "legal_act" | "ordinance"
  >("all");
  const [title, setTitle] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [department, setDepartment] = useState("Biuro Komunikacji Społecznej");
  const [entryType, setEntryType] = useState<
    "archival_qa" | "legal_act" | "ordinance"
  >("archival_qa");
  const [answerText, setAnswerText] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.caseNumber.toLowerCase().includes(q) ||
        e.questionSummary.toLowerCase().includes(q) ||
        e.answerText.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [entries, typeFilter, search]);

  const handleUploadFileToKb = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("Odczytywanie pliku...");
    try {
      const base64Data = await fileToBase64(file);
      const res = await fetch("/api/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, base64Data }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd odczytu");
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      setAnswerText(data.text);
      setUploadStatus(`Wczytano treść z pliku ${file.name}. Sprawdź i zapisz.`);
    } catch (err) {
      setUploadStatus(
        err instanceof Error ? err.message : "Nie udało się wczytać pliku."
      );
    }
  };

  const handleSaveNewEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !answerText.trim()) return;
    const created: KnowledgeBaseEntry = {
      id: `kb-${Date.now()}`,
      type: entryType,
      caseNumber: caseNumber.trim() || `AKT-${new Date().getFullYear()}`,
      title: title.trim(),
      department,
      date: new Date().toISOString().slice(0, 10),
      tags: [
        entryType === "legal_act"
          ? "ustawa"
          : entryType === "ordinance"
          ? "zarządzenie"
          : "archiwum",
        "Baza wiedzy",
      ],
      questionSummary: title.trim(),
      answerText: answerText.trim(),
    };
    onAddEntry(created);
    setTitle("");
    setCaseNumber("");
    setAnswerText("");
    setUploadStatus("Dodano dokument do Bazy Wiedzy. Sieć uwzględni go w kolejnych analizach.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Pamięć instytucjonalna Urzędu Miasta Bydgoszczy
          </p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Baza wiedzy, wydziały i katalog RODO
          </h1>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("kb")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "kb"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Archiwum i akty prawne ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("departments")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "departments"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Wydziały i dysponenci ({departments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rodo")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "rodo"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Katalog anonimizacji ({anonymizationRules.length})
          </button>
        </div>
      </div>

      {activeTab === "kb" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: List of Knowledge Base records */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3 justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Przeszukaj archiwalne odpowiedzi, ustawy, tagi..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as typeof typeFilter)
                }
                aria-label="Typ dokumentu"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md bg-white text-slate-700 cursor-pointer"
              >
                <option value="all">Wszystkie zasoby</option>
                <option value="archival_qa">Archiwalne odpowiedzi</option>
                <option value="legal_act">Ustawy (UDIP / KPA)</option>
                <option value="ordinance">Zarządzenia</option>
              </select>
            </div>

            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="bg-white border border-slate-200 rounded-lg p-5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.type === "legal_act" ? (
                        <Scale className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                      ) : (
                        <BookOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span className="font-mono font-medium text-slate-700">
                        {entry.caseNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{entry.department}</span>
                    </div>
                    <span className="font-mono tabular-nums shrink-0">
                      {formatPlDate(entry.date)}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900">
                    {entry.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {entry.answerText}
                  </p>

                  <div className="pt-1 text-xs text-slate-500">
                    {entry.tags.join(" · ")}
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Right: Upload / Teach Knowledge Base */}
          <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Dodaj dokument do Bazy Wiedzy
              </h2>
              <FilePlus2 className="w-4 h-4 text-blue-700" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Wgraj aktualną ustawę, zarządzenie Prezydenta Miasta lub
              archiwalną odpowiedź UDIP (PDF, DOCX, TXT). System natychmiast
              wykorzysta ją przy analizie kolejnych wniosków.
            </p>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleUploadFileToKb}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 border border-dashed border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
              >
                Wczytaj plik PDF / DOCX / TXT z dysku
              </button>
            </div>

            {uploadStatus && (
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                {uploadStatus}
              </p>
            )}

            <form onSubmit={handleSaveNewEntry} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Rodzaj materiału
                </label>
                <select
                  value={entryType}
                  onChange={(e) =>
                    setEntryType(e.target.value as typeof entryType)
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
                >
                  <option value="archival_qa">
                    Archiwalna odpowiedź na wniosek
                  </option>
                  <option value="legal_act">Ustawa / akt prawny</option>
                  <option value="ordinance">Zarządzenie / regulamin UMB</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Znak sprawy / sygnatura
                  </label>
                  <input
                    type="text"
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    placeholder="np. BKS.IV.1431.601.2026"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Wydział źródłowy
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tytuł / przedmiot zagadnienia
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="np. Zasady udostępniania umów miejskich..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Treść odpowiedzi lub przepisu
                </label>
                <textarea
                  required
                  rows={6}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Wklej treść odpowiedzi, którą system ma podpowiadać przy podobnych zapytaniach..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                Zapisz w Bazie Wiedzy
              </button>
            </form>
          </aside>
        </div>
      )}

      {activeTab === "departments" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="bg-white border border-slate-200 rounded-lg p-5 space-y-2"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono font-semibold text-blue-700">
                  {dept.code}
                </span>
                <span>
                  {dept.isExternal
                    ? "Podmiot zewnętrzny (art. 4 ust. 3 UDIP)"
                    : "Komórka organizacyjna UMB"}
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{dept.name}</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {dept.scope}
              </p>
              <div className="pt-1 text-xs font-mono text-slate-500">
                {dept.contactEmail}
                {dept.phone ? ` · ${dept.phone}` : ""}
                {dept.address ? ` · ${dept.address}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "rodo" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-start gap-3 pb-4 border-b border-slate-200">
            <ShieldAlert className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Reguły anonimizacji Urzędu Miasta Bydgoszczy
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Katalog wczytany bezpośrednio z dokumentu referencyjnego
                urzędu. Moduł wykrywania danych wrażliwych automatycznie
                oznacza poniższe kategorie na szaro do akceptacji urzędnika.
              </p>
            </div>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 pt-4 text-xs text-slate-700">
            {anonymizationRules.map((rule, idx) => (
              <li key={rule} className="flex items-baseline gap-2.5 py-1">
                <span className="font-mono text-slate-400 tabular-nums w-6 shrink-0">
                  {String(idx + 1).padStart(2, "0")}.
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};
