import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface SimilarCaseMatch {
  kbId: string;
  caseNumber: string;
  title: string;
  similarityPercent: number;
  reason: string;
  reusableExcerpt: string;
}

export interface RoutingPrediction {
  departmentId: string;
  departmentName: string;
  isExternal: boolean;
  confidencePercent: number;
  actionType:
    | 'internal_inquiry'
    | 'external_redirect'
    | 'clarification'
    | 'direct_answer';
  reason: string;
}

export interface NeuralAnalysis {
  summary: string;
  tags: string[];
  extractedMetadata: {
    applicantName: string;
    subject: string;
    detectedDate: string;
    urgencyHint: string;
  };
  knowledgeBaseMatchFound: boolean;
  similarCases: SimilarCaseMatch[];
  routingPredictions: RoutingPrediction[];
  departmentInquiryDraft: string;
  legalBasis: string[];
}

export interface DocumentAnalysis {
  fileName: string;
  summary: string;
  extractedText: string;
  applicant: string;
  subject: string;
  requestedInformation: string[];
  deadlines: string[];
  recommendedDepartment: string;
  confidence: number;
  model: 'bielik';
}

interface BielikResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

@Injectable()
export class BielikAiService {
  async analyzeRequest(input: {
    text: string;
    knowledgeBase?: Array<{
      id: string;
      caseNumber: string;
      title: string;
      department: string;
      questionSummary: string;
      answerText: string;
    }>;
    departments?: Array<{
      id: string;
      name: string;
      isExternal: boolean;
      scope: string;
    }>;
  }): Promise<{ analysis: NeuralAnalysis }> {
    if (typeof input.text !== 'string' || input.text.trim().length < 10) {
      throw new BadRequestException(
        'Treść wniosku jest zbyt krótka do przeprowadzenia analizy.',
      );
    }

    const archive = (input.knowledgeBase ?? [])
      .map(
        (entry) =>
          `[${entry.id} | ${entry.caseNumber} | ${entry.department}] ${entry.title}\nPytanie: ${entry.questionSummary}\nOdpowiedź: ${entry.answerText.slice(0, 700)}`,
      )
      .join('\n---\n');
    const departmentList = (input.departments ?? [])
      .map(
        (department) =>
          `- ${department.id}: ${department.name} (${department.isExternal ? 'zewnętrzny dysponent' : 'UMB'}); zakres: ${department.scope}`,
      )
      .join('\n');

    const content = await this.complete(
      'Jesteś asystentem administracyjnym Urzędu Miasta Bydgoszczy. Analizuj wnioski UDIP, nie wymyślaj faktów, a odpowiedź zwracaj jako poprawny JSON.',
      `Przeanalizuj wniosek UDIP. Zwróć JSON z polami summary, tags[], extractedMetadata { applicantName, subject, detectedDate, urgencyHint }, knowledgeBaseMatchFound, similarCases[] { kbId, caseNumber, title, similarityPercent, reason, reusableExcerpt }, routingPredictions[] { departmentId, departmentName, isExternal, confidencePercent, actionType, reason }, departmentInquiryDraft, legalBasis[]. actionType może być internal_inquiry, external_redirect, clarification albo direct_answer.

ARCHIWUM:
${archive || 'Brak wpisów archiwalnych.'}

WYDZIAŁY:
${departmentList || 'Brak listy wydziałów.'}

WNIOSEK:
${input.text.slice(0, 14000)}`,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ServiceUnavailableException(
        'Model Bielik zwrócił nieprawidłowy format analizy JSON.',
      );
    }
    return { analysis: this.normalizeAnalysis(parsed) };
  }

  async generateResponse(input: {
    caseNumber: string;
    applicant: string;
    requestText: string;
    departmentReplyText: string;
    responseMode: 'merit' | 'clarification' | 'redirect' | 'extension';
    similarContext?: string;
    officialNotes?: string;
  }): Promise<{ draftText: string }> {
    const modes: Record<typeof input.responseMode, string> = {
      merit:
        'Przygotuj odpowiedź merytoryczną. Jeśli wniosek zawiera kilka pytań, użyj numeracji Ad 1, Ad 2. Opieraj się wyłącznie na przekazanych materiałach; braki oznacz jako [DO UZUPEŁNIENIA PRZEZ URZĘDNIKA].',
      clarification:
        'Przygotuj wezwanie do doprecyzowania zakresu wniosku, z terminem 7 dni i podstawą z art. 13 ust. 2 UDIP.',
      redirect:
        'Przygotuj pismo wskazujące, że urząd nie jest dysponentem informacji na podstawie art. 4 ust. 3 UDIP; właściwy podmiot wskaż tylko, jeśli wynika z materiałów.',
      extension:
        'Przygotuj zawiadomienie o przedłużeniu terminu na podstawie art. 13 ust. 2 UDIP. Nie przekraczaj ustawowego terminu 2 miesięcy.',
    };
    const draftText = await this.complete(
      'Tworzysz projekt pisma urzędowego w języku polskim. Nie wysyłasz pisma i nie dopisujesz niepotwierdzonych faktów.',
      `Przygotuj projekt pisma Biura Komunikacji Społecznej Urzędu Miasta Bydgoszczy.

Znak sprawy: ${input.caseNumber || 'BKS.IV.1431.NOWY.2026'}
Adresat: ${input.applicant || 'Szanowni Państwo'}
Tryb: ${modes[input.responseMode]}

WNIOSEK:
${input.requestText || '[brak treści wniosku]'}

MATERIAŁY Z WYDZIAŁU:
${input.departmentReplyText || '[brak materiałów — nie wymyślaj danych liczbowych]'}

KONTEKST ARCHIWALNY:
${input.similarContext || '[brak]'}

UWAGI URZĘDNIKA:
${input.officialNotes || '[brak]'}

Zastosuj oficjalny ton, nagłówek ze znakiem sprawy, zwrot grzecznościowy i zakończenie:
Łączę wyrazy szacunku,
Biuro Komunikacji Społecznej
Urząd Miasta Bydgoszczy

Zwróć wyłącznie treść projektu, bez markdown.`,
    );
    if (!draftText.trim()) {
      throw new ServiceUnavailableException(
        'Model Bielik zwrócił pusty projekt pisma.',
      );
    }
    return { draftText: draftText.trim() };
  }

  async analyze(fileName: string, text: string): Promise<DocumentAnalysis> {
    const content = await this.complete(
      'Jesteś Bielikiem. Analizuj polskie dokumenty administracyjne, nie dopisuj faktów i zwracaj poprawny JSON.',
      `Przeanalizuj dokument i zwróć JSON z polami: summary, applicant, subject, requestedInformation[], deadlines[], recommendedDepartment, confidence. Dokument:\n${text.slice(0, 12000)}`,
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ServiceUnavailableException(
        'Model Bielik zwrócił nieprawidłowy format analizy JSON.',
      );
    }
    const data = this.requireRecord(parsed, 'analiza dokumentu');
    return {
      fileName,
      summary: this.requireString(data['summary'], 'summary'),
      extractedText: text,
      applicant: this.requireString(data['applicant'], 'applicant'),
      subject: this.requireString(data['subject'], 'subject'),
      requestedInformation: this.requireStringArray(
        data['requestedInformation'],
        'requestedInformation',
      ),
      deadlines: this.requireStringArray(data['deadlines'], 'deadlines'),
      recommendedDepartment: this.requireString(
        data['recommendedDepartment'],
        'recommendedDepartment',
      ),
      confidence: this.requireConfidence(data['confidence']),
      model: 'bielik',
    };
  }

  private async complete(system: string, prompt: string): Promise<string> {
    const apiUrl = process.env.BIELIK_API_URL;
    if (!apiUrl) {
      throw new ServiceUnavailableException(
        'Brak konfiguracji Bielika. Ustaw BIELIK_API_URL, BIELIK_API_KEY i BIELIK_MODEL w backend/.env.',
      );
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (process.env.BIELIK_API_KEY) {
        headers['Authorization'] = `Bearer ${process.env.BIELIK_API_KEY}`;
      }
      const response = await fetch(
        `${apiUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: process.env.BIELIK_MODEL ?? 'bielik',
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Bielik HTTP ${response.status}`);
      }
      const payload = (await response.json()) as BielikResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('Bielik nie zwrócił treści.');
      }
      return content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error
          ? `Połączenie z Bielikiem nie powiodło się: ${error.message}`
          : 'Połączenie z Bielikiem nie powiodło się.',
      );
    }
  }

  private normalizeAnalysis(value: unknown): NeuralAnalysis {
    if (typeof value !== 'object' || value === null) {
      throw new ServiceUnavailableException(
        'Model Bielik zwrócił nieprawidłową strukturę analizy.',
      );
    }
    const data = this.requireRecord(value, 'analiza wniosku');
    const metadata = this.requireRecord(
      data['extractedMetadata'],
      'extractedMetadata',
    );
    const similarCases = this.requireArray(
      data['similarCases'],
      'similarCases',
    ).map((value, index) => {
      const item = this.requireRecord(value, `similarCases[${index}]`);
      return {
        kbId: this.requireString(item['kbId'], `similarCases[${index}].kbId`),
        caseNumber: this.requireString(
          item['caseNumber'],
          `similarCases[${index}].caseNumber`,
        ),
        title: this.requireString(
          item['title'],
          `similarCases[${index}].title`,
        ),
        similarityPercent: this.requirePercent(
          item['similarityPercent'],
          `similarCases[${index}].similarityPercent`,
        ),
        reason: this.requireString(
          item['reason'],
          `similarCases[${index}].reason`,
        ),
        reusableExcerpt: this.requireString(
          item['reusableExcerpt'],
          `similarCases[${index}].reusableExcerpt`,
        ),
      };
    });
    const routingPredictions = this.requireArray(
      data['routingPredictions'],
      'routingPredictions',
    ).map((value, index) => {
      const item = this.requireRecord(value, `routingPredictions[${index}]`);
      if (typeof item['isExternal'] !== 'boolean') {
        throw this.invalidModelField(`routingPredictions[${index}].isExternal`);
      }
      return {
        departmentId: this.requireString(
          item['departmentId'],
          `routingPredictions[${index}].departmentId`,
        ),
        departmentName: this.requireString(
          item['departmentName'],
          `routingPredictions[${index}].departmentName`,
        ),
        isExternal: item['isExternal'],
        confidencePercent: this.requirePercent(
          item['confidencePercent'],
          `routingPredictions[${index}].confidencePercent`,
        ),
        actionType: this.toActionType(item['actionType']),
        reason: this.requireString(
          item['reason'],
          `routingPredictions[${index}].reason`,
        ),
      };
    });
    if (typeof data['knowledgeBaseMatchFound'] !== 'boolean') {
      throw this.invalidModelField('knowledgeBaseMatchFound');
    }

    return {
      summary: this.requireString(data['summary'], 'summary'),
      tags: this.requireStringArray(data['tags'], 'tags'),
      extractedMetadata: {
        applicantName: this.requireString(
          metadata['applicantName'],
          'extractedMetadata.applicantName',
        ),
        subject: this.requireString(
          metadata['subject'],
          'extractedMetadata.subject',
        ),
        detectedDate: this.requireString(
          metadata['detectedDate'],
          'extractedMetadata.detectedDate',
        ),
        urgencyHint: this.requireString(
          metadata['urgencyHint'],
          'extractedMetadata.urgencyHint',
        ),
      },
      knowledgeBaseMatchFound: data['knowledgeBaseMatchFound'],
      similarCases,
      routingPredictions,
      departmentInquiryDraft: this.requireString(
        data['departmentInquiryDraft'],
        'departmentInquiryDraft',
      ),
      legalBasis: this.requireStringArray(data['legalBasis'], 'legalBasis'),
    };
  }

  private requireRecord(
    value: unknown,
    field: string,
  ): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw this.invalidModelField(field);
    }
    return value as Record<string, unknown>;
  }

  private requireArray(value: unknown, field: string): unknown[] {
    if (!Array.isArray(value)) throw this.invalidModelField(field);
    return value;
  }

  private requireString(value: unknown, field: string): string {
    if (typeof value !== 'string') throw this.invalidModelField(field);
    return value;
  }

  private requireStringArray(value: unknown, field: string): string[] {
    const entries = this.requireArray(value, field);
    return entries.map((entry, index) =>
      this.requireString(entry, `${field}[${index}]`),
    );
  }

  private requireConfidence(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw this.invalidModelField('confidence');
    }
    return Math.max(0, Math.min(1, value));
  }

  private requirePercent(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw this.invalidModelField(field);
    }
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  private toActionType(value: unknown): RoutingPrediction['actionType'] {
    if (
      value === 'internal_inquiry' ||
      value === 'external_redirect' ||
      value === 'clarification' ||
      value === 'direct_answer'
    ) {
      return value;
    }
    throw this.invalidModelField('routingPredictions.actionType');
  }

  private invalidModelField(field: string): ServiceUnavailableException {
    return new ServiceUnavailableException(
      `Model Bielik zwrócił nieprawidłowe pole: ${field}.`,
    );
  }
}
