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

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  author: string;
  publishDate: string;
  estimatedReadTime: number;
  category: string;
  targetAudience: string[];
  complexity: string;
  jurisdiction: string[];
  keyTopics: string[];
  engagementScore: number;
}

export type ViewMode = 'user' | 'planner';

export type SearchExpanded = 'tags' | 'author' | '';

export interface User {
  id: string;
  email?: string;
  name?: string;
  role?: 'user' | 'planner' | 'admin';
  avatar_url?: string;
}

export interface AuthSession {
  user: User | null;
  session: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    user?: {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    };
  } | null;
  loading: boolean;
}

