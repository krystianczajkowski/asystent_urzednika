import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DocumentAnalysis } from '../models/document-analysis';

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  constructor(private readonly http: HttpClient) {}

  isSupported(file: File): boolean {
    const allowedTypes = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]);
    const allowedExtensions = /\.(pdf|docx|txt)$/i;
    return (
      (allowedTypes.has(file.type) || allowedExtensions.test(file.name)) &&
      file.size <= 10 * 1024 * 1024
    );
  }

  async analyze(file: File): Promise<DocumentAnalysis> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      return await firstValueFrom(
        this.http.post<DocumentAnalysis>(
          `${environment.apiUrl}/documents/analyze`,
          formData,
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const payload = error.error as { message?: string } | null;
        throw new Error(payload?.message ?? 'Nie udało się połączyć z API.');
      }
      throw error;
    }
  }
}
