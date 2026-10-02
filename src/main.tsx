import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './index.css';

const racine = document.getElementById('racine');
if (!racine) throw new Error('Élément #racine introuvable');

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Audit d'accessibilité en développement seulement (axe-core, WCAG 2.1 A et AA) :
// dans la console du navigateur, lancer « await auditAccessibilite() ».
if (import.meta.env.DEV) {
  (window as unknown as { auditAccessibilite: () => Promise<unknown> }).auditAccessibilite =
    async () => {
      const axe = (await import('axe-core')).default;
      const r = await axe.run(document, {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      });
      return r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        aide: v.help,
        n: v.nodes.length,
        cibles: v.nodes
          .slice(0, 4)
          .map((n) => `${n.target.join(' ')} :: ${n.failureSummary ?? ''}`.slice(0, 220)),
      }));
    };
}
