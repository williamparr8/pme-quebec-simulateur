import { indicePrixOffre } from '../../engine/market';
import { bilanPartie } from '../../engine/rapports';
import { qualiteDe } from '../../engine/simulation';
import { argent, argentRond, decimal, moisAnnee, nombre, pourcentage } from '../../i18n/format';
import { ONGLETS, useJeu } from '../../store/jeu';
import { Bouton } from '../composants/Bouton';
import { GestionSauvegardes } from '../composants/GestionSauvegardes';
import { ListeMessages } from '../composants/ListeMessages';
import { Modale } from '../composants/Modale';
import { useJeuCourant } from './contexte';

function ConfirmerMois() {
  const { etat, ent, secteur, date } = useJeuCourant();
  const fermer = useJeu((s) => s.fermerModale);
  const terminerMois = useJeu((s) => s.terminerMois);
  const annoncer = useJeu((s) => s.annoncer);
  const d = ent.decisions;
  const heuresPersonnel =
    ent.employes.reduce((a, x) => a + x.heuresSemaine, 0) + d.heuresProprietaire;
  const avertissements: string[] = [];
  if (heuresPersonnel < d.heuresOuverture)
    avertissements.push('Ton personnel ne couvre pas toutes les heures d’ouverture.');
  if (ent.livre.soldes.encaisse / 100 < 5000)
    avertissements.push('Ton encaisse est basse : vérifie que tu peux payer le loyer et la paie.');
  if (d.stockJoursCible < 3)
    avertissements.push('Ton stock cible est très bas : risque de ruptures.');

  const confirmer = () => {
    terminerMois();
    annoncer(
      `Mois de ${moisAnnee(date.annee, date.mois)} terminé. Le rapport mensuel est affiché.`,
    );
  };

  return (
    <Modale
      titre={`Terminer le mois de ${moisAnnee(date.annee, date.mois)}?`}
      onFermer={fermer}
      pied={
        <>
          <Bouton onClick={fermer} raccourci="Échap">
            Revoir mes décisions
          </Bouton>
          <Bouton variante="primaire" onClick={confirmer} data-focus-initial raccourci="Entrée">
            Terminer le mois
          </Bouton>
        </>
      }
    >
      <p className="mb-3 text-sm text-doux">
        Résumé de tes décisions pour le mois {etat.moisCourant + 1} :
      </p>
      <dl className="chiffres grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-doux">Indice de prix</dt>
        <dd className="text-right">
          {decimal(indicePrixOffre(d.prix, secteur, etat.conjoncture.indicePrix))}
        </dd>
        <dt className="text-doux">Qualité</dt>
        <dd className="text-right">{qualiteDe(secteur, d.qualiteId).nom}</dd>
        <dt className="text-doux">Publicité</dt>
        <dd className="text-right">{argentRond(d.budgetPublicite)}</dd>
        <dt className="text-doux">Employés</dt>
        <dd className="text-right">
          {ent.employes.length} à {argent(d.salaireHoraire)}/h
        </dd>
        <dt className="text-doux">Heures d’ouverture</dt>
        <dd className="text-right">{d.heuresOuverture} h/semaine</dd>
        <dt className="text-doux">Prélèvements</dt>
        <dd className="text-right">{argentRond(d.prelevements)}</dd>
      </dl>
      {avertissements.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg border-l-4 border-alerte bg-alerte-doux p-3 text-sm">
          {avertissements.map((a) => (
            <li key={a}>
              <span aria-hidden="true">⚠️ </span>
              {a}
            </li>
          ))}
        </ul>
      )}
    </Modale>
  );
}

function Rapport() {
  const { etat, derniere, precedente } = useJeuCourant();
  const fermer = useJeu((s) => s.fermerModale);
  const ouvrirModale = useJeu((s) => s.ouvrirModale);
  if (!derniere) return null;
  const i = derniere.indicateurs;
  const p = precedente?.indicateurs;
  const continuer = () => (etat.terminee ? ouvrirModale('fin') : fermer());
  const chiffres: [string, string, string | null][] = [
    ['Ventes', argentRond(i.chiffreAffaires), p ? argentRond(p.chiffreAffaires) : null],
    ['Bénéfice net', argentRond(i.beneficeNet), p ? argentRond(p.beneficeNet) : null],
    ['Encaisse en fin de mois', argentRond(i.encaisse), p ? argentRond(p.encaisse) : null],
    ['Clients servis', nombre(i.servies), p ? nombre(p.servies) : null],
    [
      'Clients perdus',
      nombre(i.perduesCapacite + i.perduesRupture),
      p ? nombre(p.perduesCapacite + p.perduesRupture) : null,
    ],
    ['Part de marché', pourcentage(i.partMarche), p ? pourcentage(p.partMarche) : null],
    ['Marge brute', pourcentage(i.tauxMargeBrute), p ? pourcentage(p.tauxMargeBrute) : null],
  ];
  return (
    <Modale
      titre={`Rapport de ${moisAnnee(derniere.annee, derniere.mois)}`}
      onFermer={continuer}
      taille="lg"
      pied={
        <Bouton variante="primaire" onClick={continuer} data-focus-initial raccourci="Entrée">
          {etat.terminee ? 'Voir le bilan de la partie' : 'Continuer'}
        </Bouton>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
        <table className="chiffres h-fit w-full text-sm">
          <thead>
            <tr className="border-b border-bordure text-left text-doux">
              <th className="py-1 font-semibold">Indicateur</th>
              <th className="py-1 text-right font-semibold">Ce mois</th>
              {p && <th className="py-1 text-right font-semibold">Mois précédent</th>}
            </tr>
          </thead>
          <tbody>
            {chiffres.map(([nom, val, avant]) => (
              <tr key={nom} className="border-b border-bordure/60">
                <td className="py-1">{nom}</td>
                <td className="py-1 text-right font-semibold">{val}</td>
                {p && <td className="py-1 text-right text-doux">{avant}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <h3 className="mb-2 font-bold">Ce qui s’est passé et pourquoi</h3>
          <ListeMessages messages={derniere.messages} />
        </div>
      </div>
    </Modale>
  );
}

function Aide() {
  const fermer = useJeu((s) => s.fermerModale);
  const raccourcis: [string, string][] = [
    ...ONGLETS.map((o): [string, string] => [o.touche, o.nom]),
    ['Espace', 'Terminer le mois (quand aucun bouton n’a le focus)'],
    ['?', 'Afficher cette aide'],
    ['I', 'Définition du terme ou de l’indicateur sélectionné'],
    ['Échap', 'Fermer une fenêtre ou revenir au tableau de bord'],
    ['Tab / Maj + Tab', 'Passer à l’élément suivant / précédent'],
    ['← →', 'Changer de département (dans la barre d’onglets) ou ajuster un curseur de 1 %'],
    ['Maj + ← →', 'Ajuster un curseur de 10 %'],
    ['Début / Fin', 'Curseur au minimum / au maximum'],
    ['Entrée', 'Valider'],
  ];
  return (
    <Modale
      titre="Aide et raccourcis clavier"
      onFermer={fermer}
      taille="lg"
      pied={
        <Bouton variante="primaire" onClick={fermer}>
          Fermer
        </Bouton>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <table className="w-full text-sm">
          <caption className="mb-2 text-left font-bold">Raccourcis</caption>
          <tbody>
            {raccourcis.map(([touche, action]) => (
              <tr key={touche} className="border-b border-bordure/60">
                <td className="py-1 pr-3">
                  <kbd className="rounded border border-bordure bg-surface-2 px-1.5 py-0.5 font-semibold">
                    {touche}
                  </kbd>
                </td>
                <td className="py-1">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-2 text-sm">
          <h3 className="font-bold">Comment jouer</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Lis le rapport du mois et les alertes du tableau de bord.</li>
            <li>
              Ajuste tes décisions dans chaque département : prix et publicité (M), équipe (R),
              heures et stock (O), prélèvements et financement (F).
            </li>
            <li>Termine le mois. Le jeu simule le marché, tes ventes, ta paie et ta trésorerie.</li>
            <li>
              Analyse tes états financiers (F) : le bénéfice et l’encaisse ne racontent pas la même
              histoire!
            </li>
          </ol>
          <p>
            Ta partie est sauvegardée automatiquement à la fin de chaque mois. Tu peux aussi
            l’enregistrer dans un des 3 emplacements ou l’exporter en fichier pour la remettre à ton
            enseignant.
          </p>
        </div>
      </div>
    </Modale>
  );
}

function Sauvegardes() {
  const fermer = useJeu((s) => s.fermerModale);
  return (
    <Modale
      titre="Sauvegardes"
      onFermer={fermer}
      taille="lg"
      pied={<Bouton onClick={fermer}>Fermer</Bouton>}
    >
      <GestionSauvegardes enJeu />
    </Modale>
  );
}

function Fin() {
  const { etat, ent } = useJeuCourant();
  const fermer = useJeu((s) => s.fermerModale);
  const quitter = useJeu((s) => s.quitter);
  const b = bilanPartie(ent);
  const lignes: [string, string][] = [
    ['Ventes cumulées', argentRond(b.ventesCumulees)],
    ['Bénéfice net cumulé', argentRond(b.beneficeCumule)],
    ['Prélèvements (ta rémunération)', argentRond(b.prelevementsCumules)],
    ['Apports du propriétaire', argentRond(b.apportsTotal)],
    ['Capitaux propres à la fin', argentRond(b.capitauxPropres)],
    [
      'Valeur estimée de l’entreprise (3 × BAIIA + encaisse − dettes)',
      argentRond(b.valeurEntreprise),
    ],
    ['Part de marché finale', pourcentage(b.partMarcheFinale)],
    ['Note en ligne finale', `${decimal(b.noteFinale, 1)} ★`],
    ['Satisfaction moyenne des clients', pourcentage(b.satisfactionMoyenne, 0)],
    ['Moral moyen de l’équipe', `${nombre(b.moralMoyen)}/100`],
  ];
  return (
    <Modale
      titre={etat.raisonFin === 'faillite' ? 'Fin de la partie : faillite' : 'Fin de la partie'}
      onFermer={fermer}
      taille="lg"
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
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="rounded-2xl bg-accent px-5 py-3 text-center text-accent-texte">
            <p className="text-sm font-semibold">Note globale</p>
            <p className="chiffres text-4xl font-extrabold">{b.note}/100</p>
          </div>
          <p className="max-w-md text-sm">
            {etat.raisonFin === 'faillite'
              ? 'Ton entreprise n’a pas survécu. En entreprise individuelle, tes biens personnels répondent des dettes. Relis tes rapports : quand la trésorerie a-t-elle commencé à fondre, et pourquoi?'
              : `${ent.nom} a terminé ses ${etat.config.dureeMois} mois d’activité. La note tient compte de ton rendement financier (50 points), de la satisfaction de tes clients (25), du moral de ton équipe (10) et de ta part de marché (15).`}
          </p>
        </div>
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
        <p className="text-xs text-doux">
          Le rapport détaillé (meilleures et pires décisions, comparaison avec les concurrents,
          classement) arrive au Jalon 5.
        </p>
      </div>
    </Modale>
  );
}

export function Modales() {
  const modale = useJeu((s) => s.modale);
  switch (modale) {
    case 'confirmerMois':
      return <ConfirmerMois />;
    case 'rapport':
      return <Rapport />;
    case 'aide':
      return <Aide />;
    case 'sauvegardes':
      return <Sauvegardes />;
    case 'fin':
      return <Fin />;
    default:
      return null;
  }
}
