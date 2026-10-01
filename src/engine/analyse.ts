/**
 * Analyse pédagogique du mois : ce qui a bien ou mal fonctionné, et pourquoi.
 * Retourne des codes de messages; le texte est dans src/i18n/fr-CA.ts.
 */
import { posteParId } from '../data';
import type { Secteur } from './data-types';
import type { Decisions, Entreprise, Message, MoisArchive } from './types';

export type CauseVariation = 'saison' | 'notoriete' | 'prix' | 'capacite' | 'avis' | 'concurrence';

/** Cherche la cause la plus probable d'une variation des ventes. */
export function causeVariation(
  actuel: MoisArchive,
  precedent: MoisArchive,
  secteur: Secteur,
): CauseVariation {
  const a = actuel.indicateurs;
  const p = precedent.indicateurs;
  const sens = Math.sign(a.chiffreAffaires - p.chiffreAffaires) || 1;
  const effets: [CauseVariation, number][] = [
    [
      'saison',
      secteur.saisonnalite[actuel.mois - 1] / secteur.saisonnalite[precedent.mois - 1] - 1,
    ],
    ['notoriete', p.notoriete > 0 ? (a.notoriete / p.notoriete) ** 0.8 - 1 : 0],
    ['prix', -secteur.sensibilites.prix * 0.6 * (a.indicePrixOffre - p.indicePrixOffre)],
    [
      'capacite',
      (p.demande > 0 ? p.perduesCapacite / p.demande : 0) -
        (a.demande > 0 ? a.perduesCapacite / a.demande : 0),
    ],
    ['avis', (a.note - p.note) * secteur.sensibilites.note * 0.6],
  ];
  let meilleure: CauseVariation = 'concurrence';
  let max = 0.01;
  for (const [cause, effet] of effets) {
    if (effet * sens > max) {
      max = effet * sens;
      meilleure = cause;
    }
  }
  return meilleure;
}

export function analyserMois(
  archive: MoisArchive,
  precedent: MoisArchive | undefined,
  d: Decisions,
  secteur: Secteur,
  ent: Entreprise,
  heuresEffectives: number,
): Message[] {
  const m: Message[] = [];
  const i = archive.indicateurs;

  if (archive.index === 0) m.push({ code: 'bienvenue', niveau: 'succes' });

  // Ventes
  if (precedent && precedent.indicateurs.chiffreAffaires > 0) {
    const variation = i.chiffreAffaires / precedent.indicateurs.chiffreAffaires - 1;
    if (Math.abs(variation) >= 0.05) {
      m.push({
        code: variation > 0 ? 'ventesHausse' : 'ventesBaisse',
        niveau: variation > 0 ? 'succes' : 'alerte',
        params: { pct: variation, cause: causeVariation(archive, precedent, secteur) },
      });
    }
  }

  // Résultat du mois
  if (i.beneficeNet >= 0)
    m.push({ code: 'beneficeMois', niveau: 'succes', params: { montant: i.beneficeNet } });
  else m.push({ code: 'perteMois', niveau: 'alerte', params: { montant: i.beneficeNet } });

  // Opérations
  if (i.demande > 0 && i.perduesCapacite / i.demande > 0.03) {
    m.push({
      code: 'capaciteInsuffisante',
      niveau: 'alerte',
      params: { perdues: i.perduesCapacite, pct: i.perduesCapacite / i.demande },
    });
  } else if (i.utilisation < 0.45 && i.nbEmployes > 1) {
    m.push({
      code: 'personnelSousUtilise',
      niveau: 'info',
      params: { utilisation: i.utilisation },
    });
  }
  if (i.perduesRupture > 0) {
    const lignes = archive.stocks
      .filter((s) => s.perdues > 0 && s.demandees > 0 && s.perdues / s.demandees > 0.02)
      .map((s) => s.ligneId);
    m.push({
      code: 'ruptureStock',
      niveau: 'alerte',
      params: { perdues: i.perduesRupture, lignes: lignes.join(',') },
    });
  }
  const aProducteur = ent.employes.some((e) => posteParId(e.posteId).role === 'production');
  if (aProducteur && i.perduesProduction >= 20 && i.chiffreAffaires > 0) {
    m.push({
      code: 'productionInsuffisante',
      niveau: 'alerte',
      params: {
        perdues: i.perduesProduction,
        production: secteur.libelleProduction,
        heures: i.capaciteProduction,
        demandees: i.demandeProduction,
      },
    });
  }
  const cmv = (archive.mouvements.coutMarchandises ?? 0) / 100;
  const perimes = (archive.mouvements.pertesStocks ?? 0) / 100;
  if (cmv > 0 && perimes / cmv > 0.04) {
    m.push({
      code: 'pertesPeremption',
      niveau: 'alerte',
      params: { montant: perimes, pct: perimes / cmv, libelle: secteur.libellePertes },
    });
  }
  if (i.tauxDefauts > 0.06) {
    m.push({
      code: 'defautsEleves',
      niveau: 'alerte',
      params: { taux: i.tauxDefauts, plaintes: i.plaintes },
    });
  }

  // Prévision (budget) : écart entre le prévu et le réel
  if (archive.prevision && archive.prevision.ventes > 0) {
    const ecart = i.chiffreAffaires / archive.prevision.ventes - 1;
    m.push({
      code: Math.abs(ecart) <= 0.05 ? 'previsionJuste' : 'previsionEcart',
      niveau: Math.abs(ecart) <= 0.05 ? 'succes' : 'info',
      params: {
        prevu: archive.prevision.ventes,
        reel: i.chiffreAffaires,
        ecart,
        beneficePrevu: archive.prevision.benefice,
        beneficeReel: i.beneficeNet,
      },
    });
  }

  // Livraison quand le commerce est déjà plein : elle remplace des ventes en magasin plus rentables.
  if (
    d.livraison &&
    i.ventesLivraison > 0 &&
    i.demande > 0 &&
    i.perduesCapacite / i.demande > 0.05
  ) {
    m.push({
      code: 'livraisonCapacite',
      niveau: 'info',
      params: { livraison: i.ventesLivraison, perdues: i.perduesCapacite },
    });
  }

  // Marketing : coût d'acquisition et valeur à vie d'un client
  if (i.nouveauxClients >= 20 && i.clv > 0 && i.cac > i.clv) {
    m.push({ code: 'cacSuperieurClv', niveau: 'alerte', params: { cac: i.cac, clv: i.clv } });
  }
  if (heuresEffectives < d.heuresOuverture) {
    m.push({
      code: 'heuresReduites',
      niveau: 'alerte',
      params: { voulues: d.heuresOuverture, effectives: heuresEffectives },
    });
  }

  // Marges
  if (i.chiffreAffaires > 0) {
    const [min, max] = secteur.margeBruteCible;
    if (i.tauxMargeBrute < min - 0.03) {
      m.push({
        code: 'margeBruteFaible',
        niveau: 'alerte',
        params: { taux: i.tauxMargeBrute, min, max },
      });
    } else if (i.tauxMargeBrute > max + 0.04) {
      m.push({
        code: 'margeBruteElevee',
        niveau: 'info',
        params: { taux: i.tauxMargeBrute, min, max },
      });
    }
    const maxMo = secteur.coutMainOeuvreCible[1];
    if (i.tauxMainOeuvre > maxMo + 0.05) {
      m.push({
        code: 'mainOeuvreElevee',
        niveau: 'alerte',
        params: { taux: i.tauxMainOeuvre, max: maxMo },
      });
    }
  }
  if (i.indicePrixOffre > 1.2)
    m.push({ code: 'prixEleves', niveau: 'info', params: { indice: i.indicePrixOffre } });
  else if (i.indicePrixOffre < 0.85)
    m.push({ code: 'prixBas', niveau: 'info', params: { indice: i.indicePrixOffre } });

  // Clientèle
  if (precedent) {
    const dn = i.notoriete - precedent.indicateurs.notoriete;
    if (dn >= 0.04) {
      m.push({
        code: 'notorieteHausse',
        niveau: 'succes',
        params: { avant: precedent.indicateurs.notoriete, apres: i.notoriete },
      });
    }
    if (i.nbAvis >= 10) {
      const dNote = i.note - precedent.indicateurs.note;
      if (dNote <= -0.12)
        m.push({ code: 'noteBaisse', niveau: 'alerte', params: { note: i.note } });
      else if (dNote >= 0.12)
        m.push({ code: 'noteHausse', niveau: 'succes', params: { note: i.note } });
    }
  }
  if (i.satisfaction < 0.5)
    m.push({
      code: 'satisfactionBasse',
      niveau: 'alerte',
      params: { satisfaction: i.satisfaction },
    });

  // Ressources humaines
  if (i.nbEmployes > 0 && i.moral < 45)
    m.push({ code: 'moralBas', niveau: 'alerte', params: { moral: i.moral } });
  if (i.nbEmployes > 0 && i.absenteisme > 0.08)
    m.push({ code: 'absenteismeEleve', niveau: 'alerte', params: { taux: i.absenteisme } });

  // Trésorerie
  if (ent.moisEnDefaut === 1)
    m.push({ code: 'decouvert1', niveau: 'danger', params: { montant: i.encaisse } });
  else if (ent.moisEnDefaut === 2)
    m.push({ code: 'decouvert2', niveau: 'danger', params: { montant: i.encaisse } });
  else if (i.encaisse < 3000)
    m.push({ code: 'tresorerieBasse', niveau: 'alerte', params: { montant: i.encaisse } });

  const derniers = [...ent.archives.slice(-2), archive];
  if (derniers.length === 3 && d.prelevements > 0) {
    const beneficeMoyen = derniers.reduce((a, x) => a + x.indicateurs.beneficeNet, 0) / 3;
    if (beneficeMoyen < d.prelevements && i.encaisse < 10_000) {
      m.push({
        code: 'prelevementsEleves',
        niveau: 'info',
        params: { prelevements: d.prelevements, benefice: beneficeMoyen },
      });
    }
  }
  return m;
}
