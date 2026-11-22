export type WorkflowStatus =
  | 'brak_dzialan'
  | 'zapytania_wyslane'
  | 'kwerenda'
  | 'doprecyzowanie'
  | 'przygotowana'
  | 'wyslana';

export type ResponseMode = 'merit' | 'clarification' | 'redirect' | 'extension';

export interface SimilarCaseMatch {
  kbId: string;
  caseNumber: string;
  title: string;
  similarityPercent: number;
  reason: string;
  reusableExcerpt: string;
}

export interface RoutingPrediction {
  departmentId: string;
  departmentName: string;
  isExternal: boolean;
  confidencePercent: number;
  actionType:
    | 'internal_inquiry'
    | 'external_redirect'
    | 'clarification'
    | 'direct_answer';
  reason: string;
}

export interface NeuralAnalysis {
  summary: string;
  tags: string[];
  extractedMetadata: {
    applicantName: string;
    subject: string;
    detectedDate: string;
    urgencyHint: string;
  };
  knowledgeBaseMatchFound: boolean;
  similarCases: SimilarCaseMatch[];
  routingPredictions: RoutingPrediction[];
  departmentInquiryDraft: string;
  legalBasis: string[];
}

export interface WniosekCase {
  id: string;
  lp: number;
  caseNumber: string;
  applicant: string;
  subject: string;
  fullRequestText: string;
  receivedDate: string;
  dueDate: string;
  responseDate: string | null;
  assignee: string;
  status: WorkflowStatus;
  kwerendaDays: number;
  tags: string[];
  summary: string;
  recommendedDepartmentId: string;
  departmentReplyText: string;
  draftResponseText: string;
  savedToKnowledgeBase: boolean;
  analysis: NeuralAnalysis | null;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  isExternal: boolean;
  scope: string;
  contactEmail: string;
  address?: string;
  phone?: string;
}

export interface KnowledgeBaseEntry {
  id: string;
  type: 'archival_qa' | 'legal_act' | 'ordinance';
  caseNumber: string;
  title: string;
  department: string;
  date: string;
  tags: string[];
  questionSummary: string;
  answerText: string;
}

export interface SampleDocument {
  id: string;
  label: string;
  fileName: string;
  description: string;
  content: string;
}

export interface InitialDataPayload {
  cases: WniosekCase[];
  departments: Department[];
  knowledgeBase: KnowledgeBaseEntry[];
  anonymizationRules: string[];
  sampleDocuments: SampleDocument[];
}

export interface AnalyzeRequestPayload {
  text: string;
  knowledgeBase: KnowledgeBaseEntry[];
  departments: Department[];
}

export interface GenerateResponsePayload {
  caseNumber: string;
  applicant: string;
  requestText: string;
  departmentReplyText: string;
  responseMode: ResponseMode;
  similarContext: string;
  officialNotes: string;
}
