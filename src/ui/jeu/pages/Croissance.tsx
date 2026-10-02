/** Croissance de l'entreprise : palier, progression vers le suivant et succursales. */
import {
  HONORAIRES_PALIER,
  RABAIS_VOLUME,
  SEUILS_PALIERS,
  nbEtablissements,
  palier,
  ventesDouzeMois,
  type Palier,
} from '../../../engine/simulation';
import { argentRond, nombre, pourcentage } from '../../../i18n/format';
import { NOMS_PALIERS } from '../../../i18n/messages-croissance';
import { Astuce, Carte } from '../../composants/Carte';
import { useJeuCourant } from '../contexte';
import { CarteSuccursales } from './Succursales';

function Progres({
  libelle,
  valeur,
  cible,
  texte,
}: {
  libelle: string;
  valeur: number;
  cible: number;
  texte: string;
}) {
  const pct = Math.round(Math.min(1, valeur / cible) * 100);
  return (
    <div className="grid grid-cols-[11rem_1fr_9rem] items-center gap-2 text-sm">
      <span>{libelle}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </span>
      <span className="chiffres text-right">{texte}</span>
    </div>
  );
}

const REGLES: Record<Palier, string> = {
  petite: 'Point de départ : aucun rabais de volume, pas d’examen des états financiers exigé.',
  pme: `Rabais de volume de ${pourcentage(RABAIS_VOLUME.pme, 0)} sur les achats, marge de crédit doublée, mission d’examen des états financiers (${argentRond(HONORAIRES_PALIER.pme)}/mois).`,
  grande: `Rabais de volume de ${pourcentage(RABAIS_VOLUME.grande, 0)}, marge de crédit doublée de nouveau, audit des états financiers (${argentRond(HONORAIRES_PALIER.grande)}/mois).`,
};

export function VueCroissance() {
  const { ent } = useJeuCourant();
  const p = palier(ent);
  const ventes = ventesDouzeMois(ent);
  const employes = ent.employes.length;
  const etablissements = nbEtablissements(ent);
  return (
    <div className="space-y-5">
      <Carte titre={`Palier actuel : ${NOMS_PALIERS[p]}`} sousTitre={REGLES[p]}>
        {p === 'petite' && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Pour devenir une PME (l’un ou l’autre) :</p>
            <Progres
              libelle="Ventes des 12 derniers mois"
              valeur={ventes}
              cible={SEUILS_PALIERS.pme.ventes}
              texte={`${argentRond(ventes)} / ${argentRond(SEUILS_PALIERS.pme.ventes)}`}
            />
            <Progres
              libelle="Employés"
              valeur={employes}
              cible={SEUILS_PALIERS.pme.employes}
              texte={`${nombre(employes)} / ${SEUILS_PALIERS.pme.employes}`}
            />
          </div>
        )}
        {p === 'pme' && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              Pour devenir une grande entreprise : ventes et établissements (ou{' '}
              {SEUILS_PALIERS.grande.employes} employés) :
            </p>
            <Progres
              libelle="Ventes des 12 derniers mois"
              valeur={ventes}
              cible={SEUILS_PALIERS.grande.ventes}
              texte={`${argentRond(ventes)} / ${argentRond(SEUILS_PALIERS.grande.ventes)}`}
            />
            <Progres
              libelle="Établissements"
              valeur={etablissements}
              cible={SEUILS_PALIERS.grande.etablissements}
              texte={`${etablissements} / ${SEUILS_PALIERS.grande.etablissements}`}
            />
            <Progres
              libelle="Employés"
              valeur={employes}
              cible={SEUILS_PALIERS.grande.employes}
              texte={`${nombre(employes)} / ${SEUILS_PALIERS.grande.employes}`}
            />
          </div>
        )}
        {p === 'grande' && (
          <p className="text-sm">
            Tu as atteint le sommet du jeu. Maintenant, il faut durer : une grande structure a de
            gros frais fixes.
          </p>
        )}
        <Astuce titre="Petite, moyenne ou grande?">
          Au Canada, on parle de petite entreprise jusqu’à 99 employés et de moyenne entreprise
          jusqu’à 499. Les seuils du jeu sont plus bas pour qu’un commerce puisse les atteindre en
          quelques années. En grandissant, une entreprise gagne du pouvoir de négociation, mais elle
          doit respecter plus d’obligations : équité salariale dès 10 employés, comité de santé et
          de sécurité dès 20, francisation dès 25 (voir Juridique, J).
        </Astuce>
      </Carte>
      <CarteSuccursales />
    </div>
  );
}
