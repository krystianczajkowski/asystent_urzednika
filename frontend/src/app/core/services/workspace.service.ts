import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AnalyzeRequestPayload,
  GenerateResponsePayload,
  InitialDataPayload,
  NeuralAnalysis,
} from '../models/workspace';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  constructor(private readonly http: HttpClient) {}

  async loadInitialData(): Promise<InitialDataPayload> {
    return this.request(this.http.get<InitialDataPayload>(environment.apiUrl + '/initial-data'));
  }

  async analyzeRequest(payload: AnalyzeRequestPayload): Promise<NeuralAnalysis> {
    const result = await this.request(
      this.http.post<{ analysis: NeuralAnalysis }>(
        environment.apiUrl + '/analyze-request',
        payload,
      ),
    );
    return result.analysis;
  }

  async generateResponse(payload: GenerateResponsePayload): Promise<string> {
    const result = await this.request(
      this.http.post<{ draftText: string }>(
        environment.apiUrl + '/generate-response',
        payload,
      ),
    );
    return result.draftText;
  }

  private async request<T>(request: import('rxjs').Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const payload = error.error as { message?: string | string[]; error?: string } | null;
        const message = Array.isArray(payload?.message)
          ? payload.message.join(', ')
          : payload?.message ?? payload?.error;
        throw new Error(message ?? 'Nie udało się połączyć z API.');
      }
      throw error;
    }
  }
}
