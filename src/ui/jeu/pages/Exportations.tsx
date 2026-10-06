/** Exportations : ouvrir ou fermer des marchés hors Québec et suivre leurs résultats. */
import {
  MARCHES_EXPORT,
  MOIS_DEMARRAGE_EXPORT,
  facteurChange,
  fermerMarcheExport,
  ouvrirMarcheExport,
  peutExporter,
} from '../../../engine/simulation';
import { argentRond, decimal, pourcentage } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Bouton } from '../../composants/Bouton';
import { Astuce, Carte } from '../../composants/Carte';
import { useJeuCourant } from '../contexte';

export function CarteExportations() {
  const { etat, ent, secteur } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  if (!peutExporter(secteur.id))
    return (
      <Carte titre="Exportations">
        <p className="text-sm text-doux">
          Ton secteur vend un service rendu sur place : il ne s’exporte pas. L’exportation est
          offerte aux boutiques de vêtements, aux boutiques en ligne, aux ateliers et aux épiceries
          fines.
        </p>
      </Carte>
    );
  const ouverts = ent.exportations?.marches ?? [];
  const dernier = ent.exportations?.dernier;
  const taux = etat.conjoncture.tauxChange;
  return (
    <Carte
      titre="Exportations"
      sousTitre={`1 $ CA = ${decimal(taux, 3)} $ US${dernier ? ` · dernier mois : ${argentRond(dernier.ventes)} de ventes, ${argentRond(dernier.couts)} de coûts` : ''}`}
    >
      <ul className="space-y-2 text-sm">
        {MARCHES_EXPORT.map((m) => {
          const ouvert = ouverts.find((x) => x.id === m.id);
          const change = facteurChange(m.devise, taux);
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bordure p-2"
            >
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{m.nom}</span>
                <span className="block text-doux">{m.description}</span>
                <span className="block">
                  Ouverture : {argentRond(m.coutOuverture)} · représentation :{' '}
                  {argentRond(m.fraisMensuels)}/mois · transport et courtage :{' '}
                  {pourcentage(m.transport + m.courtage, 0)} des ventes
                  {m.devise !== 'CAD' &&
                    ` · effet du taux de change sur la demande : ×${decimal(change, 2)}`}
                </span>
              </span>
              {ouvert ? (
                <Bouton
                  petit
                  variante="danger"
                  onClick={() => {
                    if (window.confirm(`Cesser d’exporter vers ${m.nom}?`))
                      agir((e, id) => fermerMarcheExport(e, id, m.id));
                  }}
                >
                  Fermer ce marché
                </Bouton>
              ) : (
                <Bouton petit onClick={() => agir((e, id) => ouvrirMarcheExport(e, id, m.id))}>
                  Ouvrir ({argentRond(m.coutOuverture)})
                </Bouton>
              )}
            </li>
          );
        })}
      </ul>
      <Astuce titre="Exporter, est-ce payant?">
        Les ventes à l’étranger montent pendant {MOIS_DEMARRAGE_EXPORT} mois. Elles dépendent de ta
        qualité, de tes prix et du taux de change : quand le dollar canadien baisse, tes produits
        coûtent moins cher pour un client américain ou européen. Les exportations hors Canada sont
        détaxées (TPS et TVQ à 0 %), mais le transport, le courtier en douane et la représentation
        grugent la marge.
      </Astuce>
    </Carte>
  );
}
