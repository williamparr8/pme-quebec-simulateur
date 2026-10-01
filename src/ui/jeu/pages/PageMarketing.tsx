import { indicePrixOffre, prixReference } from '../../../engine/market';
import { qualiteDe } from '../../../engine/simulation';
import { argent, argentRond, decimal, pourcentage } from '../../../i18n/format';
import { useJeu } from '../../../store/jeu';
import { Astuce, Carte } from '../../composants/Carte';
import { ChoixCartes } from '../../composants/ChoixCartes';
import { Curseur } from '../../composants/Curseur';
import { Indicateur } from '../../composants/Indicateur';
import { Terme } from '../../composants/Terme';
import { TitrePage } from '../../composants/TitrePage';
import { useJeuCourant } from '../contexte';

export function PageMarketing() {
  const { etat, ent, secteur, derniere } = useJeuCourant();
  const changer = useJeu((s) => s.changerDecisions);
  const d = ent.decisions;
  const conj = etat.conjoncture;
  const qualite = qualiteDe(secteur, d.qualiteId);
  const ip = indicePrixOffre(d.prix, secteur, conj.indicePrix);
  const cl = ent.clientele;

  return (
    <div className="space-y-5">
      <TitrePage titre="Marketing" touche="M">
        Les 4P : le produit (qualité), le prix, la place (ton emplacement) et la promotion
        (publicité). Utilise ← → pour ajuster de 1 % et Maj + ← → pour 10 %. Appuie sur I sur un
        élément pour obtenir sa définition.
      </TitrePage>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur libelle="Notoriété" valeur={pourcentage(cl.notoriete, 0)} terme="notoriete" />
        <Indicateur
          libelle="Indice de prix"
          valeur={decimal(ip)}
          detail="1,00 = prix du marché"
          terme="indicePrix"
        />
        <Indicateur libelle="Qualité perçue" valeur={`${Math.round(cl.qualitePercue * 100)}/100`} />
        <Indicateur
          libelle="Panier moyen"
          valeur={derniere ? argent(derniere.indicateurs.ticketMoyen) : '—'}
          terme="ticketMoyen"
        />
      </div>

      <Carte
        titre="Prix de vente (avant taxes)"
        sousTitre="Les prix des concurrents sont publics : tu les vois sur leurs menus."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {secteur.lignes.map((ligne) => {
            const prix = d.prix[ligne.id];
            const ref = prixReference(ligne, conj.indicePrix);
            const cout = ligne.coutUnitaire * qualite.multiplicateurCout * conj.indiceCouts;
            const marge = prix > 0 ? (prix - cout) / prix : 0;
            return (
              <div key={ligne.id} className="space-y-2">
                <Curseur
                  libelle={ligne.nom}
                  valeur={prix}
                  min={Math.round(ref * 0.4 * 100) / 100}
                  max={Math.round(ref * 3 * 100) / 100}
                  base="valeur"
                  decimales={2}
                  format={argent}
                  terme="elasticitePrix"
                  onChange={(v) => changer({ prix: { ...d.prix, [ligne.id]: v } })}
                  aide={ligne.detail}
                />
                <dl className="chiffres grid grid-cols-2 gap-x-2 text-sm">
                  <dt className="text-doux">Prix du marché</dt>
                  <dd className="text-right">{argent(ref)}</dd>
                  <dt className="text-doux">Coût unitaire</dt>
                  <dd className="text-right">{argent(cout)}</dd>
                  <dt className="text-doux">Marge brute unitaire</dt>
                  <dd className={`text-right font-semibold ${marge < 0.5 ? 'text-alerte' : ''}`}>
                    {pourcentage(marge)}
                  </dd>
                  {etat.concurrents.map((c) => (
                    <div key={c.id} className="contents">
                      <dt className="truncate text-doux">{c.nom}</dt>
                      <dd className="text-right">{argent(c.prix[ligne.id])}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      </Carte>

      <Carte titre="Produit : qualité des ingrédients">
        <ChoixCartes
          legende="Niveau de qualité"
          nom="qualite"
          valeur={d.qualiteId}
          onChange={(id) => changer({ qualiteId: id })}
          colonnes={4}
          options={secteur.qualites.map((q) => ({
            id: q.id,
            titre: q.nom,
            description: q.description,
            detail: `Coût ×${decimal(q.multiplicateurCout)} · qualité ${Math.round(q.score * 100)}/100`,
          }))}
        />
        <p className="mt-3 text-sm text-doux">
          La qualité perçue par les clients rattrape la qualité réelle en quelques mois : un
          changement de qualité ne se voit pas tout de suite dans les ventes.
        </p>
      </Carte>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Promotion : budget de publicité du mois">
          <Curseur
            libelle="Publicité (réseaux sociaux, journal local, affichage)"
            valeur={d.budgetPublicite}
            min={0}
            max={20_000}
            decimales={0}
            format={argentRond}
            terme="rendementsDecroissants"
            onChange={(v) => changer({ budgetPublicite: v })}
            aide="La publicité fait connaître ton commerce, avec des rendements décroissants : doubler le budget ne double pas l’effet."
          />
          <p className="mt-3 text-sm text-doux">
            Le détail par canal (Meta, TikTok, Google, radio, flyers…) arrive au Jalon 3.
          </p>
        </Carte>
        <Astuce titre="Stratégies de prix">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Écrémage</strong> : prix élevés pour une clientèle qui valorise la qualité.
              Exige une image et une qualité à la hauteur.
            </li>
            <li>
              <strong>Pénétration</strong> : prix bas pour gagner des clients vite. Réduit la marge
              et peut déclencher une guerre de prix.
            </li>
            <li>
              <strong>Alignement</strong> : prix proches du marché, on se distingue par autre chose
              (service, ambiance).
            </li>
          </ul>
          <p className="mt-2">
            La sensibilité des clients au prix s’appelle l’
            <Terme id="elasticitePrix">élasticité-prix</Terme>.
          </p>
        </Astuce>
      </div>
    </div>
  );
}
