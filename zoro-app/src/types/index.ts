export interface QuestionOption {
  value: string;
  label: string;
  icon: React.ReactNode;
}

export interface Question {
  id: string;
  question: string;
  options: QuestionOption[];
}

export interface FormAnswers {
  primaryGoal: string;
  netWorth: string;
  estateStatus: string;
  timeHorizon: string;
  concernLevel: string;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
  minLength: number;
  maxLength: number;
}

export interface Article {
  title: string;
  slug: string;
  excerpt: string;
  readTime: string;
}

export type ContactMethod = 'whatsapp' | 'email';

