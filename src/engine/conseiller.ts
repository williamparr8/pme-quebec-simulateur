/**
 * Conseiller virtuel : une mentore commente les décisions risquées du mois qui commence et
 * les résultats du mois précédent, en expliquant pourquoi. Fonction pure, sans hasard.
 */
import { secteurParId } from '../data';
import { IDS_DEMARCHES, estApplicable, estObligatoire } from './conformite';
import { coutUnitaireLigne, qualiteDe } from './creation';
import { publiciteParDefaut } from './marketing';
import { quizDisponible } from './quiz';
import type { Entreprise, EtatPartie, Message } from './types';

const ORDRE: Record<Message['niveau'], number> = { danger: 0, alerte: 1, info: 2, succes: 3 };

const somme = (r: Record<string, number>): number => Object.values(r).reduce((a, x) => a + x, 0);

/** Conseils pour l'entreprise, du plus urgent au moins urgent. */
export function conseils(etat: EtatPartie, ent: Entreprise): Message[] {
  if (etat.terminee || ent.enFaillite || ent.vente) return [];
  const secteur = secteurParId(etat.config.secteurId);
  const d = ent.decisions;
  const derniere = ent.archives.at(-1);
  const i = derniere?.indicateurs;
  const m: Message[] = [];

  // Faillite imminente : rien n'est plus urgent.
  if (ent.moisEnDefaut > 0)
    m.push({ code: 'conseilDefaut', niveau: 'danger', params: { mois: ent.moisEnDefaut } });

  // Prix sous le coût d'achat
  const qualite = qualiteDe(secteur, d.qualiteId);
  for (const ligne of secteur.lignes) {
    const prix = d.prix[ligne.id];
    const appro = d.approvisionnement[ligne.id];
    if (prix === undefined || !appro) continue;
    const cout = coutUnitaireLigne(ligne, appro.fournisseurId, qualite, etat.conjoncture);
    if (prix < cout * 1.05)
      m.push({
        code: 'conseilPrixSousCout',
        niveau: 'danger',
        params: { ligne: ligne.nom, prix, cout },
      });
  }

  // Démarches obligatoires oubliées
  for (const id of IDS_DEMARCHES) {
    if (
      estApplicable(id, secteur) &&
      estObligatoire(id, secteur, ent.employes.length) &&
      !ent.demarches[id]
    )
      m.push({ code: 'conseilDemarche', niveau: 'danger', params: { demarche: id } });
  }
  if (ent.fiscal.doitSInscrire && !ent.fiscal.inscritTaxes)
    m.push({ code: 'conseilInscriptionTaxes', niveau: 'danger' });
  else if (!ent.fiscal.inscritTaxes) {
    const ventes = ent.fiscal.ventesTaxablesMois.slice(-12).reduce((a, x) => a + x, 0);
    if (ventes > 25_000)
      m.push({ code: 'conseilSeuilTaxes', niveau: 'alerte', params: { ventes } });
  }

  if (i) {
    // Trésorerie
    const charges = Math.max(0, i.chiffreAffaires - i.beneficeNet);
    const limite = ent.margeCredit.limite / 100;
    if (limite > 0 && i.margeCreditUtilisee > 0.8 * limite)
      m.push({
        code: 'conseilMargeCredit',
        niveau: 'danger',
        params: { utilisee: i.margeCreditUtilisee, limite },
      });
    else if (i.encaisse < 0.5 * charges)
      m.push({
        code: 'conseilTresorerie',
        niveau: 'alerte',
        params: { encaisse: i.encaisse, charges },
      });

    // Marge brute et main-d'œuvre par rapport au secteur
    const [margeMin, margeMax] = secteur.margeBruteCible;
    if (i.chiffreAffaires > 0 && i.tauxMargeBrute < margeMin - 0.05)
      m.push({
        code: 'conseilMargeBrute',
        niveau: 'alerte',
        params: { marge: i.tauxMargeBrute, min: margeMin, max: margeMax },
      });
    const mainOeuvreMax = secteur.coutMainOeuvreCible[1];
    if (i.chiffreAffaires > 0 && i.tauxMainOeuvre > mainOeuvreMax + 0.05)
      m.push({
        code: 'conseilMainOeuvre',
        niveau: 'alerte',
        params: { taux: i.tauxMainOeuvre, max: mainOeuvreMax },
      });

    // Opérations
    if (i.demande > 0 && i.perduesCapacite / i.demande > 0.08)
      m.push({
        code: 'conseilCapacite',
        niveau: 'alerte',
        params: { pct: i.perduesCapacite / i.demande },
      });
    if (i.demande > 0 && i.perduesRupture / i.demande > 0.05)
      m.push({
        code: 'conseilRuptures',
        niveau: 'alerte',
        params: { pct: i.perduesRupture / i.demande },
      });

    // Prix par rapport au marché
    if (i.indicePrixOffre > 1.2 && i.partMarche < 0.12)
      m.push({ code: 'conseilPrixEleve', niveau: 'info', params: { indice: i.indicePrixOffre } });
    else if (i.indicePrixOffre < 0.85 && i.tauxMargeBrute < margeMax)
      m.push({ code: 'conseilPrixBas', niveau: 'info', params: { indice: i.indicePrixOffre } });
  }

  // Notoriété et publicité
  const pubDefaut = somme(publiciteParDefaut(secteur));
  if (ent.clientele.notoriete < 0.25 && somme(d.publicite) < 0.5 * pubDefaut)
    m.push({
      code: 'conseilNotoriete',
      niveau: 'alerte',
      params: { notoriete: ent.clientele.notoriete },
    });

  // Équipe
  if (ent.employes.length > 0) {
    const moral = ent.employes.reduce((a, e) => a + e.moral, 0) / ent.employes.length;
    if (moral < 50) m.push({ code: 'conseilMoral', niveau: 'alerte', params: { moral } });
    const heuresSup = ent.employes.filter((e) => e.heuresSemaine > 40).length;
    if (heuresSup > 0)
      m.push({ code: 'conseilHeuresSup', niveau: 'info', params: { n: heuresSup } });
  }

  if (ent.dilemmes.length > 0)
    m.push({ code: 'conseilDilemmes', niveau: 'info', params: { n: ent.dilemmes.length } });
  if (quizDisponible(etat, ent)) m.push({ code: 'conseilQuiz', niveau: 'info' });

  // Encouragement : trois mois profitables de suite.
  const trois = ent.archives.slice(-3);
  if (trois.length === 3 && trois.every((a) => a.indicateurs.beneficeNet > 0))
    m.push({ code: 'conseilBravo', niveau: 'succes' });
  if (m.length === 0) m.push({ code: 'conseilRien', niveau: 'succes' });

  return m.sort((a, b) => ORDRE[a.niveau] - ORDRE[b.niveau]);
}
