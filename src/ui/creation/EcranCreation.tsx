/**
 * Création de l'entreprise : identité, emplacement, équipement, financement et
 * paramètres de la partie. Chaque étape explique les notions de gestion en jeu.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SECTEURS, VILLES, secteurParId, villeParId } from '../../data';
import { tauxPreferentiel, conjonctureInitiale } from '../../engine/economy';
import { versementMensuel } from '../../engine/loans';
import { graineDepuisTexte } from '../../engine/rng';
import {
  REGLES_FINANCEMENT,
  coutsDemarrage,
  loyerMensuelInitial,
  pretMaximum,
  validerDemarrage,
  type ErreurDemarrage,
} from '../../engine/simulation';
import {
  DUREES_PARTIE,
  type Difficulte,
  type DureePartie,
  type ParametresDemarrage,
} from '../../engine/types';
import { argent, argentRond, pourcentage } from '../../i18n/format';
import { DIFFICULTES_TEXTE } from '../../i18n/fr-CA';
import { useJeu } from '../../store/jeu';
import { Bouton } from '../composants/Bouton';
import { Astuce, Carte } from '../composants/Carte';
import { ChoixCartes } from '../composants/ChoixCartes';
import { Curseur } from '../composants/Curseur';
import { Terme } from '../composants/Terme';

const COULEURS = [
  { id: '#0b5cd5', nom: 'Bleu' },
  { id: '#d97706', nom: 'Orange' },
  { id: '#15803d', nom: 'Vert' },
  { id: '#be185d', nom: 'Framboise' },
  { id: '#7c3aed', nom: 'Violet' },
  { id: '#0f766e', nom: 'Sarcelle' },
  { id: '#b91c1c', nom: 'Rouge' },
  { id: '#334155', nom: 'Ardoise' },
];

const ETAPES = [
  'Ton entreprise',
  'Secteur et emplacement',
  'Équipement et aménagement',
  'Financement',
  'Partie',
];

const MOTS_GRAINE = [
  'erable',
  'poutine',
  'castor',
  'huard',
  'tourtiere',
  'sirop',
  'bleuet',
  'caribou',
  'fleurdelys',
];

const MESSAGES_ERREUR: Record<ErreurDemarrage, string> = {
  nomVide: 'Donne un nom à ton entreprise (étape 1).',
  apportInsuffisant: `La banque exige une mise de fonds d’au moins ${argentRond(REGLES_FINANCEMENT.apportMin)}.`,
  pretTropEleve: `La banque prête au plus ${REGLES_FINANCEMENT.multipleApportMax} $ pour chaque dollar que tu investis.`,
  financementInsuffisant: `Tes sources de financement ne couvrent pas les coûts de démarrage plus un fonds de roulement minimal de ${argentRond(REGLES_FINANCEMENT.fondsRoulementMin)}.`,
};

export function EcranCreation() {
  const allerA = useJeu((s) => s.allerA);
  const demarrer = useJeu((s) => s.demarrer);
  const [etape, setEtape] = useState(0);
  const titre = useRef<HTMLHeadingElement>(null);

  const [params, setParams] = useState<ParametresDemarrage>({
    nomEntreprise: 'Café du Coin',
    nomProprietaire: '',
    couleur: COULEURS[0].id,
    emplacementId: 'rue',
    equipementId: 'neuf',
    amenagementId: 'chaleureux',
    apportPersonnel: 45_000,
    montantPret: 85_000,
  });
  const [secteurId, setSecteurId] = useState('cafe');
  const [villeId, setVilleId] = useState('montreal');
  const [difficulte, setDifficulte] = useState<Difficulte>('realiste');
  const [duree, setDuree] = useState<DureePartie>(36);
  const [graine, setGraine] = useState(
    () =>
      `${MOTS_GRAINE[Math.floor(Math.random() * MOTS_GRAINE.length)]}-${Math.floor(Math.random() * 900 + 100)}`,
  );

  const secteur = secteurParId(secteurId);
  const ville = villeParId(villeId);
  const maj = (c: Partial<ParametresDemarrage>) => setParams((p) => ({ ...p, ...c }));
  const couts = coutsDemarrage(params, secteur, ville);
  const erreurs = validerDemarrage(params, secteur, ville);
  const tauxPret = tauxPreferentiel(conjonctureInitiale()) + REGLES_FINANCEMENT.ecartTauxPret;
  const versement =
    versementMensuel(
      Math.round(params.montantPret * 100),
      tauxPret,
      REGLES_FINANCEMENT.dureePretMois,
    ) / 100;
  const maxPret = pretMaximum(params.apportPersonnel);
  const fondsRoulement = params.apportPersonnel + params.montantPret - couts.total;

  useEffect(() => titre.current?.focus(), [etape]);

  const precedent = () => (etape === 0 ? allerA('accueil') : setEtape(etape - 1));
  const suivant = (e?: FormEvent) => {
    e?.preventDefault();
    if (etape < ETAPES.length - 1) setEtape(etape + 1);
    else if (erreurs.length === 0) {
      demarrer(
        {
          graine: graineDepuisTexte(graine.trim() || 'pme'),
          difficulte,
          dureeMois: duree,
          secteurId,
          villeId,
          anneeDepart: 2027,
        },
        params,
      );
    }
  };

  const emplacements = ville.emplacements.map((e) => ({
    id: e.id,
    titre: e.nom,
    description: e.description,
    detail: `Loyer : ${argentRond(loyerMensuelInitial(secteur, e))}/mois · achalandage ${pourcentage(e.achalandage, 0)}`,
  }));

  return (
    <main
      id="contenu"
      className="mx-auto max-w-4xl px-4 py-6"
      onKeyDown={(e) => {
        if (
          e.key === 'Escape' &&
          !(e.target instanceof HTMLInputElement && e.target.type === 'text')
        ) {
          e.preventDefault();
          precedent();
        }
      }}
    >
      <nav aria-label="Étapes de création" className="mb-4">
        <ol className="flex flex-wrap gap-2 text-sm">
          {ETAPES.map((nom, i) => (
            <li
              key={nom}
              aria-current={i === etape ? 'step' : undefined}
              className={`rounded-full px-3 py-1 font-semibold ${
                i === etape
                  ? 'bg-accent text-accent-texte'
                  : i < etape
                    ? 'bg-accent-doux text-accent'
                    : 'bg-surface-2 text-doux'
              }`}
            >
              {i + 1}. {nom}
            </li>
          ))}
        </ol>
      </nav>

      <form
        onSubmit={suivant}
        className="space-y-5"
        onKeyDown={(e) => {
          // Entrée valide l'étape, peu importe où se trouve le focus (sauf sur un bouton, qui a sa propre action).
          const cible = e.target as HTMLElement;
          if (e.key === 'Enter' && !cible.closest('button, [role="button"], textarea, summary')) {
            e.preventDefault();
            e.currentTarget.requestSubmit();
          }
        }}
      >
        <h1 ref={titre} tabIndex={-1} data-titre-page className="text-2xl font-extrabold">
          Étape {etape + 1} : {ETAPES[etape]}
        </h1>

        {etape === 0 && (
          <Carte>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="block font-semibold">Nom de l’entreprise</span>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={params.nomEntreprise}
                  onChange={(e) => maj({ nomEntreprise: e.target.value })}
                  className="w-full rounded-md border border-bordure bg-surface-2 px-3 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="block font-semibold">Ton nom (propriétaire)</span>
                <input
                  type="text"
                  maxLength={40}
                  value={params.nomProprietaire}
                  placeholder="Ex. Camille Tremblay"
                  onChange={(e) => maj({ nomProprietaire: e.target.value })}
                  className="w-full rounded-md border border-bordure bg-surface-2 px-3 py-2"
                />
              </label>
            </div>
            <fieldset className="mt-4">
              <legend className="mb-2 font-semibold">Couleur de l’enseigne</legend>
              <div className="flex flex-wrap gap-2">
                {COULEURS.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-bordure px-2 py-1 has-[:checked]:border-accent has-[:checked]:bg-accent-doux"
                  >
                    <input
                      type="radio"
                      name="couleur"
                      checked={params.couleur === c.id}
                      onChange={() => maj({ couleur: c.id })}
                    />
                    <span
                      className="inline-block h-5 w-5 rounded"
                      style={{ background: c.id }}
                      aria-hidden="true"
                    />
                    {c.nom}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-4">
              <Astuce titre="Forme juridique : entreprise individuelle">
                Pour ce premier jalon, tu démarres en{' '}
                <Terme id="entrepriseIndividuelle">entreprise individuelle</Terme>. Si ton
                entreprise porte un autre nom que le tien (ex. «{' '}
                {params.nomEntreprise || 'Café du Coin'} »), tu dois l’immatriculer au Registraire
                des entreprises du Québec (REQ). Les sociétés par actions, SENC et coopératives
                arrivent au Jalon 2.
              </Astuce>
            </div>
          </Carte>
        )}

        {etape === 1 && (
          <Carte>
            <div className="space-y-5">
              <ChoixCartes
                legende="Secteur d’activité"
                nom="secteur"
                valeur={secteurId}
                onChange={setSecteurId}
                options={[
                  ...SECTEURS.map((s) => ({ id: s.id, titre: s.nom, description: s.description })),
                  {
                    id: 'bientot-1',
                    titre: 'Boutique de vêtements',
                    description: 'Jalon 4',
                    desactive: true,
                  },
                  {
                    id: 'bientot-2',
                    titre: 'Commerce en ligne',
                    description: 'Jalon 4',
                    desactive: true,
                  },
                ]}
              />
              <ChoixCartes
                legende="Ville"
                nom="ville"
                valeur={villeId}
                onChange={setVilleId}
                colonnes={4}
                options={[
                  ...VILLES.map((v) => ({ id: v.id, titre: v.nom })),
                  ...['Québec', 'Laval', 'Gatineau', 'Sherbrooke'].map((nom) => ({
                    id: nom,
                    titre: nom,
                    description: 'Jalon 4',
                    desactive: true,
                  })),
                ]}
              />
              <ChoixCartes
                legende={`Emplacement (local de ${secteur.superficiePi2.toLocaleString('fr-CA')} pi²)`}
                nom="emplacement"
                valeur={params.emplacementId}
                onChange={(id) => maj({ emplacementId: id })}
                options={emplacements}
              />
              <Astuce>
                Le loyer d’un local commercial s’exprime en dollars par pied carré par année. On
                ajoute souvent les frais communs (taxes foncières, entretien) : c’est un bail « net
                ». Un bon emplacement attire plus de clients, mais coûte plus cher chaque mois, que
                tu vendes ou non.
              </Astuce>
            </div>
          </Carte>
        )}

        {etape === 2 && (
          <Carte>
            <div className="space-y-5">
              <ChoixCartes
                legende="Équipement"
                nom="equipement"
                valeur={params.equipementId}
                onChange={(id) => maj({ equipementId: id })}
                options={secteur.equipements.map((e) => ({
                  id: e.id,
                  titre: e.nom,
                  description: e.description,
                  detail: `${argentRond(e.cout)} · amorti sur ${e.dureeVieMois / 12} ans`,
                }))}
              />
              <ChoixCartes
                legende="Aménagement du local"
                nom="amenagement"
                valeur={params.amenagementId}
                onChange={(id) => maj({ amenagementId: id })}
                options={secteur.amenagements.map((a) => ({
                  id: a.id,
                  titre: a.nom,
                  description: a.description,
                  detail: `${argentRond(a.cout)} · ambiance ${Math.round(a.ambiance * 10)}/10`,
                }))}
              />
              <Astuce>
                L’équipement et les travaux sont des{' '}
                <Terme id="immobilisations">immobilisations</Terme> : ils ne sont pas une charge le
                jour de l’achat. Leur coût est réparti sur leur durée de vie par l’
                <Terme id="amortissement">amortissement</Terme>. Mais l’argent, lui, sort tout de
                suite de ton compte!
              </Astuce>
            </div>
          </Carte>
        )}

        {etape === 3 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Carte titre="Tes sources de financement">
              <div className="space-y-5">
                <Curseur
                  libelle="Mise de fonds personnelle"
                  valeur={params.apportPersonnel}
                  min={5_000}
                  max={100_000}
                  decimales={0}
                  format={argentRond}
                  // Le prêt demandé ne peut pas dépasser le maximum permis par la banque.
                  onChange={(v) =>
                    maj({
                      apportPersonnel: v,
                      montantPret: Math.min(params.montantPret, pretMaximum(v)),
                    })
                  }
                  aide="Ton épargne investie dans l’entreprise. C’est ton capital : tu risques de le perdre."
                />
                <Curseur
                  libelle="Prêt bancaire de démarrage"
                  valeur={params.montantPret}
                  min={0}
                  max={Math.max(1, maxPret)}
                  decimales={0}
                  format={argentRond}
                  terme="pretTerme"
                  onChange={(v) => maj({ montantPret: Math.min(v, maxPret) })}
                  aide={`Maximum : ${argentRond(maxPret)} (3 $ par dollar investi). Taux fixe de ${pourcentage(tauxPret, 2)} (préférentiel + 2,5 %) sur 5 ans : ${argent(versement)} par mois.`}
                />
              </div>
            </Carte>
            <Carte titre="Coûts de démarrage">
              <table className="chiffres w-full text-sm">
                <tbody>
                  {[
                    ['Équipement', couts.equipement],
                    ['Aménagement (améliorations locatives)', couts.amenagement],
                    [
                      `Dépôt de garantie (${REGLES_FINANCEMENT.moisDepotGarantie} mois de loyer)`,
                      couts.depotGarantie,
                    ],
                    ['Stock initial', couts.stockInitial],
                    ['Permis, enseigne, inauguration', couts.fraisDemarrage],
                  ].map(([nom, montant]) => (
                    <tr key={nom as string} className="border-b border-bordure">
                      <td className="py-1">{nom}</td>
                      <td className="py-1 text-right">{argentRond(montant as number)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-1">Total des coûts</td>
                    <td className="py-1 text-right">{argentRond(couts.total)}</td>
                  </tr>
                  <tr>
                    <td className="py-1">Mise de fonds + prêt</td>
                    <td className="py-1 text-right">
                      {argentRond(params.apportPersonnel + params.montantPret)}
                    </td>
                  </tr>
                  <tr
                    className={`font-bold ${fondsRoulement < REGLES_FINANCEMENT.fondsRoulementMin ? 'text-danger' : 'text-succes'}`}
                  >
                    <td className="py-1">
                      Encaisse à l’ouverture (<Terme id="fondsRoulement">fonds de roulement</Terme>)
                    </td>
                    <td className="py-1 text-right">{argentRond(fondsRoulement)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-sm text-doux">
                Prévois un coussin : les premiers mois, les ventes ne couvrent pas encore le loyer,
                la paie et le remboursement du prêt. Une marge de crédit d’urgence est aussi offerte
                par la banque.
              </p>
            </Carte>
          </div>
        )}

        {etape === 4 && (
          <Carte>
            <div className="space-y-5">
              <ChoixCartes
                legende="Difficulté"
                nom="difficulte"
                valeur={difficulte}
                onChange={(id) => setDifficulte(id as Difficulte)}
                options={(Object.keys(DIFFICULTES_TEXTE) as Difficulte[]).map((d) => ({
                  id: d,
                  titre: DIFFICULTES_TEXTE[d].nom,
                  description: DIFFICULTES_TEXTE[d].description,
                }))}
              />
              <ChoixCartes
                legende="Durée de la partie"
                nom="duree"
                valeur={String(duree)}
                onChange={(id) => setDuree(Number(id) as DureePartie)}
                colonnes={4}
                options={DUREES_PARTIE.map((d) => ({
                  id: String(d),
                  titre: `${d} mois`,
                  description: `${d / 12} exercice${d > 12 ? 's' : ''} financier${d > 12 ? 's' : ''}`,
                }))}
              />
              <label className="block max-w-sm space-y-1">
                <span className="block font-semibold">Graine de la partie</span>
                <input
                  type="text"
                  value={graine}
                  onChange={(e) => setGraine(e.target.value)}
                  className="w-full rounded-md border border-bordure bg-surface-2 px-3 py-2 font-mono"
                />
                <span className="block text-sm text-doux">
                  Deux équipes qui utilisent la même graine et prennent les mêmes décisions
                  obtiennent exactement les mêmes résultats. Pratique pour comparer des stratégies
                  en classe!
                </span>
              </label>
              {erreurs.length > 0 && (
                <div
                  role="alert"
                  className="rounded-lg border border-danger bg-danger-doux p-3 text-sm"
                >
                  <p className="font-bold text-danger">Impossible d’ouvrir l’entreprise :</p>
                  <ul className="list-disc pl-5">
                    {erreurs.map((e) => (
                      <li key={e}>{MESSAGES_ERREUR[e]}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Carte>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          <Bouton onClick={precedent} raccourci="Échap">
            {etape === 0 ? 'Retour à l’accueil' : 'Étape précédente'}
          </Bouton>
          <Bouton
            type="submit"
            variante="primaire"
            raccourci="Entrée"
            disabled={etape === ETAPES.length - 1 && erreurs.length > 0}
          >
            {etape === ETAPES.length - 1
              ? `Ouvrir ${params.nomEntreprise || 'mon entreprise'}!`
              : 'Étape suivante'}
          </Bouton>
        </div>
      </form>
    </main>
  );
}
