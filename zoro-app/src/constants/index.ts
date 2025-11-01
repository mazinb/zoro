import { Country, Question, Article } from '@/types';

export const COUNTRIES: Country[] = [
  { code: '+91', name: 'India', flag: '🇮🇳', minLength: 10, maxLength: 10 },
  { code: '+971', name: 'UAE', flag: '🇦🇪', minLength: 9, maxLength: 9 },
  { code: '+1', name: 'USA', flag: '🇺🇸', minLength: 10, maxLength: 10 },
  { code: '+66', name: 'Thailand', flag: '🇹🇭', minLength: 9, maxLength: 9 }
];

export const FORM_STEPS = {
  INTRO: 'intro',
  QUESTIONS: 'questions',
  CONTACT: 'contact',
  REVIEW: 'review',
  SUCCESS: 'success'
} as const;

export const ANIMATION_DELAYS = {
  STEP_TRANSITION: 300,
  BLUE_LINE: 800,
  GREY_LINE: 1600,
  TEXT: 2400,
  FADE_OUT: 3200,
  FADE_OUT_DURATION: 500,
  LINE_DRAW_DURATION: 800
} as const;

export const DEFAULT_FORM_ANSWERS = {
  primaryGoal: '',
  netWorth: '',
  estateStatus: '',
  timeHorizon: '',
  concernLevel: ''
};

export const ARTICLES: Article[] = [
  {
    title: "Life Insurance: Protection That Makes Sense",
    slug: "life-insurance",
    excerpt: "Term insurance is simple, affordable protection for your family. No complex products, no hidden fees—just straightforward coverage when it matters most.",
    readTime: "8 min read"
  },
  {
    title: "Passive Investing: The Long Game",
    slug: "passive-investing", 
    excerpt: "Low-cost index funds, consistent contributions, and patience. The data shows that most investors win by doing less, not more.",
    readTime: "12 min read"
  },
  {
    title: "Property Investment: Reality Check",
    slug: "property-investing",
    excerpt: "Real estate can build wealth, but it's not passive income. Understanding the true costs, risks, and time commitment before you invest.",
    readTime: "10 min read"
  }
];

// Questions will be created with icons in the component to avoid circular dependencies
export const QUESTION_CONFIGS: Omit<Question, 'options'>[] = [
  {
    id: 'primaryGoal',
    question: "What's your primary financial goal?",
  },
  {
    id: 'netWorth',
    question: "What's your approximate net worth?",
  },
  {
    id: 'estateStatus',
    question: "Do you have an estate plan in place?",
  },
  {
    id: 'timeHorizon',
    question: "What's your planning timeline?",
  },
  {
    id: 'concernLevel',
    question: "What concerns you most right now?",
  }
];

