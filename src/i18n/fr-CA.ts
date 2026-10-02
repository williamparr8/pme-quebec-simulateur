/**
 * Textes destinés au joueur (français québécois).
 * Le moteur produit des codes de messages; ce fichier les transforme en phrases
 * qui expliquent ce qui s'est passé et pourquoi.
 */
import type { CauseVariation } from '../engine/analyse';
import type { Message } from '../engine/types';
import { argent, argentRond, decimal, nombre, pourcentage } from './format';
import { MESSAGES_JALON2 } from './messages-jalon2';
import { MESSAGES_JALON3 } from './messages-jalon3';
import { MESSAGES_JALON4 } from './messages-jalon4';
import { MESSAGES_JALON5 } from './messages-jalon5';
import { MESSAGES_CROISSANCE } from './messages-croissance';

export interface TexteMessage {
  titre: string;
  texte: string;
}

type Params = Record<string, number | string>;

const n = (p: Params, cle: string): number => Number(p[cle] ?? 0);
const s = (p: Params, cle: string): string => String(p[cle] ?? '');

const CAUSES: Record<CauseVariation, { hausse: string; baisse: string }> = {
  saison: {
    hausse: 'La saison est favorable : les clients sortent davantage ce mois-ci (saisonnalité).',
    baisse:
      'C’est surtout la saison : chaque secteur a ses mois forts et ses mois creux (juillet pour un café, janvier pour une boutique, la fin de l’automne pour un paysagiste). Prévois ta trésorerie en conséquence.',
  },
  notoriete: {
    hausse:
      'Plus de gens connaissent ton commerce : ta notoriété a augmenté (publicité, emplacement et bouche-à-oreille).',
    baisse:
      'Ta notoriété a baissé : sans publicité ni bouche-à-oreille, les clients oublient un commerce.',
  },
  prix: {
    hausse: 'Tes prix sont plus attrayants qu’avant : la demande réagit au prix (élasticité-prix).',
    baisse:
      'Ta hausse de prix a fait fuir une partie de la clientèle : c’est l’élasticité-prix de la demande.',
  },
  capacite: {
    hausse:
      'Tu as pu servir plus de clients : moins de clients ont abandonné à cause de l’attente.',
    baisse:
      'Faute de personnel, des clients sont repartis sans acheter. Ta capacité limite tes ventes.',
  },
  avis: {
    hausse: 'Ta note en ligne s’est améliorée, ce qui attire de nouveaux clients.',
    baisse: 'Ta note en ligne a baissé : les clients consultent les avis avant de choisir.',
  },
  concurrence: {
    hausse: 'Tu gagnes des clients au détriment de tes concurrents.',
    baisse: 'Tes concurrents t’ont pris des clients (prix, publicité ou qualité).',
  },
};

const MESSAGES: Record<string, (p: Params) => TexteMessage> = {
  bienvenue: () => ({
    titre: 'Ton commerce a ouvert ses portes!',
    texte:
      'Les premiers mois sont presque toujours déficitaires : il faut le temps de se faire connaître. Surveille ta trésorerie plus que ton bénéfice.',
  }),
  ventesHausse: (p) => ({
    titre: `Ventes en hausse de ${pourcentage(n(p, 'pct'))}`,
    texte: CAUSES[s(p, 'cause') as CauseVariation]?.hausse ?? '',
  }),
  ventesBaisse: (p) => ({
    titre: `Ventes en baisse de ${pourcentage(-n(p, 'pct'))}`,
    texte: CAUSES[s(p, 'cause') as CauseVariation]?.baisse ?? '',
  }),
  beneficeMois: (p) => ({
    titre: `Bénéfice net de ${argentRond(n(p, 'montant'))}`,
    texte:
      'Tes produits ont dépassé tes charges. Rappel : dans une entreprise individuelle, ce bénéfice rémunère aussi ton propre travail, et il sera imposé dans ta déclaration personnelle.',
  }),
  perteMois: (p) => ({
    titre: `Perte nette de ${argentRond(-n(p, 'montant'))}`,
    texte:
      'Tes charges ont dépassé tes produits ce mois-ci. Regarde l’état des résultats (F) pour trouver les postes les plus lourds.',
  }),
  capaciteInsuffisante: (p) => ({
    titre: `${nombre(n(p, 'perdues'))} clients perdus faute de personnel`,
    texte: `${pourcentage(n(p, 'pct'))} des clients sont repartis à cause de l’attente. Embauche (R) ou augmente les heures de ton équipe : chaque client perdu est une vente perdue et nuit à ta réputation.`,
  }),
  personnelSousUtilise: (p) => ({
    titre: 'Personnel sous-utilisé',
    texte: `Ton équipe n’est occupée qu’à ${pourcentage(n(p, 'utilisation'), 0)} de sa capacité. Tu paies des heures où il n’y a pas de clients : réduis les heures ou attire plus de clients.`,
  }),
  ruptureStock: (p) => ({
    titre: `Ruptures de stock : ${nombre(n(p, 'perdues'))} clients déçus`,
    texte:
      'Des produits ont manqué. Revois ton point de commande et ton stock de sécurité, ou choisis un fournisseur plus rapide et plus fiable (O). Les clients qui trouvent souvent les tablettes vides finissent par aller ailleurs.',
  }),
  heuresReduites: (p) => ({
    titre: 'Heures d’ouverture réduites',
    texte: `Tu voulais ouvrir ${nombre(n(p, 'voulues'))} h par semaine, mais ton personnel ne couvre que ${nombre(n(p, 'effectives'))} h. Il faut au moins une personne sur place pour ouvrir.`,
  }),
  margeBruteFaible: (p) => ({
    titre: `Marge brute faible : ${pourcentage(n(p, 'taux'))}`,
    texte: `La moyenne du secteur est de ${pourcentage(n(p, 'min'), 0)} à ${pourcentage(n(p, 'max'), 0)}. Vérifie tes prix ou le coût de tes marchandises (qualité choisie, inflation des fournisseurs).`,
  }),
  margeBruteElevee: (p) => ({
    titre: `Marge brute très élevée : ${pourcentage(n(p, 'taux'))}`,
    texte:
      'Excellente marge par vente, mais tes prix sont peut-être trop élevés pour attirer assez de clients. Compare ton volume de ventes.',
  }),
  mainOeuvreElevee: (p) => ({
    titre: `Coût de main-d’œuvre élevé : ${pourcentage(n(p, 'taux'))} des ventes`,
    texte: `Dans ce secteur, la main-d’œuvre représente au plus ${pourcentage(n(p, 'max'), 0)} des ventes. Ajuste les horaires à l’achalandage.`,
  }),
  prixEleves: (p) => ({
    titre: 'Tes prix sont nettement au-dessus du marché',
    texte: `Ton indice de prix est de ${decimal(n(p, 'indice'))} (1,00 = prix du marché). C’est une stratégie d’écrémage : elle exige une qualité et une image à la hauteur.`,
  }),
  prixBas: (p) => ({
    titre: 'Tes prix sont nettement sous le marché',
    texte: `Ton indice de prix est de ${decimal(n(p, 'indice'))}. Une stratégie de pénétration attire des clients, mais réduit ta marge et peut provoquer une guerre de prix.`,
  }),
  notorieteHausse: (p) => ({
    titre: `Notoriété : de ${pourcentage(n(p, 'avant'), 0)} à ${pourcentage(n(p, 'apres'), 0)}`,
    texte:
      'Plus de gens du quartier connaissent ton commerce. La notoriété est la première étape avant l’achat.',
  }),
  noteBaisse: (p) => ({
    titre: `Ta note en ligne baisse (${decimal(n(p, 'note'), 1)}/5)`,
    texte:
      'Des clients insatisfaits ont laissé des avis négatifs. Vérifie le rapport qualité-prix, l’attente et le service.',
  }),
  noteHausse: (p) => ({
    titre: `Ta note en ligne monte (${decimal(n(p, 'note'), 1)}/5)`,
    texte: 'Tes clients sont satisfaits et le disent en ligne : c’est de la publicité gratuite.',
  }),
  satisfactionBasse: (p) => ({
    titre: `Clients insatisfaits (${pourcentage(n(p, 'satisfaction'), 0)})`,
    texte:
      'Prix trop élevé pour la qualité, attente trop longue ou service faible : la satisfaction influence les avis et le bouche-à-oreille.',
  }),
  moralBas: (p) => ({
    titre: `Moral de l’équipe bas (${nombre(n(p, 'moral'))}/100)`,
    texte:
      'Salaires sous le marché ou surcharge de travail. Un moral bas réduit la productivité, nuit au service et fait démissionner les employés.',
  }),
  demission: (p) => ({
    titre: `${s(p, 'nom')} a démissionné`,
    texte: `Son moral était de ${nombre(n(p, 'moral'))}/100. Le roulement de personnel coûte cher : recrutement, formation et clients mal servis pendant ce temps.`,
  }),
  decouvert1: (p) => ({
    titre: 'Avertissement de la banque : compte à découvert',
    texte: `Ton encaisse est de ${argentRond(n(p, 'montant'))} malgré la marge de crédit utilisée au maximum. Injecte des fonds (F), réduis tes prélèvements ou tes dépenses. Après 3 mois à découvert, c’est la faillite.`,
  }),
  decouvert2: (p) => ({
    titre: 'Dernier avis : 2e mois à découvert',
    texte: `Ton encaisse est de ${argentRond(n(p, 'montant'))}. Si la situation n’est pas corrigée le mois prochain, la banque rappellera ses prêts. Dans une entreprise individuelle, tes biens personnels (auto, épargne, maison) peuvent être saisis pour payer les dettes de l’entreprise.`,
  }),
  tresorerieBasse: (p) => ({
    titre: `Trésorerie basse : ${argentRond(n(p, 'montant'))}`,
    texte:
      'Un commerce rentable peut quand même manquer d’argent. Garde un coussin pour payer le loyer, la paie et les fournisseurs.',
  }),
  prelevementsEleves: (p) => ({
    titre: 'Tes prélèvements dépassent tes bénéfices',
    texte: `Tu retires ${argentRond(n(p, 'prelevements'))} par mois alors que l’entreprise gagne en moyenne ${argentRond(n(p, 'benefice'))}. Tu vides l’entreprise de son fonds de roulement.`,
  }),
  finExercice: (p) => ({
    titre: `Fin de l’exercice ${s(p, 'annee')}`,
    texte: `Bénéfice net de l’année : ${argentRond(n(p, 'benefice'))}. Les comptes de produits, de charges et de prélèvements ont été fermés et virés au capital. Consulte les états financiers annuels (F).`,
  }),
  faillite: () => ({
    titre: 'Faillite',
    texte:
      'Trois mois de suite à découvert : la banque a rappelé ses prêts et l’entreprise cesse ses activités. En entreprise individuelle, le propriétaire répond des dettes sur ses biens personnels.',
  }),
  tauxDirecteurHausse: (p) => ({
    titre: `La Banque du Canada hausse son taux directeur à ${pourcentage(n(p, 'taux'), 2)}`,
    texte:
      'Le taux préférentiel des banques suit : les intérêts sur ta marge de crédit et tes prêts à taux variable augmentent. Les prêts à taux fixe ne bougent pas.',
  }),
  tauxDirecteurBaisse: (p) => ({
    titre: `La Banque du Canada baisse son taux directeur à ${pourcentage(n(p, 'taux'), 2)}`,
    texte:
      'Emprunter coûte moins cher : bonne nouvelle pour ta marge de crédit et tes prêts à taux variable. Tes placements rapporteront un peu moins.',
  }),
  hausseSalaireMinimum: (p) => ({
    titre: `Le salaire minimum passe à ${argent(n(p, 'taux'))} l’heure`,
    texte:
      'Comme chaque 1er mai au Québec, le gouvernement révise le salaire minimum. Tes coûts de main-d’œuvre augmentent.',
  }),
  salaireAjusteMinimum: (p) => ({
    titre: 'Salaires ajustés au minimum légal',
    texte: `Des salaires étaient sous le nouveau minimum. Ils ont été relevés à ${argent(n(p, 'salaire'))} : payer moins que le salaire minimum est illégal (Loi sur les normes du travail).`,
  }),
  apportPonctuel: (p) => ({
    titre: `Apport de ${argentRond(n(p, 'montant'))}`,
    texte:
      'Tu as investi ton argent personnel dans l’entreprise : ton capital augmente. C’est une activité de financement.',
  }),
  remboursementAnticipe: (p) => ({
    titre: `Remboursement anticipé de ${argentRond(n(p, 'montant'))}`,
    texte: 'Moins de dette, donc moins d’intérêts à payer, mais moins d’encaisse disponible.',
  }),
  indemnitesPreavis: (p) => ({
    titre: `Indemnités de fin d’emploi : ${argent(n(p, 'montant'))}`,
    texte:
      'Sans préavis écrit, la Loi sur les normes du travail oblige à verser une indemnité (1 semaine de salaire après 3 mois de service, 2 semaines après 1 an, etc.).',
  }),
  indexationLoyer: (p) => ({
    titre: `Loyer indexé de ${pourcentage(n(p, 'taux'))}`,
    texte: `Ton bail prévoit une hausse annuelle. Nouveau loyer : ${argent(n(p, 'loyer'))} par mois.`,
  }),
  tirageMarge: (p) => ({
    titre: `Marge de crédit utilisée : ${argentRond(n(p, 'montant'))}`,
    texte:
      'Ton encaisse est tombée sous zéro : la banque a avancé l’argent sur ta marge de crédit. Ce n’est pas un revenu : c’est une dette qui coûte des intérêts.',
  }),
  concurrentPrix: (p) => ({
    titre: `${s(p, 'nom')} change ses prix`,
    texte: `Ton concurrent a modifié ses prix (indice ${decimal(n(p, 'valeur'))}) en réaction au marché. C’est le début d’une guerre de prix?`,
  }),
  concurrentPublicite: (p) => ({
    titre: `${s(p, 'nom')} augmente sa publicité`,
    texte: `Ton concurrent investit maintenant environ ${argentRond(n(p, 'valeur'))} par mois en publicité pour défendre sa part de marché.`,
  }),
  concurrentQualite: (p) => ({
    titre: `${s(p, 'nom')} améliore sa qualité`,
    texte:
      'Ton concurrent a remarqué ta qualité et monte la barre. La concurrence pousse tout le monde à s’améliorer.',
  }),
};

export function texteMessage(m: Message): TexteMessage {
  const f =
    MESSAGES[m.code] ??
    MESSAGES_JALON2[m.code] ??
    MESSAGES_JALON3[m.code] ??
    MESSAGES_JALON4[m.code] ??
    MESSAGES_JALON5[m.code] ??
    MESSAGES_CROISSANCE[m.code];
  return f ? f(m.params ?? {}) : { titre: m.code, texte: '' };
}

export const ORDRE_NIVEAUX: Record<Message['niveau'], number> = {
  danger: 0,
  alerte: 1,
  succes: 2,
  info: 3,
};

export const DIFFICULTES_TEXTE = {
  facile: {
    nom: 'Facile',
    description:
      'Marché plus grand, concurrents moins agressifs, marge de crédit plus généreuse, moins d’événements négatifs et de récessions.',
  },
  realiste: {
    nom: 'Réaliste',
    description:
      'Des conditions proches de la réalité d’une PME québécoise : événements fréquents, cycles économiques normaux.',
  },
  expert: {
    nom: 'Expert',
    description:
      'Marché plus petit, concurrents agressifs qui arrivent plus tôt, banque prudente, plus d’événements négatifs, de récessions et de vérifications fiscales.',
  },
} as const;
