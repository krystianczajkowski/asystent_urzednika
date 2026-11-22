import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { BielikAiService } from '../bielik-ai/bielik-ai.service.js';
import { WorkspaceService } from './workspace.service.js';

@Controller('api')
export class WorkspaceController {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly bielikAi: BielikAiService,
  ) {}

  @Get('initial-data')
  getInitialData() {
    return this.workspace.getInitialData();
  }

  @Post('analyze-request')
  analyzeRequest(
    @Body()
    body: {
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
    },
  ) {
    if (!body || typeof body.text !== 'string') {
      throw new BadRequestException('Treść wniosku jest wymagana.');
    }
    return this.bielikAi.analyzeRequest(body);
  }

  @Post('generate-response')
  generateResponse(
    @Body()
    body: {
      caseNumber: string;
      applicant: string;
      requestText: string;
      departmentReplyText: string;
      responseMode: 'merit' | 'clarification' | 'redirect' | 'extension';
      similarContext?: string;
      officialNotes?: string;
    },
  ) {
    if (
      !body ||
      typeof body.requestText !== 'string' ||
      !body.requestText.trim() ||
      !['merit', 'clarification', 'redirect', 'extension'].includes(
        body.responseMode,
      )
    ) {
      throw new BadRequestException(
        'Treść wniosku i prawidłowy tryb odpowiedzi są wymagane.',
      );
    }
    return this.bielikAi.generateResponse(body);
  }
}
