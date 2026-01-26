import { GoalFormPage, GoalField } from '@/components/goals/GoalFormPage';

const fields: GoalField[] = [
  {
    id: 'purchase',
    label: 'What purchase are you planning for?',
    placeholder: 'Home down payment, education, car, etc.'
  },
  {
    id: 'budget',
    label: 'What budget range are you aiming for?',
    placeholder: 'Share a rough target amount if you have one'
  },
  {
    id: 'notes',
    label: 'Anything else we should know?',
    placeholder: 'Timeline, location, or financing constraints.',
    type: 'textarea'
  }
];

export default function HomePage() {
  return (
    <GoalFormPage
      title="Plan for big purchases"
      subtitle="We’ll help you map out the funding plan for your next big purchase."
      fields={fields}
    />
  );
}

