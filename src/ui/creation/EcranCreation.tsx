/**
 * Création de l'entreprise : identité, emplacement, équipement, financement et
 * paramètres de la partie. Chaque étape explique les notions de gestion en jeu.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SECTEURS, VILLES, secteurParId, villeParId } from '../../data';
import { graineDepuisTexte } from '../../engine/rng';
import {
  DEMARCHES,
  IDS_DEMARCHES,
  coutDemarche,
  fraisImmatriculation,
} from '../../engine/conformite';
import type { FormeJuridique } from '../../engine/types';
import { EtapeFinancement } from './EtapeFinancement';
import { FORMES } from './formes';
import {
  REGLES_FINANCEMENT,
  coutsDemarrage,
  loyerMensuelInitial,
  validerDemarrage,
  type ErreurDemarrage,
} from '../../engine/simulation';
import {
  DUREES_PARTIE,
  type Difficulte,
  type DureePartie,
  type ParametresDemarrage,
} from '../../engine/types';
import { argentRond, pourcentage } from '../../i18n/format';
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
  'Forme juridique',
  'Démarches de démarrage',
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
  associeRequis: 'Une société de personnes exige un associé qui investit dans l’entreprise.',
  sourceInvalide:
    'Une de tes sources de financement ne respecte pas ses conditions (étape 6 : âge, plan d’affaires, mise de fonds ou forme juridique).',
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
    formeJuridique: 'individuelle',
    nomAssocie: '',
    apportAssocie: 0,
    demarches: [...IDS_DEMARCHES],
    inscritTaxes: true,
    typeTauxPret: 'fixe',
    ageProprietaire: 20,
    financements: {},
    planAffaires: null,
    methodeInventaire: 'coutMoyen',
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
              <label className="space-y-1">
                <span className="block font-semibold">Ton âge</span>
                <input
                  type="number"
                  min={18}
                  max={75}
                  value={params.ageProprietaire}
                  onChange={(e) =>
                    maj({ ageProprietaire: Math.round(Number(e.target.value) || 18) })
                  }
                  className="chiffres w-28 rounded-md border border-bordure bg-surface-2 px-3 py-2"
                />
                <span className="block text-sm text-doux">
                  Certains programmes (Futurpreneur, Créavenir) sont réservés aux 18 à 39 ans.
                </span>
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
              <Astuce titre="Le nom de ton entreprise">
                Si ton entreprise porte un autre nom que le tien (ex. «{' '}
                {params.nomEntreprise || 'Café du Coin'} »), tu dois l’immatriculer au Registraire
                des entreprises du Québec (REQ) et obtenir un NEQ. Tu choisiras la forme juridique (
                <Terme id="entrepriseIndividuelle">entreprise individuelle</Terme>, société de
                personnes ou société par actions) à l’étape 4.
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
          <Carte>
            <div className="space-y-5">
              <ChoixCartes
                legende="Forme juridique de ton entreprise"
                nom="forme"
                valeur={params.formeJuridique}
                onChange={(id) => maj({ formeJuridique: id as FormeJuridique })}
                options={FORMES.map((f) => ({
                  id: f.id,
                  titre: f.nom,
                  description: f.resume,
                  detail: `Constitution ou immatriculation : ${argentRond(fraisImmatriculation(f.id))}`,
                }))}
              />
              {(params.formeJuridique === 'senc' || params.formeJuridique === 'sec') && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block font-semibold">
                      {params.formeJuridique === 'sec'
                        ? 'Nom du commanditaire (investisseur)'
                        : 'Nom de ton associé'}
                    </span>
                    <input
                      type="text"
                      maxLength={40}
                      value={params.nomAssocie}
                      placeholder="Ex. Sam Roy"
                      onChange={(e) => maj({ nomAssocie: e.target.value })}
                      className="w-full rounded-md border border-bordure bg-surface-2 px-3 py-2"
                    />
                  </label>
                  <Curseur
                    libelle="Mise de fonds de l’associé"
                    valeur={params.apportAssocie}
                    min={0}
                    max={100_000}
                    format={argentRond}
                    onChange={(v) => maj({ apportAssocie: v })}
                    aide="Sa part des bénéfices est proportionnelle à sa mise de fonds. Ses prélèvements suivent les tiens."
                  />
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <caption className="mb-2 text-left font-bold">
                    Comparatif des formes juridiques
                  </caption>
                  <thead>
                    <tr className="border-b border-bordure text-doux">
                      <th className="py-1 pr-2 font-semibold">Forme</th>
                      <th className="py-1 pr-2 font-semibold">Responsabilité</th>
                      <th className="py-1 pr-2 font-semibold">Imposition</th>
                      <th className="py-1 pr-2 font-semibold">Ta rémunération</th>
                      <th className="py-1 font-semibold">Formalités et coûts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FORMES.map((f) => (
                      <tr
                        key={f.id}
                        className={`border-b border-bordure/60 align-top ${f.id === params.formeJuridique ? 'bg-accent-doux' : ''}`}
                      >
                        <td className="py-1 pr-2 font-semibold">{f.nom}</td>
                        <td className="py-1 pr-2">{f.responsabilite}</td>
                        <td className="py-1 pr-2">{f.imposition}</td>
                        <td className="py-1 pr-2">{f.remuneration}</td>
                        <td className="py-1">{f.formalites}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Astuce>
                Tu pourras t’incorporer plus tard (département Juridique) : c’est souvent avantageux
                quand les bénéfices dépassent tes besoins personnels. La coopérative (au moins 3
                membres, un membre = un vote) et l’organisme à but non lucratif (OBNL, bénéfices
                réinvestis dans la mission) existent aussi, mais ne sont pas jouables pour un café à
                but lucratif.
              </Astuce>
            </div>
          </Carte>
        )}

        {etape === 4 && (
          <Carte>
            <div className="space-y-5">
              <fieldset className="rounded-lg border border-bordure p-3">
                <legend className="px-1 font-bold">TPS et TVQ</legend>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={params.inscritTaxes}
                    onChange={(e) => maj({ inscritTaxes: e.target.checked })}
                  />
                  <span>
                    Inscrire l’entreprise aux fichiers de la TPS et de la TVQ dès l’ouverture
                    <span className="block text-sm text-doux">
                      Facultatif sous le seuil du petit fournisseur (30 000 $ de ventes taxables sur
                      4 trimestres), mais obligatoire au-delà. Inscrit : tu ajoutes 14,975 % à tes
                      prix et tu récupères les taxes payées sur tes achats (CTI et RTI). Non inscrit
                      : tes prix paraissent moins chers, mais tu ne récupères rien… et un café
                      dépasse le seuil en quelques mois.
                    </span>
                  </span>
                </label>
              </fieldset>
              <fieldset>
                <legend className="mb-2 font-bold">Démarches avant l’ouverture</legend>
                <ul className="space-y-2">
                  {DEMARCHES.map((d) => {
                    const forcee = d.id === 'req' && params.formeJuridique !== 'individuelle';
                    const coche = forcee || params.demarches.includes(d.id);
                    const cout = coutDemarche(d.id, params.formeJuridique);
                    return (
                      <li key={d.id} className="rounded-lg border border-bordure p-3">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={coche}
                            disabled={forcee}
                            onChange={(e) =>
                              maj({
                                demarches: e.target.checked
                                  ? [...params.demarches, d.id]
                                  : params.demarches.filter((x) => x !== d.id),
                              })
                            }
                          />
                          <span>
                            <span className="font-semibold">{d.nom}</span>{' '}
                            <span className="chiffres text-sm text-doux">
                              ({cout > 0 ? argentRond(cout) : 'sans frais'} ·{' '}
                              {d.obligation === 'facultative' ? 'facultative' : 'obligatoire'})
                            </span>
                            <span className="block text-sm text-doux">{d.description}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
              <Astuce titre="Et si j’oublie une démarche?">
                Rien ne t’empêche d’ouvrir… mais chaque mois, l’organisme concerné peut le découvrir
                : amende, parfois fermeture temporaire, puis régularisation forcée. Tu pourras aussi
                régulariser plus tard dans le département Juridique.
              </Astuce>
            </div>
          </Carte>
        )}

        {etape === 5 && (
          <EtapeFinancement
            params={params}
            maj={maj}
            secteur={secteur}
            ville={ville}
            couts={couts}
          />
        )}

        {etape === 6 && (
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
