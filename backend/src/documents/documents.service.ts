import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { extname } from 'node:path';
import {
  BielikAiService,
  DocumentAnalysis,
} from '../bielik-ai/bielik-ai.service.js';

@Injectable()
export class DocumentsService {
  constructor(private readonly bielikAi: BielikAiService) {}

  async analyze(file: Express.Multer.File): Promise<DocumentAnalysis> {
    let text: string;
    try {
      const extension = extname(file.originalname).toLowerCase();
      if (extension === '.pdf') {
        const parser = new PDFParse({ data: file.buffer });
        try {
          const result = await parser.getText();
          text = result.text;
        } finally {
          await parser.destroy();
        }
      } else if (extension === '.docx') {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        text = result.value;
      } else if (extension === '.txt') {
        text = file.buffer.toString('utf8');
      } else {
        throw new UnprocessableEntityException(
          'Dozwolone są tylko pliki PDF, DOCX i TXT.',
        );
      }
    } catch (error) {
      throw new UnprocessableEntityException(
        error instanceof Error
          ? `Nie udało się odczytać dokumentu: ${error.message}`
          : 'Nie udało się odczytać dokumentu.',
      );
    }

    const cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (!cleaned) {
      throw new UnprocessableEntityException(
        'Dokument nie zawiera tekstu do analizy.',
      );
    }
    return this.bielikAi.analyze(file.originalname, cleaned);
  }
}
