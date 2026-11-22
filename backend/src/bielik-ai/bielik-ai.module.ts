import { Module } from '@nestjs/common';
import { BielikAiService } from './bielik-ai.service.js';

@Module({
  providers: [BielikAiService],
  exports: [BielikAiService],
})
export class BielikAiModule {}
