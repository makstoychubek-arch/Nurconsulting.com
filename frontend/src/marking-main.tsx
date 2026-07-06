import { createRoot } from 'react-dom/client';
import { MarkingModule } from './components/marking/MarkingModule';
import './marking.css';

declare global {
  interface Window {
    __markingMounted?: boolean;
    callWbProxy?: (action: string, params: Record<string, unknown>) => Promise<unknown>;
  }
}

const rootEl = document.getElementById('marking-root');

if (rootEl && !window.__markingMounted) {
  createRoot(rootEl).render(<MarkingModule />);
  window.__markingMounted = true;
}
