import { Inbox } from 'lucide-react';

const EmptyState = ({ message = 'No records found in current view' }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground animate-in fade-in zoom-in-95 duration-500">
    <Inbox size={48} className="mb-4 opacity-20" />
    <p className="text-sm font-medium italic">{message}</p>
  </div>
);

export default EmptyState;
