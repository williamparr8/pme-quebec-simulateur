/**
 * Études de marché : elles révèlent des données cachées, avec une marge d'erreur
 * qui dépend de la taille de l'échantillon (≈ 1,96 × √(p(1 − p) / n) à 95 %).
 */
import { personaParId, typeEtudeParId } from '../data';
import type { IdTypeEtude, Secteur, Sensibilites, Ville } from './data-types';
import type { Concurrent } from './ai-competitors';
import type { Conjoncture } from './economy';
import { prixReference } from './market';
import { nouveauProduit, produitActif } from './produits';
import type { Rng } from './rng';
import type { Entreprise, EtudeMarche, Estimation } from './types';
import { borner } from './util';

const arrondi = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

/** Marge d'erreur d'une proportion (95 %). */
export function margeErreur(p: number, n: number): number {
  if (n <= 0) return 1;
  return 1.96 * Math.sqrt((borner(p, 0.01, 0.99) * (1 - borner(p, 0.01, 0.99))) / n);
}

function proportion(vraie: number, n: number, rng: Rng): Estimation {
  const p = borner(vraie + rng.normal(0, Math.sqrt((vraie * (1 - vraie)) / Math.max(1, n))), 0, 1);
  return { valeur: arrondi(p), marge: arrondi(margeErreur(p, n)) };
}

export interface ContexteEtude {
  ent: Entreprise;
  secteur: Secteur;
  ville: Ville;
  conj: Conjoncture;
  concurrents: Concurrent[];
  facteurMarche: number;
  /** Ambiance réelle du commerce (aménagement et rénovations). */
  ambiance: number;
  index: number;
  annee: number;
  mois: number;
}

const CRITERES: (keyof Omit<Sensibilites, 'note'>)[] = [
  'prix',
  'qualite',
  'service',
  'ambiance',
  'heures',
  'eco',
  'local',
];

export function realiserEtude(
  typeId: IdTypeEtude,
  c: ContexteEtude,
  id: string,
  rng: Rng,
): EtudeMarche {
  const type = typeEtudeParId(typeId);
  const { ent, secteur } = c;
  const etude: EtudeMarche = {
    id,
    typeId,
    index: c.index,
    annee: c.annee,
    mois: c.mois,
    taille: type.taille,
  };
  const derniere = ent.archives.at(-1);

  if (typeId === 'donneesSecondaires') {
    const moyenneSaison = secteur.saisonnalite.reduce((a, x) => a + x, 0) / 12;
    const vrai =
      (c.ville.marchePotentielMensuel[secteur.id] ?? 0) *
      moyenneSaison *
      c.conj.confiance *
      c.facteurMarche;
    const valeur = Math.round(vrai * (1 + rng.normal(0, 0.05)));
    etude.potentiel = { valeur, marge: Math.round(valeur * 0.1) };
    etude.partsSegments = Object.fromEntries(secteur.segments.map((s) => [s.personaId, s.part]));
  }

  if (typeId === 'sondageEclair' || typeId === 'sondageComplet') {
    const n = type.taille ?? 100;
    etude.notorieteSegments = {};
    for (const s of secteur.segments) {
      const ns = Math.max(5, Math.round(n * s.part));
      etude.notorieteSegments[s.personaId] = proportion(
        ent.marketing.notorieteSegments[s.personaId] ?? 0,
        ns,
        rng,
      );
    }
    etude.notoriete = proportion(ent.clientele.notoriete, n, rng);
    etude.satisfaction = proportion(ent.clientele.satisfaction, n, rng);
    etude.prixAcceptable = {};
    const lignes = [
      ...secteur.lignes,
      ...secteur.nouveauxProduits.filter((p) => !p.b2b && produitActif(ent, p.id)),
    ];
    for (const ligne of lignes) {
      const vrai =
        prixReference(ligne, c.conj.indicePrix) *
        (0.92 + 0.35 * (ent.clientele.qualitePercue - 0.5) + 0.12 * (ent.clientele.note - 3.5));
      const ecart = (vrai * 0.25) / Math.sqrt(n);
      const valeur = Math.round((vrai + rng.normal(0, ecart)) * 20) / 20;
      etude.prixAcceptable[ligne.id] = { valeur, marge: Math.round(1.96 * ecart * 100) / 100 };
    }
  }

  if (typeId === 'groupeDiscussion') {
    etude.criteres = {};
    for (const s of secteur.segments) {
      const p = personaParId(s.personaId);
      const scores = CRITERES.map((k) => ({
        k,
        v: (secteur.sensibilites[k] ?? 0) * p.sensibilites[k] * (1 + rng.normal(0, 0.12)),
      }));
      etude.criteres[s.personaId] = scores.sort((a, b) => b.v - a.v).map((x) => x.k);
    }
    const candidats = secteur.nouveauxProduits.filter(
      (p) => !p.b2b && !ent.marketing.produits.some((x) => x.ligneId === p.id),
    );
    etude.produitsPrometteurs = candidats
      .map((p) => {
        const attrait = secteur.segments.reduce(
          (a, s) => a + s.part * (nouveauProduit(secteur, p.id).segments[s.personaId] ?? 1),
          0,
        );
        return { id: p.id, v: p.probabiliteSucces * attrait * (1 + rng.normal(0, 0.1)) };
      })
      .sort((a, b) => b.v - a.v)
      .map((x) => x.id);
    const ip = derniere ? derniere.indicateurs.indicePrixOffre : 1;
    etude.perception = {
      qualite: arrondi(borner(ent.clientele.qualitePercue + rng.normal(0, 0.05), 0, 1), 2),
      service: arrondi(borner(ent.clientele.service + rng.normal(0, 0.05), 0, 1), 2),
      ambiance: arrondi(borner(c.ambiance + rng.normal(0, 0.05), 0, 1), 2),
      prix: arrondi(ip + rng.normal(0, 0.03), 2),
    };
  }

  if (typeId === 'analyseConcurrence') {
    etude.concurrents = c.concurrents
      .filter((x) => x.actif)
      .map((x) => ({
        id: x.id,
        part: {
          valeur: arrondi(borner(x.partMarche + rng.normal(0, 0.015), 0, 1)),
          marge: 0.03,
        },
        budgetPublicite: Math.round((x.budgetPublicite * (1 + rng.normal(0, 0.08))) / 50) * 50,
        qualite: arrondi(borner(x.qualite + rng.normal(0, 0.03), 0, 1), 2),
        ventesMensuelles: Math.round((x.ventesMois * (1 + rng.normal(0, 0.08))) / 100) * 100,
      }));
  }
  return etude;
}
