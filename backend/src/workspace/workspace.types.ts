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
  status:
    | 'brak_dzialan'
    | 'zapytania_wyslane'
    | 'kwerenda'
    | 'doprecyzowanie'
    | 'przygotowana'
    | 'wyslana';
  kwerendaDays: number;
  tags: string[];
  summary: string;
  recommendedDepartmentId: string;
  departmentReplyText: string;
  draftResponseText: string;
  savedToKnowledgeBase: boolean;
  analysis: null;
}
