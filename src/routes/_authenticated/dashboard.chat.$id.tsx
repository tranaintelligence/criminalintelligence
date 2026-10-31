import { createFileRoute } from '@tanstack/react-router';
import { ChatView } from './dashboard.chat';

export const Route = createFileRoute('/_authenticated/dashboard/chat/$id')({
  head: () => ({
    meta: [
      { title: 'Citizens Dashboard — TRANA' },
      { name: 'description', content: 'Statutory AI legal advisor session with verified citations.' },
      { property: 'og:title', content: 'Citizens Dashboard — TRANA' },
    ],
  }),
  component: ChatView,
});
