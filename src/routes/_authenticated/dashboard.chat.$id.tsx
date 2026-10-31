import { createFileRoute } from '@tanstack/react-router';
import { ChatView } from './dashboard.chat';

export const Route = createFileRoute('/_authenticated/dashboard/chat/$id')({
  head: () => ({
    meta: [
      { title: 'Legal First Aid Session TRANA' },
      { name: 'description', content: 'Statutory AI legal advisor session with verified citations.' },
      { property: 'og:title', content: 'Legal First Aid Session TRANA' },
    ],
  }),
  component: ChatView,
});
