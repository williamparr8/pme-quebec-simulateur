import { useEffect, useRef, type ComponentType, type KeyboardEvent } from 'react';
import { argentRond, moisAnnee } from '../../i18n/format';
import { ONGLETS, useJeu, type Onglet } from '../../store/jeu';
import { Bouton } from '../composants/Bouton';
import { ChoixTheme } from '../composants/ChoixTheme';
import { FORMES } from '../creation/formes';
import { useJeuCourant } from './contexte';
import { Modales } from './Modales';
import { EcranPassage } from './Passage';
import { PanneauTutoriel } from './Tutoriel';
import { PageFinance } from './pages/PageFinance';
import { PageJuridique } from './pages/PageJuridique';
import { PageMarketing } from './pages/PageMarketing';
import { PageOperations } from './pages/PageOperations';
import { PageRH } from './pages/PageRH';
import { PageTableau } from './pages/PageTableau';
import { PageVentes } from './pages/PageVentes';
import { useRaccourcis } from './useRaccourcis';

const PAGES: Record<Onglet, ComponentType> = {
  tableau: PageTableau,
  marketing: PageMarketing,
  rh: PageRH,
  operations: PageOperations,
  ventes: PageVentes,
  finance: PageFinance,
  juridique: PageJuridique,
};

function EnTete() {
  const { etat, ent, secteur, ville, date } = useJeuCourant();
  const ouvrirModale = useJeu((s) => s.ouvrirModale);
  const quitter = useJeu((s) => s.quitter);
  const encaisse = ent.livre.soldes.encaisse / 100;
  const marge = -ent.livre.soldes.margeCredit / 100;
  return (
    <header className="pas-imprimer border-b border-bordure bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-9 w-9 rounded-lg"
            style={{ background: ent.couleur }}
            aria-hidden="true"
          />
          <div>
            <p className="text-lg font-extrabold leading-tight">
              {ent.nom}
              {ent.equipe && (
                <span className="ml-2 rounded-md bg-surface-2 px-2 py-0.5 text-sm font-semibold">
                  {ent.equipe}
                </span>
              )}
            </p>
            <p className="text-sm text-doux">
              {secteur.nom} · {ville.nom} · {FORMES.find((x) => x.id === ent.formeJuridique)?.nom}
            </p>
          </div>
        </div>
        <div>
          <p className="text-sm text-doux">
            {etat.terminee
              ? 'Partie terminée'
              : `Mois ${etat.moisCourant + 1} sur ${etat.config.dureeMois}`}
          </p>
          <p className="font-bold first-letter:uppercase">{moisAnnee(date.annee, date.mois)}</p>
        </div>
        <div className="chiffres">
          <p className="text-sm text-doux">Encaisse</p>
          <p className={`font-bold ${encaisse < 0 ? 'text-danger' : ''}`}>
            {argentRond(encaisse)}
            {marge > 0 && (
              <span className="ml-2 text-sm font-semibold text-alerte">
                (marge utilisée : {argentRond(marge)})
              </span>
            )}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Bouton petit onClick={() => ouvrirModale('sauvegardes')}>
            Sauvegardes
          </Bouton>
          <Bouton petit onClick={() => ouvrirModale('glossaire')} raccourci="G">
            Glossaire
          </Bouton>
          <Bouton petit onClick={() => ouvrirModale('aide')} raccourci="?">
            Aide
          </Bouton>
          <ChoixTheme />
          <Bouton
            petit
            variante="discret"
            onClick={() => {
              if (
                window.confirm(
                  'Retourner à l’accueil? La partie est sauvegardée automatiquement à la fin de chaque mois.',
                )
              )
                quitter();
            }}
          >
            Quitter
          </Bouton>
        </div>
      </div>
    </header>
  );
}

function Navigation() {
  const onglet = useJeu((s) => s.onglet);
  const changerOnglet = useJeu((s) => s.changerOnglet);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Flèches gauche/droite entre les onglets (modèle « tablist » de l'ARIA).
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let cible = -1;
    if (e.key === 'ArrowRight') cible = (i + 1) % ONGLETS.length;
    else if (e.key === 'ArrowLeft') cible = (i - 1 + ONGLETS.length) % ONGLETS.length;
    else if (e.key === 'Home') cible = 0;
    else if (e.key === 'End') cible = ONGLETS.length - 1;
    if (cible >= 0) {
      e.preventDefault();
      changerOnglet(ONGLETS[cible].id);
      refs.current[cible]?.focus();
    }
  };

  return (
    <nav
      className="pas-imprimer sticky top-0 z-30 border-b border-bordure bg-surface/95 backdrop-blur"
      aria-label="Départements"
    >
      <div
        role="tablist"
        aria-label="Départements"
        className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2"
      >
        {ONGLETS.map((o, i) => {
          const actif = o.id === onglet;
          return (
            <button
              key={o.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`onglet-${o.id}`}
              role="tab"
              type="button"
              aria-selected={actif}
              aria-controls="panneau-departement"
              aria-keyshortcuts={o.touche}
              tabIndex={actif ? 0 : -1}
              onClick={() => changerOnglet(o.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`flex shrink-0 items-center gap-2 border-b-[3px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                actif
                  ? 'border-accent text-accent'
                  : 'border-transparent text-doux hover:text-texte'
              }`}
            >
              {o.nom}
              <kbd className="rounded border border-bordure px-1 text-xs">{o.touche}</kbd>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function BarreFinMois() {
  const { etat, ent, date } = useJeuCourant();
  const ouvrirModale = useJeu((s) => s.ouvrirModale);
  return (
    <div className="pas-imprimer sticky bottom-0 z-30 border-t border-bordure bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <p className="text-sm text-doux">
          {etat.terminee
            ? 'La partie est terminée. Consulte ton bilan de fin de partie.'
            : `${ent.equipe ? `${ent.equipe} : t` : 'T'}es décisions s’appliqueront au mois de ${moisAnnee(date.annee, date.mois)}.`}
        </p>
        {etat.terminee ? (
          <Bouton variante="primaire" onClick={() => ouvrirModale('fin')}>
            Bilan de fin de partie
          </Bouton>
        ) : (
          <Bouton
            variante="primaire"
            onClick={() => ouvrirModale('confirmerMois')}
            raccourci="Espace"
          >
            {ent.equipe ? 'Terminer notre tour' : 'Terminer le mois'}
          </Bouton>
        )}
      </div>
    </div>
  );
}

export function EcranJeu() {
  const passage = useJeu((s) => s.passage);
  // Mode équipes : l'écran de passation cache tout le jeu de l'équipe précédente.
  return passage ? <EcranPassage /> : <Jeu />;
}

function Jeu() {
  const onglet = useJeu((s) => s.onglet);
  const premierRendu = useRef(true);
  useRaccourcis();

  // Après un changement de département, le focus va au titre de la page (lecteurs d'écran, Tab).
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    document.querySelector<HTMLElement>('#panneau-departement [data-titre-page]')?.focus();
  }, [onglet]);

  const Page = PAGES[onglet];
  return (
    <div className="flex min-h-screen flex-col">
      <EnTete />
      <Navigation />
      <main id="contenu" className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        <div id="panneau-departement" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
          <Page />
        </div>
      </main>
      <BarreFinMois />
      <PanneauTutoriel />
      <Modales />
    </div>
  );
}
