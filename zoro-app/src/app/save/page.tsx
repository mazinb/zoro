import { GoalFormPage, GoalField } from '@/components/goals/GoalFormPage';

const fields: GoalField[] = [
  {
    id: 'priority',
    label: 'What savings goal matters most right now?',
    placeholder: 'Emergency fund, debt payoff, consistent monthly savings, etc.'
  },
  {
    id: 'timeline',
    label: 'When do you want to hit this goal?',
    placeholder: 'e.g. 6 months, 12 months, 2 years'
  },
  {
    id: 'notes',
    label: 'Anything else we should know?',
    placeholder: 'Share any constraints, upcoming expenses, or current habits.',
    type: 'textarea'
  }
];

export default function SavePage() {
  return (
    <GoalFormPage
      title="Save more consistently"
      subtitle="Give us a quick snapshot of your savings goals so we can tailor the plan."
      fields={fields}
    />
  );
}

