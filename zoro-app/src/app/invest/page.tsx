import { GoalFormPage, GoalField } from '@/components/goals/GoalFormPage';

const fields: GoalField[] = [
  {
    id: 'portfolio',
    label: 'What does your current portfolio look like?',
    placeholder: 'Mutual funds, stocks, ETFs, retirement accounts, etc.'
  },
  {
    id: 'risk',
    label: 'How do you feel about risk right now?',
    placeholder: 'Conservative, balanced, aggressive, not sure'
  },
  {
    id: 'notes',
    label: 'Anything else we should know?',
    placeholder: 'Share target returns, constraints, or investment preferences.',
    type: 'textarea'
  }
];

export default function InvestPage() {
  return (
    <GoalFormPage
      title="Invest smarter"
      subtitle="Tell us how you invest today and what you want to improve."
      fields={fields}
    />
  );
}

