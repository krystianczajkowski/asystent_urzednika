import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'node:path';
import { DocumentsService } from './documents.service.js';

const allowedExtensions = new Set(['.pdf', '.docx', '.txt']);

@Controller('api')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Post('documents/analyze')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) => {
        if (!allowedExtensions.has(extname(file.originalname).toLowerCase())) {
          callback(
            new BadRequestException(
              'Dozwolone są tylko pliki PDF, DOCX i TXT.',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  analyze(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nie przesłano pliku.');
    }
    return this.documentsService.analyze(file);
  }
}
