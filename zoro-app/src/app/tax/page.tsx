import { GoalFormPage, GoalField } from '@/components/goals/GoalFormPage';

const fields: GoalField[] = [
  {
    id: 'situation',
    label: 'What do you want to improve about your taxes?',
    placeholder: 'Lower taxable income, optimize investments, plan for capital gains, etc.'
  },
  {
    id: 'year',
    label: 'Which tax year are you focused on?',
    placeholder: 'e.g. FY 2025-26'
  },
  {
    id: 'notes',
    label: 'Anything else we should know?',
    placeholder: 'Income sources, residency status, or tax concerns.',
    type: 'textarea'
  }
];

export default function TaxPage() {
  return (
    <GoalFormPage
      title="Tax optimization"
      subtitle="Give us the highlights so we can target the biggest opportunities."
      fields={fields}
    />
  );
}

