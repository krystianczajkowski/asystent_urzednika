import React, { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { AppView, TopBar } from "./components/TopBar";
import { CalendarDashboard } from "./components/CalendarDashboard";
import { WorkflowWorkspace } from "./components/WorkflowWorkspace";
import { KnowledgeBaseView } from "./components/KnowledgeBaseView";
import { LocalArchitectureView } from "./components/LocalArchitectureView";
import {
  Department,
  InitialDataPayload,
  KnowledgeBaseEntry,
  SampleDocument,
  WniosekCase,
} from "./types";
import { addDaysIso, fileToBase64 } from "./utils/workflow";

export function App() {
  const [activeView, setActiveView] = useState<AppView>("calendar");
  const [cases, setCases] = useState<WniosekCase[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseEntry[]>([]);
  const [anonymizationRules, setAnonymizationRules] = useState<string[]>([]);
  const [sampleDocuments, setSampleDocuments] = useState<SampleDocument[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [referenceDate, setReferenceDate] = useState<string>("2026-09-18");

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [modalParsing, setModalParsing] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const modalFileRef = useRef<HTMLInputElement>(null);

  const fetchInitialData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/initial-data");
      const data = (await res.json()) as InitialDataPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || "Błąd ładowania danych");
      setCases(data.cases);
      setDepartments(data.departments);
      setKnowledgeBase(data.knowledgeBase);
      setAnonymizationRules(data.anonymizationRules);
      setSampleDocuments(data.sampleDocuments);
      if (data.cases.length > 0) {
        const urgentCase =
          data.cases.find((c) => c.status !== "wyslana") || data.cases[0];
        setActiveCaseId(urgentCase.id);
      }
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Nie udało się połączyć z serwerem aplikacji."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleOpenCase = (caseId: string) => {
    setActiveCaseId(caseId);
    setActiveView("workflow");
  };

  const handleUpdateCase = (caseId: string, patch: Partial<WniosekCase>) => {
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, ...patch } : c))
    );
  };

  const handleCreateCase = (newCase: WniosekCase) => {
    setCases((prev) => [...prev, newCase]);
    setActiveCaseId(newCase.id);
    setActiveView("workflow");
  };

  const createCaseFromContent = (
    content: string,
    label: string,
    applicant = "Nowy wnioskodawca"
  ) => {
    const nextLp =
      cases.reduce((max, c) => (c.lp > max ? c.lp : max), 0) + 1;
    const seq = 600 + nextLp;
    const created: WniosekCase = {
      id: `case-${Date.now()}`,
      lp: nextLp,
      caseNumber: `BKS.IV.1431.${seq}.2026`,
      applicant,
      subject: label,
      fullRequestText: content,
      receivedDate: referenceDate,
      dueDate: addDaysIso(referenceDate, 14),
      responseDate: null,
      assignee: "Pracownik 1",
      status: "brak_dzialan",
      kwerendaDays: 0,
      tags: ["UDIP"],
      summary: "",
      recommendedDepartmentId: "bks",
      departmentReplyText: "",
      draftResponseText: "",
      piiItems: [],
      savedToKnowledgeBase: false,
      analysis: null,
    };
    handleCreateCase(created);
    setIsUploadModalOpen(false);
    setManualText("");
    setModalError(null);
  };

  const handleModalFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setModalError(null);
    setModalParsing(true);
    try {
      const base64Data = await fileToBase64(file);
      const res = await fetch("/api/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, base64Data }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd odczytu pliku");
      createCaseFromContent(data.text, `Wniosek z pliku: ${file.name}`);
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Nie udało się odczytać pliku."
      );
    } finally {
      setModalParsing(false);
      e.target.value = "";
    }
  };

  const handleAddKbEntry = (entry: KnowledgeBaseEntry) => {
    setKnowledgeBase((prev) => [entry, ...prev]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeView={activeView}
        onNavigate={setActiveView}
        onNewRequest={() => {
          setModalError(null);
          setIsUploadModalOpen(true);
        }}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-8 w-72 bg-slate-200 rounded animate-pulse" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-white border border-slate-200 rounded-lg animate-pulse"
                />
              ))}
            </div>
            <div className="h-96 bg-white border border-slate-200 rounded-lg animate-pulse" />
          </div>
        ) : loadError ? (
          <div className="bg-white border border-red-200 rounded-lg p-8 text-center max-w-lg mx-auto mt-12">
            <h2 className="text-base font-semibold text-red-900">
              Błąd uruchamiania przestrzeni roboczej
            </h2>
            <p className="text-xs text-red-700 mt-1">{loadError}</p>
            <button
              type="button"
              onClick={fetchInitialData}
              className="mt-4 px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-lg cursor-pointer"
            >
              Spróbuj ponownie
            </button>
          </div>
        ) : (
          <>
            {activeView === "calendar" && (
              <CalendarDashboard
                cases={cases}
                departments={departments}
                referenceDate={referenceDate}
                onChangeReferenceDate={setReferenceDate}
                onOpenCase={handleOpenCase}
                onUpdateCase={handleUpdateCase}
                onNewRequest={() => setIsUploadModalOpen(true)}
              />
            )}

            {activeView === "workflow" && (
              <WorkflowWorkspace
                cases={cases}
                activeCaseId={activeCaseId}
                departments={departments}
                knowledgeBase={knowledgeBase}
                sampleDocuments={sampleDocuments}
                referenceDate={referenceDate}
                onSelectCase={setActiveCaseId}
                onCreateCase={handleCreateCase}
                onUpdateCase={handleUpdateCase}
                onSaveToKnowledgeBase={handleAddKbEntry}
                onBackToCalendar={() => setActiveView("calendar")}
              />
            )}

            {activeView === "knowledge" && (
              <KnowledgeBaseView
                entries={knowledgeBase}
                departments={departments}
                anonymizationRules={anonymizationRules}
                onAddEntry={handleAddKbEntry}
              />
            )}

            {activeView === "architecture" && <LocalArchitectureView />}
          </>
        )}
      </main>

      {/* New Request Intake Modal */}
      {isUploadModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Wgraj nowy wniosek UDIP
              </h2>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                aria-label="Zamknij okno"
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-800">
                {modalError}
              </div>
            )}

            <div className="space-y-2">
              <input
                ref={modalFileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleModalFileUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={modalParsing}
                onClick={() => modalFileRef.current?.click()}
                className="w-full py-6 px-4 border border-dashed border-slate-300 hover:border-blue-600 rounded-lg flex flex-col items-center justify-center gap-2 text-xs text-slate-700 hover:text-blue-700 transition-colors cursor-pointer"
              >
                {modalParsing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-blue-700" />
                    <span>Wyodrębnianie tekstu dokumentu...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-blue-700" />
                    <span className="font-semibold">
                      Wybierz plik PDF, Word (.docx) lub TXT z dysku
                    </span>
                    <span className="text-slate-500">
                      Termin 14 dni zostanie wyliczony automatycznie od{" "}
                      {referenceDate}
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="text-xs font-medium text-slate-700">
                Lub wybierz gotowy dokument testowy:
              </div>
              <div className="space-y-1.5">
                {sampleDocuments.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      createCaseFromContent(
                        s.content,
                        s.label,
                        s.id === "sample-pii-test"
                          ? "Jan Kowalski"
                          : s.id === "sample-schronisko"
                          ? "Fundacja Przyjazna Łapa"
                          : "Redakcja Lokalna Bydgoszcz"
                      )
                    }
                    className="w-full text-left px-3 py-2 border border-slate-200 hover:border-blue-600 hover:bg-blue-50/40 rounded-md text-xs transition-colors cursor-pointer"
                  >
                    <div className="font-semibold text-slate-900">
                      {s.label}
                    </div>
                    <div className="text-slate-500 mt-0.5">{s.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-xs font-medium text-slate-700">
                Albo wklej treść wniosku bezpośrednio:
              </label>
              <textarea
                rows={4}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Wklej treść pytania mieszkańca lub dziennikarza..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  disabled={!manualText.trim()}
                  onClick={() =>
                    createCaseFromContent(
                      manualText.trim(),
                      manualText.trim().slice(0, 90)
                    )
                  }
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg cursor-pointer"
                >
                  Utwórz sprawę i analizuj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
