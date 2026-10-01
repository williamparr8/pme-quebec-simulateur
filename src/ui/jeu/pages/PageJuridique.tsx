import { tauxPreferentiel } from '../../../engine/economy';
import { argent, argentRond, pourcentage } from '../../../i18n/format';
import { Astuce, Carte } from '../../composants/Carte';
import { Terme } from '../../composants/Terme';
import { TitrePage } from '../../composants/TitrePage';
import { useJeuCourant } from '../contexte';

export function PageJuridique() {
  const { etat, ent } = useJeuCourant();
  const conj = etat.conjoncture;
  return (
    <div className="space-y-5">
      <TitrePage titre="Juridique et fiscalité" touche="J">
        Les règles qui encadrent ton entreprise. Ce département prendra toute son ampleur au Jalon 2
        (formes juridiques, TPS/TVQ, impôts, démarches de démarrage).
      </TitrePage>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Forme juridique : entreprise individuelle">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <strong>Responsabilité illimitée</strong> : tu réponds des dettes de l’entreprise sur
              tous tes biens personnels (auto, épargne, maison).
            </li>
            <li>
              <strong>Impôt</strong> : le bénéfice de l’entreprise s’ajoute à tes autres revenus
              dans ta déclaration personnelle (T1 fédérale et TP-1 au Québec). L’entreprise ne paie
              pas d’impôt elle-même.
            </li>
            <li>
              <strong>Immatriculation</strong> : obligatoire au Registraire des entreprises du
              Québec (REQ) si l’entreprise porte un autre nom que le tien. Tu obtiens alors un NEQ
              (numéro d’entreprise du Québec).
            </li>
            <li>
              <strong>Ta rémunération</strong> : pas de salaire, mais des{' '}
              <Terme id="prelevements">prélèvements</Terme>, qui ne sont pas une dépense de
              l’entreprise.
            </li>
          </ul>
        </Carte>

        <Carte titre="Bail commercial">
          <dl className="chiffres grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
            <dt className="text-doux">Loyer mensuel actuel</dt>
            <dd className="text-right font-semibold">{argent(ent.bail.loyerMensuel / 100)}</dd>
            <dt className="text-doux">Durée du bail</dt>
            <dd className="text-right">{ent.bail.dureeMois / 12} ans</dd>
            <dt className="text-doux">Indexation annuelle</dt>
            <dd className="text-right">{pourcentage(ent.bail.indexation)}</dd>
            <dt className="text-doux">Dépôt de garantie</dt>
            <dd className="text-right">{argentRond(ent.livre.soldes.depotGarantie / 100)}</dd>
          </dl>
          <p className="mt-2 text-sm text-doux">
            Au Québec, un bail commercial n’est pas encadré comme un bail résidentiel : la hausse au
            renouvellement se négocie librement. Lis bien les clauses d’indexation et de
            renouvellement!
          </p>
        </Carte>

        <Carte titre="Taux en vigueur">
          <dl className="chiffres grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
            <dt className="text-doux">Salaire minimum</dt>
            <dd className="text-right font-semibold">{argent(etat.salaireMinimum)}/h</dd>
            <dt className="text-doux">
              <Terme id="tauxDirecteur">Taux directeur</Terme> (Banque du Canada)
            </dt>
            <dd className="text-right">{pourcentage(conj.tauxDirecteur, 2)}</dd>
            <dt className="text-doux">
              <Terme id="tauxPreferentiel">Taux préférentiel</Terme>
            </dt>
            <dd className="text-right">{pourcentage(tauxPreferentiel(conj), 2)}</dd>
            <dt className="text-doux">
              <Terme id="inflation">Inflation</Terme> annuelle
            </dt>
            <dd className="text-right">{pourcentage(conj.inflationAnnuelle)}</dd>
          </dl>
        </Carte>

        <Astuce titre="Au programme du Jalon 2">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Choix de la forme juridique (individuelle, SENC, SEC, inc. provinciale ou fédérale,
              coop, OBNL)
            </li>
            <li>TPS (5 %) et TVQ (9,975 %), CTI/RTI, seuil de petit fournisseur</li>
            <li>Impôt des particuliers et des sociétés, déduction pour petite entreprise</li>
            <li>Paie complète : retenues à la source, T4 et RL-1</li>
            <li>
              Checklist de démarrage : REQ, CNESST, MAPAQ, permis, assurances, Charte de la langue
              française
            </li>
          </ul>
        </Astuce>
      </div>
    </div>
  );
}
