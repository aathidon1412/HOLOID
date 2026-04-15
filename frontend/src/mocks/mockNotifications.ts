export interface Notification {
  id: string;
  type: 'crit' | 'info' | 'maint';
  title: string;
  subtitle: string;
  time: string;
  read: boolean;
}

export const mockNotifications: Notification[] = [
  { id: 'n1', type: 'crit', title: 'ICU capacity critical — Ward A', subtitle: 'Only 2 beds remaining', time: '2 min ago', read: false },
  { id: 'n2', type: 'info', title: 'Transfer TR-2048 dispatched', subtitle: 'Ambulance en route to Mercy General', time: '12 min ago', read: false },
  { id: 'n3', type: 'maint', title: 'Ventilator maintenance scheduled', subtitle: 'Ward B — 3 units offline at 2 PM', time: '1 hr ago', read: false },
  { id: 'n4', type: 'info', title: 'Transfer TR-2046 completed', subtitle: 'Patient admitted at City General', time: '3 hr ago', read: true },
];
