import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WorkflowStatus, WniosekCase } from '../../core/models/workspace';

interface CalendarCell {
  date: string | null;
  day: number | null;
}

@Component({
  selector: 'app-calendar',
  imports: [FormsModule],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
})
export class CalendarComponent {
  readonly mode = input<'cases' | 'calendar'>('cases');
  readonly cases = input.required<WniosekCase[]>();
  readonly referenceDate = input.required<string>();
  readonly openCase = output<string>();

  protected readonly month = signal(new Date().toISOString().slice(0, 7));
  protected readonly selectedDate = signal('');
  protected readonly query = signal('');
  protected readonly status = signal<'all' | 'urgent' | 'active' | 'done'>('all');
  protected readonly monthLabel = computed(() => {
    const [year, month] = this.month().split('-').map(Number);
    const label = new Intl.DateTimeFormat('pl-PL', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, 1)));
    return label.charAt(0).toLocaleUpperCase('pl-PL') + label.slice(1);
  });
  protected readonly calendarCells = computed<CalendarCell[]>(() => {
    const [year, month] = this.month().split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mondayOffset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    return [
      ...Array.from({ length: mondayOffset }, () => ({ date: null, day: null })),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        return {
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          day,
        };
      }),
    ];
  });
  protected readonly filteredCases = computed(() => {
    const search = this.query().trim().toLocaleLowerCase('pl-PL');
    return this.cases()
      .filter((item) => {
        if (this.selectedDate() && item.dueDate !== this.selectedDate()) return false;
        if (this.status() === 'urgent' && (item.status === 'wyslana' || this.daysLeft(item.dueDate) > 1)) return false;
        if (this.status() === 'active' && item.status === 'wyslana') return false;
        if (this.status() === 'done' && item.status !== 'wyslana') return false;
        if (!search) return true;
        return [item.caseNumber, item.applicant, item.subject, item.assignee]
          .some((value) => value.toLocaleLowerCase('pl-PL').includes(search));
      })
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  });

  protected shiftMonth(delta: number): void {
    const [year, month] = this.month().split('-').map(Number);
    const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
    this.month.set(`${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`);
    this.selectedDate.set('');
  }

  protected hasDue(date: string | null): boolean {
    return this.cases().some((item) => item.dueDate === date && item.status !== 'wyslana');
  }

  protected selectDate(date: string): void {
    this.selectedDate.set(this.selectedDate() === date ? '' : date);
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  }

  protected statusLabel(status: WorkflowStatus): string {
    const labels: Record<WorkflowStatus, string> = {
      brak_dzialan: 'Nowa',
      zapytania_wyslane: 'Zapytanie wysłane',
      kwerenda: 'W trakcie ustaleń',
      doprecyzowanie: 'Oczekuje na doprecyzowanie',
      przygotowana: 'Projekt gotowy',
      wyslana: 'Odpowiedź wysłana',
    };
    return labels[status];
  }

  protected deadlineLabel(item: WniosekCase): string {
    if (item.status === 'wyslana') return 'Wysłana';
    const remaining = this.daysLeft(item.dueDate);
    if (remaining < 0) return `Po terminie: ${this.formatDate(item.dueDate)}`;
    if (remaining === 0) return 'Termin dzisiaj';
    if (remaining === 1) return 'Termin jutro';
    return `Termin: ${this.formatDate(item.dueDate)}`;
  }

  protected daysLeft(value: string): number {
    return Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${this.referenceDate()}T00:00:00Z`)) / 86_400_000);
  }

}
