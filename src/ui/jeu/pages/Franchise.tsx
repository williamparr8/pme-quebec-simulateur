/** Franchise : situation du franchisé, ou gestion du réseau du franchiseur. */
import {
  PARAMETRES_RESEAU,
  lancerReseauFranchise,
  objectifFranchises,
  peutLancerReseau,
} from '../../../engine/simulation';
import { argentRond, decimal, pourcentage } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Bouton } from '../../composants/Bouton';
import { Astuce, Carte } from '../../composants/Carte';
import { useJeuCourant } from '../contexte';

export function CarteFranchise() {
  const { ent } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const p = PARAMETRES_RESEAU;

  if (ent.franchise)
    return (
      <Carte titre={`Franchisé de ${ent.franchise.banniere}`}>
        <p className="text-sm">
          Tu verses chaque mois {pourcentage(ent.franchise.redevance, 0)} de tes ventes en
          redevances et {pourcentage(ent.franchise.fondsPublicitaire, 0)} au fonds publicitaire. En
          échange, la bannière t’apporte sa notoriété, ses méthodes et des achats groupés (rabais de
          4 % sur tes marchandises).
        </p>
      </Carte>
    );

  const r = ent.reseau;
  if (!r)
    return (
      <Carte titre="Réseau de franchises">
        <p className="text-sm">
          Une PME dont la marque est bien notée (au moins {decimal(p.noteMinimale, 1)} ★) peut
          vendre des franchises : chaque franchisé paie un droit d’entrée de{' '}
          {argentRond(p.droitEntree)}, puis
          {` ${pourcentage(p.redevance, 0)}`} de ses ventes en redevances et{' '}
          {pourcentage(p.fondsPublicitaire, 0)} au fonds publicitaire. Lancer le réseau coûte{' '}
          {argentRond(p.coutLancement)} (avocat, manuel d’exploitation, document d’information).
        </p>
        <div className="mt-3">
          <Bouton
            variante="primaire"
            disabled={!peutLancerReseau(ent)}
            onClick={() => agir((e, id) => lancerReseauFranchise(e, id))}
          >
            Lancer le réseau de franchises
          </Bouton>
          {!peutLancerReseau(ent) && (
            <p className="mt-1 text-sm text-doux">
              Conditions : être une PME et avoir une note d’au moins {decimal(p.noteMinimale, 1)} ★
              (actuellement {decimal(ent.clientele.note, 1)} ★).
            </p>
          )}
        </div>
      </Carte>
    );

  return (
    <Carte
      titre="Réseau de franchises"
      sousTitre={`${r.franchises.length} franchisé${r.franchises.length > 1 ? 's' : ''} actif${r.franchises.length > 1 ? 's' : ''}${r.fermees > 0 ? ` · ${r.fermees} fermeture${r.fermees > 1 ? 's' : ''}` : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Nombre de franchisés visé :</span>
        <Bouton
          petit
          aria-label="Viser un franchisé de moins"
          onClick={() => agir((e, id) => objectifFranchises(e, id, r.objectif - 1))}
        >
          −
        </Bouton>
        <span className="chiffres w-8 text-center font-semibold">{r.objectif}</span>
        <Bouton
          petit
          aria-label="Viser un franchisé de plus"
          onClick={() => agir((e, id) => objectifFranchises(e, id, r.objectif + 1))}
        >
          +
        </Bouton>
        {r.dernierRevenu !== undefined && (
          <span className="ml-2">Redevances du dernier mois : {argentRond(r.dernierRevenu)}</span>
        )}
      </div>
      {r.franchises.length > 0 && (
        <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          {r.franchises.map((f) => (
            <li key={f.id} className="rounded-lg border border-bordure p-2">
              <span className="font-semibold">{f.nom}</span>
              <span className="block text-doux">
                Performance : {pourcentage(f.facteur, 0)} d’un de tes établissements
                {f.facteur < 0.75 && ' · faible : nuit à ta réputation'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Astuce>
        Chaque franchisé te coûte {argentRond(p.soutienMensuel)} par mois en soutien. Le fonds
        publicitaire fait connaître ta marque, mais un franchisé qui offre un mauvais service nuit à
        ta réputation : c’est le grand défi du franchiseur.
      </Astuce>
    </Carte>
  );
}
