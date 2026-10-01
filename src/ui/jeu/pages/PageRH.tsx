import { useState } from 'react';
import { posteParId } from '../../../data';
import { COUT_RECRUTEMENT, semainesPreavis } from '../../../engine/hr';
import { coutAnnuelEmploye, salaireMensuel, TAUX_VACANCES } from '../../../engine/payroll';
import { BORNES_DECISIONS, salaireMarche } from '../../../engine/simulation';
import type { Employe } from '../../../engine/types';
import { SEMAINES_PAR_MOIS } from '../../../engine/util';
import { argent, argentRond, nombre, pourcentage } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Bouton } from '../../composants/Bouton';
import { Astuce, Carte } from '../../composants/Carte';
import { Curseur } from '../../composants/Curseur';
import { Terme } from '../../composants/Terme';
import { TitrePage } from '../../composants/TitrePage';
import { useJeuCourant } from '../contexte';

function BarreMoral({ moral }: { moral: number }) {
  const couleur = moral < 45 ? 'bg-danger' : moral < 60 ? 'bg-alerte' : 'bg-succes';
  const libelle = moral < 45 ? 'bas' : moral < 60 ? 'moyen' : 'bon';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-20 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className={`h-full ${couleur}`} style={{ width: `${moral}%` }} />
      </div>
      <span className="chiffres text-sm">
        {nombre(moral)} <span className="text-doux">({libelle})</span>
      </span>
    </div>
  );
}

function LigneEmploye({ e, salaire }: { e: Employe; salaire: number }) {
  const changerHeures = useJeu((s) => s.changerHeuresEmploye);
  const congedier = useJeu((s) => s.congedierEmploye);
  const brut = salaireMensuel(salaire, e.heuresSemaine) * (1 + TAUX_VACANCES);
  const preavis = semainesPreavis(e.moisAnciennete);
  const indemnite = preavis * e.heuresSemaine * salaire;
  const nom = `${e.prenom} ${e.nom}`;
  return (
    <tr className="border-b border-bordure">
      <td className="py-2 pr-2 font-semibold">{nom}</td>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-1">
          <Bouton
            petit
            aria-label={`Réduire les heures de ${nom}`}
            onClick={() => changerHeures(e.id, e.heuresSemaine - 2)}
          >
            −
          </Bouton>
          <span className="chiffres w-12 text-center">{e.heuresSemaine} h</span>
          <Bouton
            petit
            aria-label={`Augmenter les heures de ${nom}`}
            onClick={() => changerHeures(e.id, e.heuresSemaine + 2)}
          >
            +
          </Bouton>
        </div>
      </td>
      <td className="py-2 pr-2">
        <BarreMoral moral={e.moral} />
      </td>
      <td className="chiffres py-2 pr-2">{Math.round(e.competence * 100)}/100</td>
      <td className="chiffres py-2 pr-2">{e.moisAnciennete} mois</td>
      <td className="chiffres py-2 pr-2 text-right">{argentRond(brut)}</td>
      <td className="py-2 text-right">
        <Bouton
          petit
          variante="danger"
          onClick={() => {
            const texte =
              preavis > 0
                ? `Mettre fin à l’emploi de ${nom}? Sans préavis écrit, tu dois verser une indemnité de ${preavis} semaine${preavis > 1 ? 's' : ''} de salaire (environ ${argentRond(indemnite)}).`
                : `Mettre fin à l’emploi de ${nom}? Moins de 3 mois de service : aucun préavis n’est exigé.`;
            if (window.confirm(texte)) congedier(e.id);
          }}
        >
          Mettre fin à l’emploi
        </Bouton>
      </td>
    </tr>
  );
}

export function PageRH() {
  const { etat, ent, secteur, ville, derniere } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const embaucher = useJeu((s) => s.embaucherEmploye);
  const [heuresNouvel, setHeuresNouvel] = useState(28);
  const d = ent.decisions;
  const poste = posteParId(secteur.postes[0]);
  const marche = salaireMarche(etat);
  const cout = coutAnnuelEmploye(d.salaireHoraire, 28, secteur.tauxCnesst);
  const heuresEmployes = ent.employes.reduce((a, x) => a + x.heuresSemaine, 0);
  const capacite = Math.round(
    (heuresEmployes + d.heuresProprietaire) *
      SEMAINES_PAR_MOIS *
      secteur.transactionsParHeureEmploye,
  );
  const masse =
    ent.employes.reduce((a, x) => a + salaireMensuel(d.salaireHoraire, x.heuresSemaine), 0) *
    (1 + TAUX_VACANCES);

  return (
    <div className="space-y-5">
      <TitrePage titre="Ressources humaines" touche="R">
        Ton équipe détermine combien de clients tu peux servir et la qualité du service. Un salaire
        juste et une charge de travail raisonnable gardent le moral élevé.
      </TitrePage>

      <Carte
        titre={`Ton équipe (${ent.employes.length} ${poste.nom.toLowerCase()}${ent.employes.length > 1 ? 's' : ''})`}
        sousTitre={`${nombre(heuresEmployes)} h/semaine d’employés + ${d.heuresProprietaire} h de ta part · masse salariale ≈ ${argentRond(masse)}/mois`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              Heures/semaine
              <input
                type="number"
                min={BORNES_DECISIONS.heuresEmploye.min}
                max={BORNES_DECISIONS.heuresEmploye.max}
                value={heuresNouvel}
                onChange={(e) => setHeuresNouvel(Number(e.target.value))}
                className="chiffres w-16 rounded-md border border-bordure bg-surface-2 px-2 py-1"
              />
            </label>
            <Bouton variante="primaire" petit onClick={() => embaucher(heuresNouvel)}>
              Embaucher un {poste.nom.toLowerCase()} ({argentRond(COUT_RECRUTEMENT)})
            </Bouton>
          </div>
        }
      >
        {ent.employes.length === 0 ? (
          <p className="text-sm text-doux">
            Aucun employé : tu travailles seul. Ta capacité est limitée à tes propres heures.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-bordure text-doux">
                  <th className="py-1 pr-2 font-semibold">Employé</th>
                  <th className="py-1 pr-2 font-semibold">Heures/sem.</th>
                  <th className="py-1 pr-2 font-semibold">
                    <Terme id="moral">Moral</Terme>
                  </th>
                  <th className="py-1 pr-2 font-semibold">Compétence</th>
                  <th className="py-1 pr-2 font-semibold">Ancienneté</th>
                  <th className="py-1 pr-2 text-right font-semibold">Brut/mois</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {ent.employes.map((e) => (
                  <LigneEmploye key={e.id} e={e} salaire={d.salaireHoraire} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm">
          <Terme id="capacite">Capacité</Terme> estimée :{' '}
          <strong className="chiffres">{nombre(capacite)}</strong> clients par mois
          {derniere && (
            <>
              {' '}
              · demande du dernier mois :{' '}
              <strong className="chiffres">{nombre(derniere.indicateurs.demande)}</strong> (
              <Terme id="utilisation">utilisation</Terme>{' '}
              {pourcentage(derniere.indicateurs.utilisation, 0)})
            </>
          )}
        </p>
      </Carte>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Rémunération et horaire">
          <div className="space-y-5">
            <Curseur
              libelle={`Salaire horaire des ${poste.nom.toLowerCase()}s`}
              valeur={d.salaireHoraire}
              min={etat.salaireMinimum}
              max={30}
              base="valeur"
              decimales={2}
              format={argent}
              terme="salaireMinimum"
              onChange={(v) => changer({ salaireHoraire: v })}
              aide={`Salaire minimum : ${argent(etat.salaireMinimum)} · médiane du marché à ${ville.nom} : environ ${argent(marche)}.`}
            />
            <Curseur
              libelle="Tes heures de travail par semaine"
              valeur={d.heuresProprietaire}
              min={0}
              max={80}
              decimales={0}
              format={(v) => `${v} h`}
              onChange={(v) => changer({ heuresProprietaire: v })}
              aide="En entreprise individuelle, tu n’as pas de salaire : tu te paies par tes prélèvements (Finance)."
            />
          </div>
        </Carte>
        <Carte
          titre={<Terme id="vraiCoutEmploye">Le vrai coût d’un employé</Terme>}
          sousTitre={`À ${argent(d.salaireHoraire)}/h, 28 h par semaine, pendant un an`}
        >
          <table className="chiffres w-full text-sm">
            <tbody>
              {[
                ['Salaire brut', cout.salaireAnnuel],
                ['Indemnité de vacances (4 %)', cout.vacances],
                ['RRQ (part de l’employeur)', cout.cotisations.rrq],
                ['RQAP (part de l’employeur)', cout.cotisations.rqap],
                ['Assurance-emploi (1,4 × l’employé)', cout.cotisations.assuranceEmploi],
                ['Fonds des services de santé (FSS)', cout.cotisations.fss],
                ['CNESST (accidents du travail)', cout.cotisations.cnesst],
                ['Normes du travail (CNT)', cout.cotisations.cnt],
              ].map(([nom, montant]) => (
                <tr key={nom as string} className="border-b border-bordure">
                  <td className="py-1">{nom}</td>
                  <td className="py-1 text-right">{argent(montant as number)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-1">Coût total pour l’employeur</td>
                <td className="py-1 text-right">{argent(cout.coutTotal)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-sm">
            Soit <strong>{argent(cout.coutHoraireReel)}</strong> l’heure,{' '}
            {pourcentage(cout.facteur - 1)} de plus que le salaire affiché.
          </p>
        </Carte>
      </div>

      <Astuce titre="Loi sur les normes du travail">
        Le salaire minimum est révisé chaque 1er mai. Les employés reçoivent une indemnité de
        vacances de 4 % (6 % après 3 ans). Pour mettre fin à un emploi après 3 mois de service, il
        faut un <Terme id="preavis">préavis écrit</Terme> ou une indemnité équivalente. Les heures
        au-delà de 40 h par semaine sont des heures supplémentaires payées à 150 % (le jeu en tient
        compte). Le recrutement détaillé (candidats, entrevues) arrive au Jalon 3.
      </Astuce>
    </div>
  );
}
