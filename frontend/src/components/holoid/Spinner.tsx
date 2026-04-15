import { Loader2 } from 'lucide-react';

const Spinner = ({ size = 20 }: { size?: number }) => (
  <Loader2 size={size} className="animate-spin text-primary opacity-70" />
);

export default Spinner;
