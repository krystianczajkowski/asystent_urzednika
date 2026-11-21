import React from "react";
import { Cpu, Database, Lock, Network, ShieldCheck } from "lucide-react";

export const LocalArchitectureView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-slate-500">
          Koncepcja wdrożenia produkcyjnego w sieci zamkniętej UMB
        </p>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
          Architektura lokalna i bezpieczeństwo danych
        </h1>
      </div>

      {/* Main Split: Architecture Spec + Handwritten Workflow Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
            <div className="flex items-center gap-2 text-blue-700">
              <Lock className="w-4 h-4" />
              <h2 className="text-base font-semibold text-slate-900">
                1. Model zamknięty bez dostępu do Internetu (On-Premise)
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              W środowisku konkursowym Hacknation analiza i redakcja pism
              korzysta z bezpiecznego proxy serwerowego Gemini. Docelowo
              w Urzędzie Miasta Bydgoszczy aplikacja działa w 100% wewnątrz
              intranetu miejskiego (air-gapped / bez wyjścia do sieci publicznej),
              chroniąc dane osobowe mieszkańców i tajemnice przedsiębiorstw.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="border border-slate-200 rounded-md p-3">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-700" />
                  Lokalny model językowy (LLM)
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  <strong>Bielik-11B-v2.3-Instruct</strong> (polski model
                  otwarty) lub <strong>Qwen2.5-14B</strong> uruchomiony przez{" "}
                  <span className="font-mono">vLLM / Ollama</span> na lokalnym
                  serwerze GPU (1× RTX 4090 / A100 40GB).
                </p>
              </div>
              <div className="border border-slate-200 rounded-md p-3">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-700" />
                  Baza wektorowa i archiwum
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Embeddingi <strong>BGE-M3</strong> (wielojęzyczny) +{" "}
                  <span className="font-mono">Qdrant / pgvector</span> do
                  semantycznego dopasowania tysięcy archiwalnych wniosków
                  i aktualnych ustaw (UDIP, KPA).
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
            <div className="flex items-center gap-2 text-blue-700">
              <ShieldCheck className="w-4 h-4" />
              <h2 className="text-base font-semibold text-slate-900">
                2. Hybrydowa anonimizacja i brak halucynacji
              </h2>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li>
                <strong>Warstwa deterministyczna (Regex + słowniki):</strong>{" "}
                natychmiastowe wychwycenie PESEL, numerów dowodów, IBAN,
                ksiąg wieczystych, e-maili i telefonów bez udziału sieci
                neuronowej.
              </li>
              <li>
                <strong>Warstwa semantyczna (NER / LLM):</strong> wykrywa
                kontekstowe dane wrażliwe (dane o zdrowiu, stanie rodzinnym,
                tajemnicy przedsiębiorstwa), z wyjątkiem danych funkcjonariuszy
                publicznych.
              </li>
              <li>
                <strong>Dwustopniowa akceptacja urzędnika:</strong> propozycje
                na szaro, zatwierdzenie na czarno. Brak automatycznej wysyłki
                — ostateczną decyzję zawsze podejmuje urzędnik.
              </li>
            </ul>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-2">
            <div className="flex items-center gap-2 text-blue-700">
              <Network className="w-4 h-4" />
              <h2 className="text-base font-semibold text-slate-900">
                3. Brak ingerencji w systemy urzędowe (np. SIDAS)
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Narzędzie działa jako niezależny, lekki asystent stanowiskowy
              (Docker Compose / plik wykonywalny) bez potrzeby integracji z
              SIDAS. Urzędnik wgrywa plik PDF/Word, otrzymuje ścieżkę
              wydziałową, projekt odpowiedzi i zanonimizowany dokument .DOC/.TXT.
            </p>
          </section>
        </div>

        {/* Right: Original Workflow Sketch Reference */}
        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            Schemat koncepcyjny workflow dokumentów
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Odwzorowanie pełnego obiegu z projektu: Żądający → Wniosek →
            Analiza, Tagowanie, Podsumowanie, Potencjalny Redirect, Generowanie
            odpowiedzi, Wykrywanie danych wrażliwych, Statusowanie oraz Baza
            Wiedzy (uczenie na nowych sprawach).
          </p>
          <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-100">
            <img
              src="/assets/aistudio/2026-11-21_15.37.12_aed53f16.jpg"
              alt="Szkic koncepcyjny workflow dokumentów UDIP"
              referrerPolicy="no-referrer"
              className="w-full h-auto object-cover"
            />
          </div>
        </aside>
      </div>
    </div>
  );
};
