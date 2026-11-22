import { Component, signal } from '@angular/core';
import { CalendarComponent } from './features/calendar/calendar.component';
import { KnowledgeBaseComponent } from './features/knowledge-base/knowledge-base.component';
import { CaseWorkflowComponent } from './features/case-workflow/case-workflow.component';
import {
  Department,
  InitialDataPayload,
  KnowledgeBaseEntry,
  SampleDocument,
  WniosekCase,
} from './core/models/workspace';
import { WorkspaceService } from './core/services/workspace.service';

type AppView = 'cases' | 'calendar' | 'workflow' | 'knowledge';

@Component({
  selector: 'app-root',
  imports: [CalendarComponent, KnowledgeBaseComponent, CaseWorkflowComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly activeView = signal<AppView>('cases');
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal('');
  protected readonly cases = signal<WniosekCase[]>([]);
  protected readonly departments = signal<Department[]>([]);
  protected readonly knowledgeBase = signal<KnowledgeBaseEntry[]>([]);
  protected readonly anonymizationRules = signal<string[]>([]);
  protected readonly sampleDocuments = signal<SampleDocument[]>([]);
  protected readonly activeCaseId = signal<string | null>(null);
  protected readonly referenceDate = signal(new Date().toISOString().slice(0, 10));

  constructor(private readonly workspace: WorkspaceService) {
    void this.loadInitialData();
  }

  protected async loadInitialData(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set('');
    try {
      const data: InitialDataPayload = await this.workspace.loadInitialData();
      this.cases.set(data.cases);
      this.departments.set(data.departments);
      this.knowledgeBase.set(data.knowledgeBase);
      this.anonymizationRules.set(data.anonymizationRules);
      this.sampleDocuments.set(data.sampleDocuments);
      this.activeCaseId.set(data.cases[0]?.id ?? null);
    } catch (error) {
      this.loadError.set(
        error instanceof Error
          ? error.message
          : 'Nie udało się wczytać danych aplikacji.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  protected navigate(view: AppView): void {
    this.activeView.set(view);
  }

  protected updateCase(event: { id: string; patch: Partial<WniosekCase> }): void {
    this.cases.update((items) =>
      items.map((item) =>
        item.id === event.id ? { ...item, ...event.patch } : item,
      ),
    );
  }

  protected createCase(content = '', subject = 'Nowy wniosek UDIP'): void {
    const items = this.cases();
    const lp = items.reduce((largest, item) => Math.max(largest, item.lp), 0) + 1;
    const referenceDate = this.referenceDate();
    const next = new Date(`${referenceDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 14);
    const dueDate = next.toISOString().slice(0, 10);
    const item: WniosekCase = {
      id: `case-${Date.now()}`,
      lp,
      caseNumber: `BKS.IV.1431.${600 + lp}.2026`,
      applicant: 'Nowy wnioskodawca',
      subject,
      fullRequestText: content,
      receivedDate: referenceDate,
      dueDate,
      responseDate: null,
      assignee: 'Pracownik 1',
      status: 'brak_dzialan',
      kwerendaDays: 0,
      tags: ['UDIP'],
      summary: '',
      recommendedDepartmentId: 'bks',
      departmentReplyText: '',
      draftResponseText: '',
      savedToKnowledgeBase: false,
      analysis: null,
    };
    this.cases.update((current) => [...current, item]);
    this.activeCaseId.set(item.id);
    this.activeView.set('workflow');
  }

  protected addKnowledgeBaseEntry(entry: KnowledgeBaseEntry): void {
    this.knowledgeBase.update((current) => [entry, ...current]);
  }
}
