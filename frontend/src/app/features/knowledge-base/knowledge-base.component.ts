import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Department,
  KnowledgeBaseEntry,
} from '../../core/models/workspace';
import { DocumentsService } from '../../core/services/documents.service';

type KnowledgeTab = 'archive' | 'departments' | 'privacy';
type KnowledgeType = KnowledgeBaseEntry['type'];

@Component({
  selector: 'app-knowledge-base',
  imports: [FormsModule],
  templateUrl: './knowledge-base.component.html',
  styleUrl: './knowledge-base.component.scss',
})
export class KnowledgeBaseComponent {
  readonly entries = input.required<KnowledgeBaseEntry[]>();
  readonly departments = input.required<Department[]>();
  readonly anonymizationRules = input.required<string[]>();
  readonly addEntry = output<KnowledgeBaseEntry>();

  protected readonly activeTab = signal<KnowledgeTab>('archive');
  protected readonly isAdding = signal(false);
  protected readonly search = signal('');
  protected readonly typeFilter = signal<'all' | KnowledgeType>('all');
  protected readonly title = signal('');
  protected readonly caseNumber = signal('');
  protected readonly department = signal('Biuro Komunikacji Społecznej');
  protected readonly entryType = signal<KnowledgeType>('archival_qa');
  protected readonly answerText = signal('');
  protected readonly uploadStatus = signal('');
  protected readonly isReadingFile = signal(false);
  protected readonly errorMessage = signal('');

  constructor(private readonly documents: DocumentsService) {}

  protected openTab(tab: KnowledgeTab): void {
    this.activeTab.set(tab);
    this.isAdding.set(false);
    this.errorMessage.set('');
  }

  protected startAdding(): void {
    this.isAdding.set(true);
    this.errorMessage.set('');
    this.uploadStatus.set('');
  }

  protected filteredEntries(): KnowledgeBaseEntry[] {
    const query = this.search().trim().toLocaleLowerCase('pl-PL');
    return this.entries().filter((entry) => {
      if (this.typeFilter() !== 'all' && entry.type !== this.typeFilter()) return false;
      if (!query) return true;
      return [
        entry.title,
        entry.caseNumber,
        entry.questionSummary,
        entry.answerText,
        ...entry.tags,
      ].some((value) => value.toLocaleLowerCase('pl-PL').includes(query));
    });
  }

  protected async readFile(event: Event): Promise<void> {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0];
    if (!file) return;
    this.errorMessage.set('');
    this.uploadStatus.set('');
    if (!this.documents.isSupported(file)) {
      this.errorMessage.set('Wybierz plik PDF, DOCX lub TXT o rozmiarze do 10 MB.');
      inputElement.value = '';
      return;
    }
    this.isReadingFile.set(true);
    try {
      const analysis = await this.documents.analyze(file);
      this.answerText.set(analysis.extractedText);
      if (!this.title().trim()) this.title.set(file.name.replace(/\.[^.]+$/, ''));
      this.uploadStatus.set(`Wczytano treść pliku ${file.name}. Sprawdź ją przed zapisaniem.`);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Nie udało się odczytać dokumentu.');
    } finally {
      this.isReadingFile.set(false);
      inputElement.value = '';
    }
  }

  protected saveEntry(event: Event): void {
    event.preventDefault();
    const title = this.title().trim();
    const answerText = this.answerText().trim();
    if (!title || !answerText) {
      this.errorMessage.set('Podaj tytuł i treść materiału przed zapisaniem.');
      return;
    }
    const entry: KnowledgeBaseEntry = {
      id: `kb-${Date.now()}`,
      type: this.entryType(),
      caseNumber: this.caseNumber().trim() || `AKT-${new Date().getFullYear()}`,
      title,
      department: this.department().trim(),
      date: new Date().toISOString().slice(0, 10),
      tags: [
        this.entryType() === 'legal_act'
          ? 'ustawa'
          : this.entryType() === 'ordinance'
            ? 'zarządzenie'
            : 'archiwum',
        'Baza wiedzy',
      ],
      questionSummary: title,
      answerText,
    };
    this.addEntry.emit(entry);
    this.title.set('');
    this.caseNumber.set('');
    this.answerText.set('');
    this.errorMessage.set('');
    this.uploadStatus.set('Dodano materiał do Bazy Wiedzy. Można go wykorzystać w kolejnych analizach.');
    this.isAdding.set(false);
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  }
}
