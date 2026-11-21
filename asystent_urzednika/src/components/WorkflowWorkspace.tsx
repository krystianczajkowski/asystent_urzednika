import React, { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  GitBranch,
  Loader2,
  Plus,
  RotateCcw,
  ScanSearch,
  Send,
  Shield,
  Upload,
} from "lucide-react";
import {
  Department,
  KnowledgeBaseEntry,
  NeuralAnalysis,
  PiiSpan,
  ResponseMode,
  SampleDocument,
  WniosekCase,
  WorkflowStatus,
} from "../types";
import {
  STATUS_META,
  addDaysIso,
  buildExportTextWithRedactions,
  fileToBase64,
  formatPlDate,
} from "../utils/workflow";

interface WorkflowWorkspaceProps {
  cases: WniosekCase[];
  activeCaseId: string | null;
  departments: Department[];
  knowledgeBase: KnowledgeBaseEntry[];
  sampleDocuments: SampleDocument[];
  referenceDate: string;
  onSelectCase: (caseId: string) => void;
  onCreateCase: (newCase: WniosekCase) => void;
  onUpdateCase: (caseId: string, patch: Partial<WniosekCase>) => void;
  onSaveToKnowledgeBase: (entry: KnowledgeBaseEntry) => void;
  onBackToCalendar: () => void;
}

export const WorkflowWorkspace: React.FC<WorkflowWorkspaceProps> = ({
  cases,
  activeCaseId,
  departments,
  knowledgeBase,
  sampleDocuments,
  referenceDate,
  onSelectCase,
  onCreateCase,
  onUpdateCase,
  onSaveToKnowledgeBase,
  onBackToCalendar,
}) => {
  const activeCase = useMemo(
    () => cases.find((c) => c.id === activeCaseId) || cases[0] || null,
    [cases, activeCaseId]
  );

  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isScanningPii, setIsScanningPii] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [responseMode, setResponseMode] = useState<ResponseMode>("merit");
  const [officialNotes, setOfficialNotes] = useState("");
  const [draftEditorMode, setDraftEditorMode] = useState<"anonymize" | "edit">(
    "anonymize"
  );
  const [selectedCustomRange, setSelectedCustomRange] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const [copiedInquiry, setCopiedInquiry] = useState(false);

  const requestFileInputRef = useRef<HTMLInputElement>(null);
  const deptReplyFileInputRef = useRef<HTMLInputElement>(null);
  const visualDraftRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleCreateBlankCase = (
    prefill?: Partial<WniosekCase>
  ): WniosekCase => {
    const nextLp =
      cases.reduce((max, c) => (c.lp > max ? c.lp : max), 0) + 1;
    const seq = 600 + nextLp;
    const created: WniosekCase = {
      id: `case-${Date.now()}`,
      lp: nextLp,
      caseNumber: `BKS.IV.1431.${seq}.2026`,
      applicant: "Nowy wnioskodawca",
      subject: "Nowy wniosek o udostępnienie informacji publicznej",
      fullRequestText: "",
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
      ...prefill,
    };
    onCreateCase(created);
    return created;
  };

  const handleUploadIncomingFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    asNewCase: boolean
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsParsingFile(true);
    try {
      const base64Data = await fileToBase64(file);
      const res = await fetch("/api/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, base64Data }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd odczytu pliku");

      if (asNewCase || !activeCase) {
        const created = handleCreateBlankCase({
          subject: `Wniosek z pliku: ${file.name}`,
          fullRequestText: data.text,
        });
        showToast(`Utworzono nową sprawę ${created.caseNumber} z pliku ${file.name}.`);
      } else {
        onUpdateCase(activeCase.id, { fullRequestText: data.text });
        showToast(`Wczytano treść dokumentu ${file.name}.`);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Nie udało się wczytać dokumentu."
      );
    } finally {
      setIsParsingFile(false);
      e.target.value = "";
    }
  };

  const handleLoadSampleDoc = (sample: SampleDocument) => {
    setErrorMsg(null);
    const created = handleCreateBlankCase({
      subject: sample.label,
      fullRequestText: sample.content,
      applicant:
        sample.id === "sample-pii-test"
          ? "Jan Kowalski"
          : sample.id === "sample-schronisko"
          ? "Fundacja Przyjazna Łapa"
          : "Redakcja Lokalna Bydgoszcz",
    });
    showToast(`Załadowano próbkę „${sample.fileName}” jako sprawę ${created.caseNumber}.`);
  };

  const handleUploadDeptReply = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !activeCase) return;
    setErrorMsg(null);
    setIsParsingFile(true);
    try {
      const base64Data = await fileToBase64(file);
      const res = await fetch("/api/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, base64Data }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd odczytu pliku wydziału");

      const combined = activeCase.departmentReplyText
        ? `${activeCase.departmentReplyText}\n\n[${file.name}]\n${data.text}`
        : data.text;
      onUpdateCase(activeCase.id, { departmentReplyText: combined });
      showToast(`Dodano odpowiedź z wydziału (${file.name}).`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Nie udało się odczytać pliku z wydziału."
      );
    } finally {
      setIsParsingFile(false);
      e.target.value = "";
    }
  };

  const handleRunNeuralAnalysis = async () => {
    if (!activeCase || !activeCase.fullRequestText.trim()) {
      setErrorMsg("Wpisz lub wgraj treść wniosku przed analizą.");
      return;
    }
    setErrorMsg(null);
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: activeCase.fullRequestText,
          knowledgeBase,
          departments,
          currentDepartment: "Biuro Komunikacji Społecznej (BKS)",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd analizy neuronowej");

      const analysis = data.analysis as NeuralAnalysis;
      const topRoute = analysis.routingPredictions?.[0];

      // Auto-select appropriate response mode if external redirect or clarification
      if (topRoute?.actionType === "external_redirect") {
        setResponseMode("redirect");
      } else if (topRoute?.actionType === "clarification") {
        setResponseMode("clarification");
      } else {
        setResponseMode("merit");
      }

      onUpdateCase(activeCase.id, {
        analysis,
        summary: analysis.summary || activeCase.summary,
        tags: analysis.tags?.length ? analysis.tags : activeCase.tags,
        applicant:
          analysis.extractedMetadata?.applicantName || activeCase.applicant,
        subject: analysis.extractedMetadata?.subject || activeCase.subject,
        recommendedDepartmentId:
          topRoute?.departmentId || activeCase.recommendedDepartmentId,
      });
      showToast("Analiza neuronowa zakończona. Sprawdź dopasowania i ścieżkę.");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Błąd podczas analizy AI."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleScanPii = async (targetText: string, updateDraft?: boolean) => {
    if (!activeCase || !targetText.trim()) return;
    setErrorMsg(null);
    setIsScanningPii(true);
    try {
      const res = await fetch("/api/detect-pii", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: targetText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd wykrywania danych");

      const piiItems = (data.piiItems || []) as PiiSpan[];
      const patch: Partial<WniosekCase> = { piiItems };
      if (updateDraft) {
        patch.draftResponseText = targetText;
      }
      onUpdateCase(activeCase.id, patch);
      setDraftEditorMode("anonymize");
      showToast(
        piiItems.length > 0
          ? `Wykryto ${piiItems.length} fragmentów do potencjalnej anonimizacji (podświetlone na szaro).`
          : "Nie wykryto danych podlegających anonimizacji."
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Błąd podczas skanowania danych wrażliwych."
      );
    } finally {
      setIsScanningPii(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!activeCase) return;
    setErrorMsg(null);
    setIsGeneratingDraft(true);
    try {
      const similarContext = activeCase.analysis?.similarCases
        ?.map((s) => `[${s.caseNumber}] ${s.title}: ${s.reusableExcerpt}`)
        .join("\n");

      const res = await fetch("/api/generate-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseNumber: activeCase.caseNumber,
          applicant: activeCase.applicant,
          requestText: activeCase.fullRequestText,
          departmentReplyText: activeCase.departmentReplyText,
          responseMode,
          similarContext,
          officialNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd generowania pisma");

      const draftText = data.draftText as string;
      onUpdateCase(activeCase.id, {
        draftResponseText: draftText,
        status:
          activeCase.status === "wyslana" ? "wyslana" : "przygotowana",
      });

      // Automatically scan generated draft for PII (grey suggestions)
      await handleScanPii(draftText, false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Nie udało się wygenerować projektu odpowiedzi."
      );
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const togglePiiState = (spanId: string) => {
    if (!activeCase) return;
    const updated = activeCase.piiItems.map((item) => {
      if (item.id !== spanId) return item;
      const nextState: PiiSpan["state"] =
        item.state === "suggested"
          ? "accepted"
          : item.state === "accepted"
          ? "rejected"
          : "suggested";
      return { ...item, state: nextState };
    });
    onUpdateCase(activeCase.id, { piiItems: updated });
  };

  const acceptAllPii = () => {
    if (!activeCase) return;
    const updated = activeCase.piiItems.map((item) =>
      item.state === "rejected" ? item : { ...item, state: "accepted" as const }
    );
    onUpdateCase(activeCase.id, { piiItems: updated });
    showToast("Zatwierdzono wszystkie wskazane dane (zamiana na czarno).");
  };

  const resetAllPiiToSuggested = () => {
    if (!activeCase) return;
    const updated = activeCase.piiItems.map((item) => ({
      ...item,
      state: "suggested" as const,
    }));
    onUpdateCase(activeCase.id, { piiItems: updated });
  };

  const handleTextSelectionInVisual = () => {
    if (!visualDraftRef.current || !activeCase) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectedCustomRange(null);
      return;
    }
    const selectedStr = sel.toString().trim();
    if (selectedStr.length < 2) {
      setSelectedCustomRange(null);
      return;
    }
    const idx = activeCase.draftResponseText.indexOf(selectedStr);
    if (idx === -1) {
      setSelectedCustomRange(null);
      return;
    }
    setSelectedCustomRange({
      text: selectedStr,
      start: idx,
      end: idx + selectedStr.length,
    });
  };

  const addManualRedaction = () => {
    if (!activeCase || !selectedCustomRange) return;
    const { text, start, end } = selectedCustomRange;
    const overlaps = activeCase.piiItems.some(
      (p) => !(end <= p.start || start >= p.end)
    );
    if (overlaps) {
      setErrorMsg("Zaznaczony fragment pokrywa się z istniejącą pozycją anonimizacji.");
      return;
    }
    const newSpan: PiiSpan = {
      id: `pii-manual-${Date.now()}`,
      text,
      category: "Oznaczone ręcznie przez urzędnika",
      reason: "Dodatkowa anonimizacja zatwierdzona przez urzędnika",
      start,
      end,
      state: "accepted",
    };
    const next = [...activeCase.piiItems, newSpan].sort(
      (a, b) => a.start - b.start
    );
    onUpdateCase(activeCase.id, { piiItems: next });
    setSelectedCustomRange(null);
    window.getSelection()?.removeAllRanges();
    showToast(`Ukryto fragment: „${text}”`);
  };

  const handleExport = async (format: "doc" | "txt") => {
    if (!activeCase || !activeCase.draftResponseText) return;
    const redactedContent = buildExportTextWithRedactions(
      activeCase.draftResponseText,
      activeCase.piiItems
    );

    const res = await fetch("/api/export-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseNumber: activeCase.caseNumber,
        content: redactedContent,
        format,
      }),
    });
    if (!res.ok) {
      setErrorMsg("Nie udało się wyeksportować pliku.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeCase.caseNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Wyeksportowano zanonimizowany dokument (.${format}).`);
  };

  const handleSaveCaseToKb = () => {
    if (!activeCase) return;
    const dept = departments.find(
      (d) => d.id === activeCase.recommendedDepartmentId
    );
    const answerToSave = buildExportTextWithRedactions(
      activeCase.draftResponseText || activeCase.departmentReplyText,
      activeCase.piiItems
    );
    if (!answerToSave.trim()) {
      setErrorMsg("Brak treści odpowiedzi do zapisania w Bazie Wiedzy.");
      return;
    }
    onSaveToKnowledgeBase({
      id: `kb-${Date.now()}`,
      type: "archival_qa",
      caseNumber: activeCase.caseNumber,
      title: activeCase.subject,
      department: dept ? `${dept.name} (${dept.code})` : "BKS",
      date: referenceDate,
      tags: activeCase.tags,
      questionSummary: activeCase.summary || activeCase.subject,
      answerText: answerToSave,
    });
    onUpdateCase(activeCase.id, { savedToKnowledgeBase: true });
    showToast("Zapisano sprawę w Bazie Wiedzy do wykorzystania w przyszłości.");
  };

  const handleApplyKwerenda = (days: number) => {
    if (!activeCase) return;
    const newDue = addDaysIso(activeCase.dueDate, days);
    onUpdateCase(activeCase.id, {
      kwerendaDays: activeCase.kwerendaDays + days,
      dueDate: newDue,
      status: "kwerenda",
    });
    showToast(`Przedłużono termin (kwerenda +${days} dni) do ${formatPlDate(newDue)}.`);
  };

  const copyInquiryToClipboard = async () => {
    if (!activeCase?.analysis?.departmentInquiryDraft) return;
    await navigator.clipboard.writeText(
      activeCase.analysis.departmentInquiryDraft
    );
    setCopiedInquiry(true);
    setTimeout(() => setCopiedInquiry(false), 2500);
  };

  // Render visual draft text split by PII spans
  const renderedVisualSegments = useMemo(() => {
    if (!activeCase) return [];
    const text = activeCase.draftResponseText;
    if (!text) return [];
    const sorted = [...activeCase.piiItems]
      .filter((p) => p.start >= 0 && p.end <= text.length)
      .sort((a, b) => a.start - b.start);

    const nodes: Array<
      | { kind: "plain"; key: string; text: string }
      | { kind: "span"; key: string; span: PiiSpan }
    > = [];
    let cursor = 0;
    for (const span of sorted) {
      if (span.start < cursor) continue;
      if (span.start > cursor) {
        nodes.push({
          kind: "plain",
          key: `plain-${cursor}`,
          text: text.slice(cursor, span.start),
        });
      }
      nodes.push({
        kind: "span",
        key: span.id,
        span,
      });
      cursor = span.end;
    }
    if (cursor < text.length) {
      nodes.push({
        kind: "plain",
        key: `plain-${cursor}`,
        text: text.slice(cursor),
      });
    }
    return nodes;
  }, [activeCase]);

  if (!activeCase) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
        <p className="text-base font-semibold text-slate-900">
          Brak wybranej sprawy
        </p>
        <button
          type="button"
          onClick={() => handleCreateBlankCase()}
          className="mt-4 px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-lg cursor-pointer"
        >
          Utwórz pierwszy wniosek
        </button>
      </div>
    );
  }

  const pendingSuggestionsCount = activeCase.piiItems.filter(
    (p) => p.state === "suggested"
  ).length;
  const acceptedRedactionsCount = activeCase.piiItems.filter(
    (p) => p.state === "accepted"
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Case Selector & Status Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBackToCalendar}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 underline cursor-pointer"
          >
            ← Wróć do kalendarza
          </button>
          <span className="text-slate-300" aria-hidden="true">
            /
          </span>
          <select
            value={activeCase.id}
            onChange={(e) => onSelectCase(e.target.value)}
            aria-label="Wybierz aktywną sprawę"
            className="px-3 py-1.5 text-sm font-mono font-medium bg-white border border-slate-200 rounded-md text-slate-900 cursor-pointer"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.caseNumber} — {c.applicant}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handleCreateBlankCase()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nowa pusta sprawa
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Status sprawy:</span>
          <select
            value={activeCase.status}
            onChange={(e) =>
              onUpdateCase(activeCase.id, {
                status: e.target.value as WorkflowStatus,
                responseDate:
                  e.target.value === "wyslana" ? referenceDate : null,
              })
            }
            aria-label="Status bieżącej sprawy"
            className={`px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white cursor-pointer ${
              STATUS_META[activeCase.status].textClass
            }`}
          >
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Feedback Banners */}
      {errorMsg && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4 text-xs text-red-800"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="font-medium underline shrink-0 cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      )}

      {toastMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs font-medium text-blue-900">
          <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Visual Workflow Pipeline Bar (from handwritten sketch) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {[
            {
              step: "01",
              title: "Wniosek i podgląd",
              done: Boolean(activeCase.fullRequestText),
            },
            {
              step: "02",
              title: "Analiza i Baza Wiedzy",
              done: Boolean(activeCase.analysis),
            },
            {
              step: "03",
              title: "Ścieżka / Redirect",
              done:
                activeCase.status === "zapytania_wyslane" ||
                Boolean(activeCase.analysis?.routingPredictions?.length),
            },
            {
              step: "04",
              title: "Dane z wydziału",
              done: Boolean(activeCase.departmentReplyText),
            },
            {
              step: "05",
              title: "Projekt i anonimizacja",
              done: Boolean(activeCase.draftResponseText),
            },
            {
              step: "06",
              title: "Eksport i archiwum",
              done:
                activeCase.status === "wyslana" ||
                activeCase.savedToKnowledgeBase,
            },
          ].map((s) => (
            <div
              key={s.step}
              className={`border rounded-md px-3 py-2 flex items-center gap-2 ${
                s.done
                  ? "border-blue-200 bg-blue-50/50 text-slate-900"
                  : "border-slate-200 bg-slate-50/50 text-slate-500"
              }`}
            >
              <span
                className={`font-mono text-[11px] font-semibold ${
                  s.done ? "text-blue-700" : "text-slate-400"
                }`}
              >
                {s.step}
              </span>
              <span className="font-medium truncate">{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Document Intake, Metadata, Neural Analysis & Routing */}
        <div className="xl:col-span-5 space-y-6">
          {/* 1. Document Intake & Metadata Verification */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                <span>01. Wpływający wniosek (Żądanie)</span>
              </h2>

              <div>
                <input
                  ref={requestFileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => handleUploadIncomingFile(e, false)}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isParsingFile}
                  onClick={() => requestFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {isParsingFile ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  Wgraj PDF / Word
                </button>
              </div>
            </div>

            {/* Quick Sample Test Files */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-slate-500">
                Gotowe materiały testowe do szybkiej walidacji:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sampleDocuments.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleLoadSampleDoc(sample)}
                    title={sample.description}
                    className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-800 text-slate-700 rounded-md transition-colors cursor-pointer"
                  >
                    + {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Request Textarea */}
            <textarea
              rows={7}
              value={activeCase.fullRequestText}
              onChange={(e) =>
                onUpdateCase(activeCase.id, { fullRequestText: e.target.value })
              }
              placeholder="Wklej treść wniosku UDIP lub wgraj plik PDF / DOCX..."
              className="w-full p-3 text-xs text-slate-800 border border-slate-200 rounded-md leading-relaxed focus:outline-none focus:border-blue-600"
            />

            {/* Editable Metadata Bar (Step 5 of spec: urzędnik akceptuje dane) */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Numer sprawy
                </label>
                <input
                  type="text"
                  value={activeCase.caseNumber}
                  onChange={(e) =>
                    onUpdateCase(activeCase.id, { caseNumber: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Wnioskodawca
                </label>
                <input
                  type="text"
                  value={activeCase.applicant}
                  onChange={(e) =>
                    onUpdateCase(activeCase.id, { applicant: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Data wpływu
                </label>
                <input
                  type="date"
                  value={activeCase.receivedDate}
                  onChange={(e) =>
                    onUpdateCase(activeCase.id, {
                      receivedDate: e.target.value,
                    })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Termin odpowiedzi
                </label>
                <input
                  type="date"
                  value={activeCase.dueDate}
                  onChange={(e) =>
                    onUpdateCase(activeCase.id, { dueDate: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Inicjały / Osoba odp.
                </label>
                <input
                  type="text"
                  value={activeCase.assignee}
                  onChange={(e) =>
                    onUpdateCase(activeCase.id, { assignee: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs"
                />
              </div>
              <div className="flex items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyKwerenda(14)}
                  className="w-full py-1.5 px-2.5 text-xs font-medium border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-md cursor-pointer"
                >
                  + Kwerenda (14 dn.)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleRunNeuralAnalysis}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizowanie wniosku...
                  </>
                ) : (
                  <>
                    <ScanSearch className="w-4 h-4" />
                    Uruchom analizę neuronową i przeszukaj Bazę Wiedzy
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isScanningPii || !activeCase.fullRequestText.trim()}
                onClick={() =>
                  handleScanPii(activeCase.fullRequestText, true)
                }
                title="Przetestuj anonimizację bezpośrednio na wgranym dokumencie"
                className="py-2.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
              >
                Anonimizuj plik wejściowy
              </button>
            </div>
          </section>

          {/* 2. Neural Analysis Results: Summary, Tags, Knowledge Base Check, Routing */}
          {activeCase.analysis && (
            <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  02. Wynik analizy i podsumowanie
                </h2>
                <p className="text-xs text-slate-700 leading-relaxed mt-2">
                  {activeCase.analysis.summary}
                </p>
                <div className="mt-2 text-xs text-slate-500">
                  Tagi: {activeCase.analysis.tags.join(" · ")}
                </div>
                {activeCase.analysis.legalBasis?.length > 0 && (
                  <div className="mt-1 text-xs text-slate-500">
                    Podstawa prawna:{" "}
                    <span className="font-mono text-slate-700">
                      {activeCase.analysis.legalBasis.join(" · ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Knowledge Base Decision Box (TAK / NIE from handwritten sketch) */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Baza wiedzy: czy podobne pytanie było zadane wcześniej?
                  </h3>
                  <span
                    className={`text-xs font-bold font-mono ${
                      activeCase.analysis.knowledgeBaseMatchFound
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {activeCase.analysis.knowledgeBaseMatchFound
                      ? "TAK — ZNALEZIONO"
                      : "NIE — NOWE PYTANIE"}
                  </span>
                </div>

                {activeCase.analysis.similarCases?.length > 0 ? (
                  <div className="space-y-2.5">
                    {activeCase.analysis.similarCases.map((sim) => (
                      <div
                        key={sim.kbId + sim.caseNumber}
                        className="border border-slate-200 rounded-md p-3 space-y-1.5 bg-slate-50/60"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold text-blue-700">
                            {sim.caseNumber}
                          </span>
                          <span className="font-mono font-semibold text-slate-700 tabular-nums">
                            Podobieństwo: {sim.similarityPercent}%
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-900">
                          {sim.title}
                        </div>
                        <p className="text-xs text-slate-600">{sim.reason}</p>
                        {sim.reusableExcerpt && (
                          <button
                            type="button"
                            onClick={() => {
                              const current = activeCase.departmentReplyText;
                              const next = current
                                ? `${current}\n\n[Z archiwum ${sim.caseNumber}]\n${sim.reusableExcerpt}`
                                : `[Z archiwum ${sim.caseNumber}]\n${sim.reusableExcerpt}`;
                              onUpdateCase(activeCase.id, {
                                departmentReplyText: next,
                              });
                              showToast(
                                `Skopiowano kontekst z archiwalnej sprawy ${sim.caseNumber}.`
                              );
                            }}
                            className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                          >
                            + Wykorzystaj fragment archiwalny w projekcie
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">
                    Brak identycznego pytania w archiwum. Po przygotowaniu
                    odpowiedzi zapisz ją w Bazie Wiedzy dla przyszłych spraw.
                  </p>
                )}
              </div>

              {/* Neural Redirect / Routing Paths */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-blue-700" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Wskazanie ścieżki i potencjalny redirect
                  </h3>
                </div>

                <div className="space-y-2">
                  {activeCase.analysis.routingPredictions.map((route) => {
                    const selected =
                      activeCase.recommendedDepartmentId === route.departmentId;
                    return (
                      <button
                        key={route.departmentId + route.actionType}
                        type="button"
                        onClick={() =>
                          onUpdateCase(activeCase.id, {
                            recommendedDepartmentId: route.departmentId,
                          })
                        }
                        className={`w-full text-left border rounded-md p-3 transition-colors cursor-pointer ${
                          selected
                            ? "border-blue-600 bg-blue-50/50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900">
                            {route.departmentName}
                          </span>
                          <span className="font-mono text-blue-700 font-semibold tabular-nums">
                            {route.confidencePercent}%
                          </span>
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                          {route.actionType === "external_redirect"
                            ? "Przekierowanie do zewnętrznego dysponenta (art. 4 ust. 3 UDIP)"
                            : route.actionType === "clarification"
                            ? "Wezwanie do doprecyzowania wniosku"
                            : route.actionType === "direct_answer"
                            ? "Odpowiedź bezpośrednia z BKS / archiwum"
                            : "Zapytanie wewnętrzne do wydziału UMB"}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {route.reason}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Department Inquiry Draft (NO Auto-Send per Challenge Rule #9) */}
                {activeCase.analysis.departmentInquiryDraft && (
                  <div className="border border-slate-200 rounded-md p-3 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        Propozycja prośby do wydziału (brak automatycznej wysyłki)
                      </span>
                      <button
                        type="button"
                        onClick={copyInquiryToClipboard}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                      >
                        {copiedInquiry ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Skopiowano
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Kopiuj treść
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                      {activeCase.analysis.departmentInquiryDraft}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateCase(activeCase.id, {
                          status: "zapytania_wyslane",
                        });
                        showToast(
                          "Zaktualizowano status sprawy: Zapytania wysłane do wydziałów."
                        );
                      }}
                      className="text-xs font-medium text-slate-700 hover:text-blue-700 underline cursor-pointer"
                    >
                      Oznacz w rejestrze jako „Zapytania wysłane do wydziałów”
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN: Department Reply -> Draft Generation -> Two-Stage Anonymization & Export */}
        <div className="xl:col-span-7 space-y-6">
          {/* 3. Department Reply & Response Generator */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                03. Materiały z wydziału i generowanie odpowiedzi
              </h2>

              <div>
                <input
                  ref={deptReplyFileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleUploadDeptReply}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isParsingFile}
                  onClick={() => deptReplyFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Wgraj odpowiedź z wydziału (PDF/Word)
                </button>
              </div>
            </div>

            <textarea
              rows={4}
              value={activeCase.departmentReplyText}
              onChange={(e) =>
                onUpdateCase(activeCase.id, {
                  departmentReplyText: e.target.value,
                })
              }
              placeholder="Wpisz lub wgraj informacje przekazane przez wydział merytoryczny (np. WAB, WZiGK, WEiS)..."
              className="w-full p-3 text-xs text-slate-800 border border-slate-200 rounded-md leading-relaxed focus:outline-none focus:border-blue-600"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Tryb generowanego pisma
                </label>
                <select
                  value={responseMode}
                  onChange={(e) =>
                    setResponseMode(e.target.value as ResponseMode)
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white text-slate-800 cursor-pointer"
                >
                  <option value="merit">
                    Odpowiedź merytoryczna (wzorzec BKS Ad 1, Ad 2...)
                  </option>
                  <option value="clarification">
                    Wezwanie do doprecyzowania wniosku (7 dni + art. 13 ust. 2)
                  </option>
                  <option value="redirect">
                    Wskazanie właściwego dysponenta (art. 4 ust. 3 UDIP)
                  </option>
                  <option value="extension">
                    Przedłużenie terminu / Kwerenda (art. 13 ust. 2 UDIP)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Dodatkowe wytyczne urzędnika (opcjonalnie)
                </label>
                <input
                  type="text"
                  value={officialNotes}
                  onChange={(e) => setOfficialNotes(e.target.value)}
                  placeholder="np. zaznacz dostęp do akt na miejscu od połowy września..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={isGeneratingDraft}
              onClick={handleGenerateDraft}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {isGeneratingDraft ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generowanie projektu pisma i wykrywanie danych wrażliwych...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Wygeneruj projekt pisma i przeskanuj pod kątem anonimizacji
                </>
              )}
            </button>
          </section>

          {/* 4. Draft Editor & Two-Stage Anonymization (Gray Suggestion -> Black Redaction) */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-700" />
                  <span>04. Weryfikacja merytoryczna i anonimizacja</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Propozycje AI podświetlone na szaro · Po akceptacji urzędnika
                  ukrywane na czarno
                </p>
              </div>

              <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setDraftEditorMode("anonymize")}
                  className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                    draftEditorMode === "anonymize"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  Anonimizacja (Szary → Czarny)
                </button>
                <button
                  type="button"
                  onClick={() => setDraftEditorMode("edit")}
                  className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                    draftEditorMode === "edit"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  Edycja tekstu pisma
                </button>
              </div>
            </div>

            {!activeCase.draftResponseText ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-lg">
                <p className="text-xs font-medium text-slate-700">
                  Projekt odpowiedzi nie został jeszcze wygenerowany
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Kliknij „Wygeneruj projekt pisma” powyżej albo wklej własny
                  tekst w trybie edycji, aby uruchomić anonimizację.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left 8 cols: Interactive Document Surface */}
                <div className="lg:col-span-8 space-y-3">
                  {draftEditorMode === "edit" ? (
                    <div className="space-y-2">
                      <textarea
                        rows={16}
                        value={activeCase.draftResponseText}
                        onChange={(e) =>
                          onUpdateCase(activeCase.id, {
                            draftResponseText: e.target.value,
                            piiItems: [],
                          })
                        }
                        className="w-full p-4 text-xs text-slate-900 border border-slate-200 rounded-md leading-relaxed font-sans focus:outline-none focus:border-blue-600"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          Po zmianie tekstu uruchom ponowne skanowanie danych
                          wrażliwych.
                        </span>
                        <button
                          type="button"
                          disabled={isScanningPii}
                          onClick={() =>
                            handleScanPii(activeCase.draftResponseText, false)
                          }
                          className="px-3 py-1.5 bg-blue-700 text-white text-xs font-medium rounded-md cursor-pointer"
                        >
                          Skanuj dane wrażliwe
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {/* Anonymization action bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-3 h-3 bg-slate-300 border border-slate-500 rounded-xs inline-block" />
                            Propozycja AI ({pendingSuggestionsCount})
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-3 h-3 bg-neutral-950 rounded-xs inline-block" />
                            Zatwierdzone ({acceptedRedactionsCount})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {selectedCustomRange && (
                            <button
                              type="button"
                              onClick={addManualRedaction}
                              className="px-2.5 py-1 bg-neutral-900 text-white text-[11px] font-medium rounded-md cursor-pointer"
                            >
                              Ukryj zaznaczenie: „
                              {selectedCustomRange.text.slice(0, 18)}
                              {selectedCustomRange.text.length > 18 ? "…" : ""}”
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isScanningPii}
                            onClick={() =>
                              handleScanPii(activeCase.draftResponseText, false)
                            }
                            className="px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium rounded-md cursor-pointer"
                          >
                            {isScanningPii ? "Skanuję..." : "Skanuj ponownie"}
                          </button>
                        </div>
                      </div>

                      {/* Visual Document Sheet */}
                      <div
                        ref={visualDraftRef}
                        onMouseUp={handleTextSelectionInVisual}
                        className="p-5 bg-white border border-slate-200 rounded-md text-[13px] text-slate-900 leading-relaxed whitespace-pre-wrap"
                      >
                        {renderedVisualSegments.map((seg) => {
                          if (seg.kind === "plain") {
                            return <span key={seg.key}>{seg.text}</span>;
                          }
                          const { span } = seg;
                          if (span.state === "accepted") {
                            return (
                              <button
                                key={seg.key}
                                type="button"
                                onClick={() => togglePiiState(span.id)}
                                title={`Zanonimizowano (${span.category}) — kliknij, aby odkryć lub zmienić`}
                                className="inline bg-neutral-950 text-neutral-950 px-1 rounded-xs cursor-pointer select-none mx-0.5 hover:ring-2 hover:ring-blue-600"
                              >
                                {span.text}
                              </button>
                            );
                          }
                          if (span.state === "suggested") {
                            return (
                              <button
                                key={seg.key}
                                type="button"
                                onClick={() => togglePiiState(span.id)}
                                title={`Propozycja anonimizacji: ${span.category} — kliknij, aby zatwierdzić na czarno`}
                                className="inline bg-slate-200 text-slate-900 border-b-2 border-slate-500 px-0.5 rounded-xs cursor-pointer hover:bg-slate-300"
                              >
                                {span.text}
                              </button>
                            );
                          }
                          return (
                            <button
                              key={seg.key}
                              type="button"
                              onClick={() => togglePiiState(span.id)}
                              title="Odrzucono anonimizację — kliknij, aby przywrócić"
                              className="inline underline decoration-dotted decoration-slate-400 cursor-pointer"
                            >
                              {span.text}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Wskazówka: kliknij szary fragment w piśmie, aby
                        zaakceptować ukrycie (czarny pasek), lub zaznacz myszą
                        dowolny tekst w piśmie, aby dodać ręczną anonimizację.
                      </p>
                    </div>
                  )}
                </div>

                {/* Right 4 cols: PII Detection Checklist */}
                <aside className="lg:col-span-4 border border-slate-200 rounded-md p-3.5 space-y-3 bg-slate-50/70">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-900">
                      Wykryte dane ({activeCase.piiItems.length})
                    </h3>
                    {activeCase.piiItems.length > 0 && (
                      <button
                        type="button"
                        onClick={resetAllPiiToSuggested}
                        title="Przywróć wszystkie do stanu propozycji"
                        className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </button>
                    )}
                  </div>

                  {activeCase.piiItems.length > 0 && (
                    <button
                      type="button"
                      onClick={acceptAllPii}
                      className="w-full py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-md cursor-pointer"
                    >
                      Zatwierdź wszystkie (na czarno)
                    </button>
                  )}

                  {activeCase.piiItems.length === 0 ? (
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Brak wykrytych danych wrażliwych. Możesz zaznaczyć tekst
                      ręcznie w podglądzie pisma lub uruchomić skanowanie.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {activeCase.piiItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white border border-slate-200 rounded-md p-2.5 text-xs space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-slate-900 break-all">
                              {item.state === "accepted"
                                ? "████████████"
                                : item.text}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePiiState(item.id)}
                              className="text-slate-500 hover:text-slate-900 shrink-0 cursor-pointer"
                              title="Przełącz stan ukrycia"
                            >
                              {item.state === "accepted" ? (
                                <EyeOff className="w-3.5 h-3.5 text-neutral-900" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 text-slate-600" />
                              )}
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.category}
                          </div>
                          <div className="flex items-center justify-between pt-0.5 text-[11px]">
                            <span
                              className={
                                item.state === "accepted"
                                  ? "font-semibold text-neutral-900"
                                  : item.state === "suggested"
                                  ? "font-medium text-amber-700"
                                  : "text-slate-400"
                              }
                            >
                              {item.state === "accepted"
                                ? "Ukryte (czarne)"
                                : item.state === "suggested"
                                ? "Sugestia (szare)"
                                : "Zachowane w piśmie"}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePiiState(item.id)}
                              className="text-blue-700 hover:underline font-medium cursor-pointer"
                            >
                              {item.state === "accepted"
                                ? "Odkryj"
                                : item.state === "suggested"
                                ? "Ukryj"
                                : "Przywróć"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </aside>
              </div>
            )}

            {/* Final Export, Status Update, and Knowledge Base Persistence */}
            {activeCase.draftResponseText && (
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExport("doc")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-lg cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Pobierz .DOC (Word)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("txt")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Pobierz .TXT
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={activeCase.savedToKnowledgeBase}
                    onClick={handleSaveCaseToKb}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border cursor-pointer ${
                      activeCase.savedToKnowledgeBase
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <BookMarked className="w-3.5 h-3.5" />
                    {activeCase.savedToKnowledgeBase
                      ? "Zapisano w Bazie Wiedzy"
                      : "Zapisz w Bazie Wiedzy"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateCase(activeCase.id, {
                        status: "wyslana",
                        responseDate: referenceDate,
                      });
                      showToast(
                        `Sprawa ${activeCase.caseNumber} oznaczona jako „Odpowiedź wysłana”.`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-lg cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Oznacz jako wysłane
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
