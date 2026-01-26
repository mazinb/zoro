import { GoalFormPage, GoalField } from '@/components/goals/GoalFormPage';

const fields: GoalField[] = [
  {
    id: 'coverage',
    label: 'What coverage are you reviewing?',
    placeholder: 'Health, life, property, travel, etc.'
  },
  {
    id: 'gaps',
    label: 'Any gaps or concerns you already see?',
    placeholder: 'High premiums, low coverage, missing riders, etc.'
  },
  {
    id: 'notes',
    label: 'Anything else we should know?',
    placeholder: 'Dependents, employer coverage, or special requirements.',
    type: 'textarea'
  }
];

export default function InsurancePage() {
  return (
    <GoalFormPage
      title="Review insurance"
      subtitle="Share your current coverage so we can flag gaps and opportunities."
      fields={fields}
    />
  );
}

