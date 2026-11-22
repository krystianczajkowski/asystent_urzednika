import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocumentAnalysis } from '../../core/models/document-analysis';
import {
  Department,
  KnowledgeBaseEntry,
  NeuralAnalysis,
  ResponseMode,
  SampleDocument,
  WniosekCase,
  WorkflowStatus,
} from '../../core/models/workspace';
import { DocumentsService } from '../../core/services/documents.service';
import { WorkspaceService } from '../../core/services/workspace.service';

@Component({
  selector: 'app-case-workflow',
  imports: [FormsModule],
  templateUrl: './case-workflow.component.html',
  styleUrl: './case-workflow.component.scss',
})
export class CaseWorkflowComponent {
  readonly cases = input.required<WniosekCase[]>();
  readonly activeCaseId = input<string | null>(null);
  readonly departments = input.required<Department[]>();
  readonly knowledgeBase = input.required<KnowledgeBaseEntry[]>();
  readonly sampleDocuments = input.required<SampleDocument[]>();
  readonly referenceDate = input.required<string>();
  readonly activeCaseIdChange = output<string>();
  readonly updateCase = output<{ id: string; patch: Partial<WniosekCase> }>();
  readonly createCase = output<{ content: string; subject: string }>();
  readonly saveKnowledgeBase = output<KnowledgeBaseEntry>();
  readonly backToCalendar = output<void>();

  protected readonly isAnalyzing = signal(false);
  protected readonly isGenerating = signal(false);
  protected readonly isReadingFile = signal(false);
  protected readonly activeStep = signal<WorkflowStep>('request');
  protected readonly documentResult = signal<{
    caseId: string;
    analysis: DocumentAnalysis;
  } | null>(null);
  protected readonly dragActive = signal(false);
  protected readonly responseMode = signal<ResponseMode>('merit');
  protected readonly officialNotes = signal('');
  protected readonly errorMessage = signal('');
  protected readonly notice = signal('');
  protected readonly activeCase = computed(
    () => this.cases().find((item) => item.id === this.activeCaseId()) ?? null,
  );

  constructor(
    private readonly documents: DocumentsService,
    private readonly workspace: WorkspaceService,
  ) {}

  protected update(patch: Partial<WniosekCase>): void {
    const item = this.activeCase();
    if (item) this.updateCase.emit({ id: item.id, patch });
  }

  protected selectStep(step: WorkflowStep): void {
    if (step !== 'request' && !this.activeCase()?.analysis) return;
    this.activeStep.set(step);
  }

  protected setStatus(value: string): void {
    const statuses: WorkflowStatus[] = [
      'brak_dzialan',
      'zapytania_wyslane',
      'kwerenda',
      'doprecyzowanie',
      'przygotowana',
      'wyslana',
    ];
    if (!statuses.includes(value as WorkflowStatus)) return;
    this.update({
      status: value as WorkflowStatus,
      responseDate: value === 'wyslana' ? this.referenceDate() : null,
    });
  }

  protected setMode(value: string): void {
    const modes: ResponseMode[] = ['merit', 'clarification', 'redirect', 'extension'];
    if (modes.includes(value as ResponseMode)) this.responseMode.set(value as ResponseMode);
  }

  protected async uploadRequest(event: Event): Promise<void> {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0];
    if (file) await this.readDocument(file);
    element.value = '';
  }

  protected async dropFile(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragActive.set(false);
    if (this.isReadingFile()) return;
    const file = event.dataTransfer?.files[0];
    if (file) await this.readDocument(file);
  }

  protected async readDocument(file: File): Promise<void> {
    if (this.isReadingFile()) return;
    this.errorMessage.set('');
    this.documentResult.set(null);
    if (!this.documents.isSupported(file)) {
      this.errorMessage.set('Wybierz plik PDF, DOCX lub TXT o rozmiarze do 10 MB.');
      return;
    }
    const caseId = this.activeCase()?.id;
    if (!caseId) {
      this.errorMessage.set('Najpierw wybierz lub utwórz sprawę.');
      return;
    }
    this.isReadingFile.set(true);
    try {
      const result = await this.documents.analyze(file);
      this.documentResult.set({ caseId, analysis: result });
      this.update({
        fullRequestText: result.extractedText,
        subject: result.subject,
        applicant: result.applicant,
        summary: result.summary,
      });
      this.notice.set(`Wczytano dokument ${file.name}. Sprawdź treść przed analizą.`);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Nie udało się odczytać dokumentu.');
    } finally {
      this.isReadingFile.set(false);
    }
  }

  protected loadSample(sample: SampleDocument): void {
    this.activeStep.set('request');
    this.createCase.emit({ content: sample.content, subject: sample.label });
    this.notice.set(`Utworzono sprawę z materiału „${sample.fileName}”.`);
  }

  protected async analyze(): Promise<void> {
    const item = this.activeCase();
    if (!item?.fullRequestText.trim()) {
      this.errorMessage.set('Wpisz lub wgraj treść wniosku przed analizą.');
      return;
    }
    this.errorMessage.set('');
    this.notice.set('');
    this.isAnalyzing.set(true);
    try {
      const analysis = await this.workspace.analyzeRequest({
        text: item.fullRequestText,
        knowledgeBase: this.knowledgeBase(),
        departments: this.departments(),
      });
      this.applyAnalysis(item, analysis);
      this.activeStep.set('analysis');
      const firstRoute = analysis.routingPredictions[0];
      if (firstRoute?.actionType === 'external_redirect') this.responseMode.set('redirect');
      else if (firstRoute?.actionType === 'clarification') this.responseMode.set('clarification');
      else this.responseMode.set('merit');
      this.notice.set('Analiza Bielika zakończona. Zweryfikuj archiwalne dopasowania i rekomendowaną ścieżkę.');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Nie udało się przeanalizować wniosku.');
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  protected async generateDraft(): Promise<void> {
    const item = this.activeCase();
    if (!item) return;
    this.errorMessage.set('');
    this.notice.set('');
    this.isGenerating.set(true);
    try {
      const similarContext = item.analysis?.similarCases
        .map((match) => `[${match.caseNumber}] ${match.title}: ${match.reusableExcerpt}`)
        .join('\n') ?? '';
      const draftText = await this.workspace.generateResponse({
        caseNumber: item.caseNumber,
        applicant: item.applicant,
        requestText: item.fullRequestText,
        departmentReplyText: item.departmentReplyText,
        responseMode: this.responseMode(),
        similarContext,
        officialNotes: this.officialNotes(),
      });
      this.update({ draftResponseText: draftText, status: 'przygotowana' });
      this.notice.set('Utworzono projekt odpowiedzi. Przed wysłaniem zweryfikuj jego treść.');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Nie udało się wygenerować projektu odpowiedzi.');
    } finally {
      this.isGenerating.set(false);
    }
  }

  protected addArchive(entry: SimilarCaseEntry): void {
    const item = this.activeCase();
    if (!item) return;
    const excerpt = `[Z archiwum ${entry.caseNumber}]\n${entry.reusableExcerpt}`;
    this.update({
      departmentReplyText: item.departmentReplyText
        ? `${item.departmentReplyText}\n\n${excerpt}`
        : excerpt,
    });
    this.notice.set(`Dodano kontekst archiwalny: ${entry.caseNumber}.`);
  }

  protected saveToArchive(): void {
    const item = this.activeCase();
    if (!item) return;
    const answerText = item.draftResponseText || item.departmentReplyText;
    if (!answerText.trim()) {
      this.errorMessage.set('Brak treści odpowiedzi do zapisania w archiwum.');
      return;
    }
    const department = this.departments().find((entry) => entry.id === item.recommendedDepartmentId);
    this.saveKnowledgeBase.emit({
      id: `kb-${Date.now()}`,
      type: 'archival_qa',
      caseNumber: item.caseNumber,
      title: item.subject,
      department: department ? `${department.name} (${department.code})` : 'BKS',
      date: this.referenceDate(),
      tags: item.tags,
      questionSummary: item.summary || item.subject,
      answerText,
    });
    this.update({ savedToKnowledgeBase: true });
    this.notice.set('Zapisano odpowiedź w Bazie Wiedzy.');
  }

  protected async copyDraft(): Promise<void> {
    const text = this.activeCase()?.draftResponseText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.notice.set('Skopiowano projekt odpowiedzi.');
    } catch {
      this.errorMessage.set('Nie udało się skopiować tekstu. Zaznacz go i skopiuj ręcznie.');
    }
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  }

  protected selectCase(value: string): void {
    this.activeCaseIdChange.emit(value);
    this.activeStep.set(
      this.cases().find((item) => item.id === value)?.analysis
        ? 'analysis'
        : 'request',
    );
  }

  protected createBlankCase(): void {
    this.activeStep.set('request');
    this.createCase.emit({ content: '', subject: 'Nowy wniosek UDIP' });
  }

  protected departmentName(id: string): string {
    return this.departments().find((department) => department.id === id)?.name ?? 'Nie wskazano';
  }

  private applyAnalysis(item: WniosekCase, analysis: NeuralAnalysis): void {
    const firstRoute = analysis.routingPredictions[0];
    this.updateCase.emit({
      id: item.id,
      patch: {
        analysis,
        summary: analysis.summary || item.summary,
        tags: analysis.tags.length ? analysis.tags : item.tags,
        applicant: analysis.extractedMetadata.applicantName || item.applicant,
        subject: analysis.extractedMetadata.subject || item.subject,
        recommendedDepartmentId: firstRoute?.departmentId ?? item.recommendedDepartmentId,
      },
    });
  }
}

interface SimilarCaseEntry {
  caseNumber: string;
  reusableExcerpt: string;
}

type WorkflowStep = 'request' | 'analysis' | 'response';
