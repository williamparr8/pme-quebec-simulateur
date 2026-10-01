/**
 * Tutoriel guidé des 3 premiers mois : un panneau discret propose, mois par mois, quoi
 * regarder et pourquoi. Il se ferme à tout moment.
 */
import { useJeu, type Onglet } from '../../store/jeu';
import { Bouton } from '../composants/Bouton';
import { useJeuCourant } from './contexte';

interface Etape {
  titre: string;
  texte: string;
  onglet?: Onglet;
}

/** Étapes par mois (index 0 = premier mois). */
const ETAPES_TUTORIEL: Etape[][] = [
  [
    {
      titre: 'Bienvenue dans ton entreprise!',
      texte:
        'Chaque tour dure un mois. Tu prends tes décisions dans les départements, puis tu termines le mois : le moteur calcule tes ventes, tes coûts et tes états financiers. Ce tutoriel t’accompagne pendant 3 mois.',
      onglet: 'tableau',
    },
    {
      titre: 'Tes prix et ta publicité',
      texte:
        'Dans Marketing (M), fixe le prix de chaque ligne de produits. Compare-le au prix de référence du marché : trop bas, tu perds de la marge; trop haut, tu perds des clients. La publicité fait connaître ton commerce (notoriété).',
      onglet: 'marketing',
    },
    {
      titre: 'Ton équipe',
      texte:
        'Dans Ressources humaines (R), vérifie que ton personnel couvre tes heures d’ouverture. Un employé coûte plus que son salaire : cotisations de l’employeur, vacances de 4 %… Survole les termes soulignés ou appuie sur I pour leur définition.',
      onglet: 'rh',
    },
    {
      titre: 'Tes heures et tes stocks',
      texte:
        'Dans Opérations (O), choisis tes heures d’ouverture et ta politique de stocks. Manquer de produits fait perdre des ventes; trop en commander crée des pertes.',
      onglet: 'operations',
    },
    {
      titre: 'Termine ton premier mois',
      texte:
        'Quand tu es prêt, appuie sur Espace ou sur « Terminer le mois ». Tu pourras inscrire une prévision de ventes et de bénéfice : la comparer au résultat réel est un excellent exercice.',
      onglet: 'tableau',
    },
  ],
  [
    {
      titre: 'Lis ton rapport mensuel',
      texte:
        'Le rapport explique ce qui a fonctionné, ce qui n’a pas fonctionné, et pourquoi. La conseillère, au tableau de bord, te signale aussi les décisions risquées.',
      onglet: 'tableau',
    },
    {
      titre: 'Tes états financiers',
      texte:
        'Dans Finance (F), regarde l’état des résultats (as-tu fait un profit?), le bilan (ce que tu possèdes et ce que tu dois) et les flux de trésorerie (d’où vient et où va l’argent). Un profit n’est pas la même chose que de l’argent en banque!',
      onglet: 'finance',
    },
    {
      titre: 'Tes clients et tes concurrents',
      texte:
        'Dans Ventes (V), vois combien de clients tu as servis ou perdus, et surveille tes concurrents : ils réagissent à tes prix avec un certain délai.',
      onglet: 'ventes',
    },
  ],
  [
    {
      titre: 'Taxes et obligations',
      texte:
        'Dans Juridique et fiscalité (J), vérifie tes démarches, tes remises de TPS et de TVQ et tes retenues à la source. Oublier une obligation peut coûter une amende.',
      onglet: 'juridique',
    },
    {
      titre: 'Le glossaire',
      texte:
        'Appuie sur G pour ouvrir le glossaire : plus de 150 termes de gestion, de comptabilité, de fiscalité et de marketing, avec une recherche. À la fin de ce mois, un quiz te permettra de gagner un rabais.',
    },
    {
      titre: 'À toi de jouer!',
      texte:
        'Le tutoriel se termine ici. Garde un œil sur ta trésorerie, écoute tes clients et ton équipe, et n’hésite pas à essayer des stratégies : le rapport de fin de partie te montrera tes meilleures et tes pires décisions.',
    },
  ],
];

export function PanneauTutoriel() {
  const { etat } = useJeuCourant();
  const tutoriel = useJeu((s) => s.tutoriel);
  const changerTutoriel = useJeu((s) => s.changerTutoriel);
  const changerOnglet = useJeu((s) => s.changerOnglet);
  const etapes = ETAPES_TUTORIEL[etat.moisCourant];
  if (!tutoriel.actif || !etapes || etat.terminee) return null;
  const i = Math.min(tutoriel.etape, etapes.length - 1);
  const etape = etapes[i];
  const aller = (k: number) => {
    changerTutoriel({ actif: true, etape: k });
    const o = etapes[k].onglet;
    if (o) changerOnglet(o);
  };

  return (
    <aside
      aria-label="Tutoriel"
      className="pas-imprimer fixed bottom-20 right-4 z-40 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border-2 border-accent bg-surface p-4 shadow-2xl"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        Tutoriel · mois {etat.moisCourant + 1} sur 3 · étape {i + 1} sur {etapes.length}
      </p>
      <h2 className="mt-1 font-bold">{etape.titre}</h2>
      <p className="mt-1 text-sm">{etape.texte}</p>
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        <Bouton
          petit
          variante="discret"
          onClick={() => changerTutoriel({ actif: false, etape: 0 })}
        >
          Quitter le tutoriel
        </Bouton>
        <div className="flex gap-2">
          {i > 0 && (
            <Bouton petit onClick={() => aller(i - 1)}>
              Précédent
            </Bouton>
          )}
          {i < etapes.length - 1 && (
            <Bouton petit variante="primaire" onClick={() => aller(i + 1)}>
              Suivant
            </Bouton>
          )}
        </div>
      </div>
    </aside>
  );
}
