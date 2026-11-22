import { Module } from '@nestjs/common';
import { BielikAiModule } from './bielik-ai/bielik-ai.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { CommonModule } from './common/common.module.js';
import { WorkspaceModule } from './workspace/workspace.module.js';

@Module({
  imports: [CommonModule, BielikAiModule, DocumentsModule, WorkspaceModule],
})
export class AppModule {}
