/** Succursales : ouvrir, suivre et fermer d'autres établissements dans la même ville. */
import { useState } from 'react';
import {
  MAX_SUCCURSALES,
  MOIS_PENALITE_FERMETURE,
  coutsSuccursale,
  employesDuSite,
  fermerSuccursale,
  ouvrirSuccursale,
} from '../../../engine/simulation';
import { argentRond, nombre } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Bouton } from '../../composants/Bouton';
import { Astuce, Carte } from '../../composants/Carte';
import { useJeuCourant } from '../contexte';

export function CarteSuccursales() {
  const { ent, secteur, ville, derniere } = useJeuCourant();
  const agir = useJeu((s) => s.agir);
  const emplacements = ville.emplacements.filter((e) => secteur.emplacements.includes(e.id));
  const [emplacementId, setEmplacementId] = useState(emplacements[0]?.id ?? '');
  const [nom, setNom] = useState('');
  const succursales = ent.succursales ?? [];
  const couts = coutsSuccursale(ent, secteur, ville, emplacementId);
  const encaisse = ent.livre.soldes.encaisse / 100;
  const max = succursales.length >= MAX_SUCCURSALES;
  const resultat = (id: string) => derniere?.sites?.find((x) => x.id === id);

  return (
    <Carte
      titre="Succursales"
      sousTitre={`${succursales.length} succursale${succursales.length > 1 ? 's' : ''} en plus du premier commerce (maximum ${MAX_SUCCURSALES})`}
    >
      {succursales.length > 0 && (
        <ul className="mb-4 space-y-2 text-sm">
          {[
            {
              id: 'principal',
              nom: `${ent.nom} (premier commerce)`,
              emplacementId: ent.emplacementId,
            },
            ...succursales,
          ].map((s) => {
            const r = resultat(s.id);
            const equipe = employesDuSite(ent, s.id === 'principal' ? undefined : s.id).length;
            const succ = succursales.find((x) => x.id === s.id);
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bordure p-2"
              >
                <span>
                  <span className="font-semibold">{s.nom}</span>
                  <span className="block text-doux">
                    {ville.emplacements.find((e) => e.id === s.emplacementId)?.nom} · {equipe}{' '}
                    employé
                    {equipe > 1 ? 's' : ''}
                    {succ && ` · loyer ${argentRond(succ.bail.loyerMensuel / 100)}/mois`}
                    {r &&
                      ` · le mois dernier : ${nombre(r.servies)} clients, ${argentRond(r.chiffreAffaires)}`}
                    {r &&
                      r.perduesCapacite > 0 &&
                      `, ${nombre(r.perduesCapacite)} clients perdus faute de capacité`}
                  </span>
                </span>
                {succ && (
                  <Bouton
                    petit
                    variante="danger"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Fermer ${succ.nom}? Le bail sera résilié (pénalité de ${MOIS_PENALITE_FERMETURE} mois de loyer) et l’équipe sera mutée au premier commerce.`,
                        )
                      )
                        agir((e, id) => fermerSuccursale(e, id, succ.id));
                    }}
                  >
                    Fermer
                  </Bouton>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!max && (
        <div className="space-y-3">
          <h3 className="font-semibold">Ouvrir une succursale à {ville.nom}</h3>
          <div className="flex flex-wrap gap-3">
            <label className="space-y-1 text-sm">
              <span className="block font-semibold">Emplacement</span>
              <select
                value={emplacementId}
                onChange={(e) => setEmplacementId(e.target.value)}
                className="rounded-md border border-bordure bg-surface-2 px-2 py-1.5"
              >
                {emplacements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[14rem] flex-1 space-y-1 text-sm">
              <span className="block font-semibold">Nom (facultatif)</span>
              <input
                type="text"
                maxLength={40}
                value={nom}
                placeholder={`${ent.nom} (succursale ${succursales.length + 2})`}
                onChange={(e) => setNom(e.target.value)}
                className="w-full rounded-md border border-bordure bg-surface-2 px-2 py-1.5"
              />
            </label>
          </div>
          <table className="chiffres w-full max-w-md text-sm">
            <tbody>
              {(
                [
                  ['Équipement', couts.equipement],
                  ['Aménagement', couts.amenagement],
                  ['Dépôt de garantie (2 mois de loyer)', couts.depotGarantie],
                  ['Frais d’ouverture', couts.fraisOuverture],
                  ['Total à payer maintenant (avant taxes)', couts.total],
                  ['Loyer mensuel', couts.loyerMensuel],
                ] as [string, number][]
              ).map(([l, v]) => (
                <tr key={l} className="border-b border-bordure/60">
                  <td className="py-1">{l}</td>
                  <td className="py-1 text-right font-semibold">{argentRond(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {encaisse < couts.total && (
            <p className="text-sm text-danger" role="status">
              Ton encaisse ({argentRond(encaisse)}) ne suffit pas. Demande d’abord un prêt ou
              injecte des fonds (F).
            </p>
          )}
          <Bouton
            variante="primaire"
            disabled={encaisse < couts.total}
            onClick={() => {
              agir((e, id) => ouvrirSuccursale(e, id, emplacementId, nom));
              setNom('');
            }}
          >
            Ouvrir la succursale
          </Bouton>
        </div>
      )}
      <Astuce titre="Une succursale, ça rapporte?">
        Une succursale attire de nouveaux clients, mais elle en prend aussi au premier commerce :
        c’est la cannibalisation. Elle ajoute un loyer, des frais d’exploitation et une équipe
        (embauchée automatiquement). Les achats restent centralisés, ce qui aide à atteindre le
        palier PME et ses rabais de volume. Tu peux muter tes employés d’un établissement à l’autre
        (R).
      </Astuce>
    </Carte>
  );
}
