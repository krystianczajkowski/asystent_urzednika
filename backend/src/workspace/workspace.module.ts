import { Module } from '@nestjs/common';
import { BielikAiModule } from '../bielik-ai/bielik-ai.module.js';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';

@Module({
  imports: [BielikAiModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
})
export class WorkspaceModule {}
