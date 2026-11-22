import { Injectable } from '@nestjs/common';
import {
  anonymizationRules,
  cases,
  departments,
  knowledgeBase,
  sampleDocuments,
} from './workspace-data.js';

@Injectable()
export class WorkspaceService {
  getInitialData() {
    return {
      cases,
      departments,
      knowledgeBase,
      anonymizationRules,
      sampleDocuments,
    };
  }
}
