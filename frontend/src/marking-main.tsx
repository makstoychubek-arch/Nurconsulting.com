import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import './marking.css';

const MarkingModule = lazy(() =>
  import('./components/marking/MarkingModule').then((m) => ({ default: m.MarkingModule })),
);

declare global {
  interface Window {
    __markingMounted?: boolean;
    callWbProxy?: (action: string, params: Record<string, unknown>) => Promise<unknown>;
  }
}

const rootEl = document.getElementById('marking-root');

if (rootEl && !window.__markingMounted) {
  createRoot(rootEl).render(
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MarkingModule />
    </Suspense>,
  );
  window.__markingMounted = true;
}
