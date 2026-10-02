/**
 * Rapport de fin de partie : note globale, performance par département, meilleures et
 * pires décisions, choix devant les événements, comparaison avec le marché et bilan.
 * Imprimable en PDF (window.print() avec la feuille de style d'impression).
 */
import { useEffect } from 'react';
import { rapportFinPartie, scenarioParId } from '../../engine/simulation';
import { argentRond, decimal, nombre, pourcentage } from '../../i18n/format';
import {
  DEPARTEMENTS_TEXTE,
  MENTIONS,
  OBJECTIFS_TEXTE,
  leconDecision,
  titreDecision,
  valeurObjectifTexte,
} from '../../i18n/messages-jalon5';
import { useJeu } from '../../store/jeu';
import { Bouton } from '../composants/Bouton';
import { Modale } from '../composants/Modale';
import { jouerSon } from '../sons';
import { useJeuCourant } from './contexte';
import type { DecisionMarquante } from '../../engine/bilan';

const STATUTS: Record<string, string> = {
  actif: 'En activité',
  faillite: 'Faillite',
  vendue: 'Vendue',
  rachete: 'Rachetée',
};

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 break-inside-avoid">
      <h3 className="text-lg font-bold">{titre}</h3>
      {children}
    </section>
  );
}

function ListeDecisions({ liste, vide }: { liste: DecisionMarquante[]; vide: string }) {
  if (liste.length === 0) return <p className="text-sm text-doux">{vide}</p>;
  return (
    <ul className="space-y-2">
      {liste.map((d) => (
        <li key={`${d.index}-${d.type}`} className="rounded-lg border border-bordure p-3 text-sm">
          <p className="flex flex-wrap justify-between gap-2 font-semibold">
            <span>
              Mois {d.index + 1} : {titreDecision(d)}
            </span>
            <span className={`chiffres ${d.effet >= 0 ? 'text-succes' : 'text-danger'}`}>
              {d.effet >= 0 ? '+' : ''}
              {argentRond(d.effet)} par mois
            </span>
          </p>
          <p className="mt-1">{leconDecision(d)}</p>
          <p className="mt-1 text-xs text-doux">
            Bénéfice mensuel moyen : {argentRond(d.avant)} avant, {argentRond(d.apres)} après (effet
            attendu de la saison et de la conjoncture : {argentRond(d.attendu)})
            {d.partage ? '. D’autres décisions prises le même mois partagent cet effet.' : '.'}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function RapportFin() {
  const { etat, ent } = useJeuCourant();
  const fermer = useJeu((s) => s.fermerModale);
  const quitter = useJeu((s) => s.quitter);
  const choisirEquipe = useJeu((s) => s.choisirEquipe);
  const r = rapportFinPartie(etat, ent);
  const b = r.bilan;
  const scenario = etat.config.scenarioId ? scenarioParId(etat.config.scenarioId) : null;
  const raison = ent.enFaillite ? 'faillite' : ent.vente ? 'vente' : 'duree';
  const reussi = r.note >= 60;
  useEffect(() => jouerSon(reussi ? 'reussite' : 'perte'), [reussi]);

  const lignes: [string, string][] = [
    ['Ventes cumulées', argentRond(b.ventesCumulees)],
    ['Bénéfice net cumulé', argentRond(b.beneficeCumule)],
    ['Prélèvements (ta rémunération)', argentRond(b.prelevementsCumules)],
    ['Apports du propriétaire', argentRond(b.apportsTotal)],
    ['Capitaux propres à la fin', argentRond(b.capitauxPropres)],
    b.vendue
      ? ['Prix de vente de l’entreprise', argentRond(b.valeurEntreprise)]
      : [
          'Valeur estimée de l’entreprise (3 × BAIIA + encaisse − dettes)',
          argentRond(b.valeurEntreprise),
        ],
    ...(b.partProprietaire < 1
      ? ([
          ['Ta part de l’entreprise', pourcentage(b.partProprietaire, 1)],
          ['Valeur de ta part', argentRond(b.valeurPourProprietaire)],
        ] as [string, string][])
      : []),
    ['Part de marché finale', pourcentage(b.partMarcheFinale)],
    ['Note en ligne finale', `${decimal(b.noteFinale, 1)} ★`],
    ['Satisfaction moyenne des clients', pourcentage(b.satisfactionMoyenne, 0)],
    ['Moral moyen de l’équipe', `${nombre(b.moralMoyen)}/100`],
  ];

  return (
    <Modale
      titre={
        raison === 'faillite'
          ? `Fin de la partie : faillite de ${ent.nom}`
          : raison === 'vente'
            ? `Fin de la partie : ${ent.nom} est vendue`
            : `Rapport de fin de partie : ${ent.nom}`
      }
      onFermer={fermer}
      taille="xl"
      pied={
        <>
          <Bouton onClick={() => window.print()}>Imprimer ou enregistrer en PDF</Bouton>
          <Bouton onClick={fermer}>Revoir mes états financiers</Bouton>
          <Bouton variante="primaire" onClick={quitter}>
            Retour à l’accueil
          </Bouton>
        </>
      }
    >
      <div className="rapport-imprimable space-y-6">
        <p className="hidden text-sm print:block">
          PME Québec : Le Simulateur d’affaires · {ent.nom}
          {ent.equipe ? ` (${ent.equipe})` : ''} · {etat.config.dureeMois} mois · graine{' '}
          {etat.config.graine}
        </p>

        {etat.entreprises.length > 1 && (
          <div className="pas-imprimer flex flex-wrap gap-2" role="group" aria-label="Équipe">
            {etat.entreprises.map((e, i) => (
              <Bouton
                key={e.id}
                petit
                variante={e.id === ent.id ? 'primaire' : 'secondaire'}
                aria-pressed={e.id === ent.id}
                onClick={() => choisirEquipe(i)}
              >
                {e.equipe ?? e.nom}
              </Bouton>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <div className="rounded-2xl bg-accent px-5 py-3 text-center text-accent-texte">
            <p className="text-sm font-semibold">
              {scenario ? 'Note du scénario' : 'Note globale'}
            </p>
            <p className="chiffres text-4xl font-extrabold">{r.note}/100</p>
            <p className="font-semibold">{MENTIONS[r.mention]}</p>
          </div>
          <p className="max-w-xl text-sm">
            {raison === 'faillite'
              ? 'Ton entreprise n’a pas survécu. En entreprise individuelle, tes biens personnels répondent des dettes. Relis tes pires décisions ci-dessous : quand la trésorerie a-t-elle commencé à fondre, et pourquoi?'
              : raison === 'vente' && ent.vente
                ? `Tu as vendu ${ent.nom} à ${ent.vente.acheteur} pour ${argentRond(ent.vente.prix)}. L’acheteur paie pour les profits futurs (un multiple du BAIIA) et pour les actifs.`
                : `${ent.nom} a terminé ses ${etat.config.dureeMois} mois d’activité. La note de gestion tient compte de ton rendement financier (50 points), de la satisfaction de tes clients (25), du moral de ton équipe (10) et de ta part de marché (15).`}
            {scenario &&
              ` Pour le scénario, les objectifs comptent pour 70 points et la note de gestion (${b.note}/100) pour 30.`}
          </p>
        </div>

        {scenario && r.scenario && (
          <Section titre={`Objectifs du scénario « ${scenario.nom} »`}>
            <ul className="space-y-1 text-sm">
              {r.scenario.objectifs.map((o) => (
                <li key={o.type} className="flex flex-wrap justify-between gap-2">
                  <span>
                    <span aria-hidden="true">{o.atteint ? '✓ ' : '✗ '}</span>
                    <span className="sr-only">{o.atteint ? 'Atteint : ' : 'Non atteint : '}</span>
                    {OBJECTIFS_TEXTE[o.type](o.cible)}
                  </span>
                  <span
                    className={`chiffres font-semibold ${o.atteint ? 'text-succes' : 'text-danger'}`}
                  >
                    {valeurObjectifTexte(o.type, o.valeur)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-doux">{scenario.lecon}</p>
          </Section>
        )}

        <Section titre="Performance par département">
          <ul className="space-y-2">
            {r.departements.map((d) => (
              <li key={d.id} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm">
                <span>{DEPARTEMENTS_TEXTE[d.id]}</span>
                <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${d.note}%` }}
                  />
                </span>
                <span className="chiffres text-right font-semibold">{d.note}/100</span>
              </li>
            ))}
          </ul>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section titre="Tes meilleures décisions">
            <ListeDecisions
              liste={r.meilleures}
              vide="Aucune décision marquante n’a eu d’effet positif mesurable."
            />
          </Section>
          <Section titre="Tes pires décisions">
            <ListeDecisions
              liste={r.pires}
              vide="Aucune décision marquante n’a eu d’effet négatif mesurable. Bravo!"
            />
          </Section>
        </div>
        <p className="text-xs text-doux">
          Méthode : on compare ton bénéfice mensuel moyen des 3 mois qui suivent une décision à
          celui des 3 mois qui la précèdent, en retirant l’effet attendu de la saison et de la
          conjoncture. C’est une estimation, comme en gestion réelle : d’autres facteurs
          (concurrents, événements) jouent aussi.
        </p>

        {r.evenements.length > 0 && (
          <Section titre="Tes choix devant les événements">
            <ul className="space-y-2 text-sm">
              {r.evenements.slice(0, 8).map((c) => (
                <li key={`${c.index}-${c.titre}`}>
                  <p>
                    <span className="font-semibold">
                      Mois {c.index + 1} : {c.titre}
                    </span>{' '}
                    → {c.choix}
                  </p>
                  <p className="text-doux">{c.explication}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section titre="Comparaison avec le marché">
          <div
            tabIndex={0}
            role="region"
            aria-label="Tableau (défilement horizontal possible)"
            className="overflow-x-auto"
          >
            <table className="chiffres w-full text-sm">
              <thead>
                <tr className="border-b border-bordure text-left">
                  <th className="py-1">Entreprise</th>
                  <th className="py-1 text-right">Part de marché</th>
                  <th className="py-1 text-right">Note</th>
                  <th className="py-1 text-right">Notoriété</th>
                  <th className="py-1 text-right">Statut</th>
                </tr>
              </thead>
              <tbody>
                {r.comparaison.map((l) => (
                  <tr
                    key={l.id}
                    className={`border-b border-bordure/60 ${l.type === 'joueur' ? 'font-bold' : ''}`}
                  >
                    <td className="py-1">
                      {l.nom}
                      {l.type === 'joueur' && ' (toi)'}
                    </td>
                    <td className="py-1 text-right">{pourcentage(l.part, 1)}</td>
                    <td className="py-1 text-right">{decimal(l.note, 1)} ★</td>
                    <td className="py-1 text-right">{pourcentage(l.notoriete, 0)}</td>
                    <td className="py-1 text-right">{STATUTS[l.statut]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section titre="Bilan financier de la partie">
          <table className="chiffres w-full text-sm">
            <tbody>
              {lignes.map(([nom, val]) => (
                <tr key={nom} className="border-b border-bordure/60">
                  <td className="py-1">{nom}</td>
                  <td className="py-1 text-right font-semibold">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.quiz.faits > 0 && (
            <p className="text-sm">
              Quiz : {r.quiz.bonnes} bonne{r.quiz.bonnes > 1 ? 's' : ''} réponse
              {r.quiz.bonnes > 1 ? 's' : ''} sur {r.quiz.total} ({r.quiz.faits} quiz).
            </p>
          )}
        </Section>
      </div>
    </Modale>
  );
}
