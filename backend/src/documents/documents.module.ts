import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { BielikAiModule } from '../bielik-ai/bielik-ai.module.js';

@Module({
  imports: [BielikAiModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
