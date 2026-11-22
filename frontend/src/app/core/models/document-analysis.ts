export interface DocumentAnalysis {
  fileName: string;
  summary: string;
  extractedText: string;
  applicant: string;
  subject: string;
  requestedInformation: string[];
  deadlines: string[];
  recommendedDepartment: string;
  confidence: number;
  model: 'bielik';
}
