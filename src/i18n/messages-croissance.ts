/** Textes du mode histoire et de la croissance : répliques des personnages, paliers, succursales. */
import { argentRond } from './format';

type Params = Record<string, number | string>;
const n = (p: Params, cle: string): number => Number(p[cle] ?? 0);
const s = (p: Params, cle: string): string => String(p[cle] ?? '');

/** Répliques des personnages récurrents. La banquière vouvoie; les autres tutoient. */
export const REPLIQUES: Record<string, (p: Params) => string> = {
  mentoreBienvenue: () =>
    'Bienvenue dans la grande aventure! Je vais garder un œil sur toi. Un conseil pour commencer : surveille ton encaisse plus que ton bénéfice. Un commerce meurt rarement d’un manque de profit, presque toujours d’un manque de liquidités.',
  mentoreAnniversaire: (p) =>
    `Déjà ${n(p, 'annees')} an${n(p, 'annees') > 1 ? 's' : ''}! Tu as dégagé ${argentRond(n(p, 'benefice'))} de bénéfice sur les 12 derniers mois. Prends le temps de regarder ce qui a marché, puis fixe-toi un objectif pour l’an prochain.`,
  mentoreAnniversairePerte: (p) =>
    `${n(p, 'annees')} an${n(p, 'annees') > 1 ? 's' : ''} déjà, et une perte de ${argentRond(-n(p, 'benefice'))} sur l’année. Ce n’est pas rare au début. La vraie question : la tendance des derniers mois est-elle meilleure? Si oui, tiens bon. Sinon, il faut changer quelque chose.`,
  mentorePertes: () =>
    'Trois mois de pertes d’affilée… Je ne vais pas te mentir, ça m’inquiète. Regarde ton seuil de rentabilité (F) : est-ce un problème de prix, de coûts fixes ou de clients? Une fois la cause trouvée, agis vite.',
  banquiereDefaut: () =>
    'Je dois être franche avec vous : vos paiements sont en retard. Si la situation persiste trois mois, je n’aurai pas le choix de rappeler le prêt. Venez me voir avec un plan.',
  banquiereMarge: (p) =>
    `Je remarque que vous utilisez ${argentRond(n(p, 'utilisee'))} de votre marge de crédit de ${argentRond(n(p, 'limite'))}. C’est un outil pour les creux temporaires; si elle sert à couvrir des pertes chaque mois, il faut revoir le modèle d’affaires.`,
  banquiereCroissance: () =>
    'Six mois rentables d’affilée, bravo. Si vous pensez à grandir — une deuxième succursale, par exemple —, sachez que votre dossier est maintenant intéressant pour la Caisse. Préparez des prévisions solides.',
  banquierePlacement: (p) =>
    `Vous avez ${argentRond(n(p, 'encaisse'))} qui dort dans votre compte. Une partie pourrait être placée à court terme (F), tout en gardant un coussin pour les imprévus.`,
  comptableTaxes: () =>
    'Urgent : tu as dépassé 30 000 $ de ventes taxables. Il faut t’inscrire à la TPS et à la TVQ tout de suite (J). Chaque vente faite sans percevoir les taxes, c’est toi qui vas les payer de ta poche.',
  comptableReleves: () =>
    'Nouvelle année, nouvelles obligations : les relevés T4 et RL-1 de tes employés doivent être remis avant la fin de février. Je m’en occupe, mais garde tes registres de paie en ordre.',
  comptableImpots: () =>
    'C’est la saison des impôts! En entreprise individuelle, ta déclaration est due le 15 juin, mais le solde d’impôt doit être payé au plus tard le 30 avril. Pour une société, c’est six mois après la fin de l’exercice.',
  comptableIncorporation: () =>
    'Ton bénéfice dépasse 70 000 $ par année. À ce niveau, l’incorporation commence à être intéressante : impôt des sociétés plus bas sur ce que tu laisses dans l’entreprise, et responsabilité limitée. Regarde le comparatif dans Juridique (J).',
  rivalFerme: (p) =>
    `C’est… c’est fini pour ${s(p, 'nom')}. J’ai dû fermer. Tu avais raison sur au moins une chose : on ne peut pas vendre à perte indéfiniment. Bonne chance.`,
  rivalCopie: (p) =>
    `Ton idée était bonne, je l’avoue. C’est pour ça qu’on l’offre maintenant chez ${s(p, 'nom')}. En affaires, une bonne idée ne reste jamais secrète bien longtemps.`,
  rivalPrix: (p) =>
    `On vient de baisser nos prix chez ${s(p, 'nom')}. On verra combien de temps tu peux suivre…`,
  rivalJaloux: (p) =>
    `Tu me voles des clients, on dirait. Profites-en : chez ${s(p, 'nom')}, on prépare quelque chose.`,
  fournisseurRupture: () =>
    'Tes clients repartent les mains vides parce que tu manques de stock. Augmente ton point de commande ou ton stock de sécurité (O) : je peux te livrer plus souvent si tu commandes plus tôt.',
  fournisseurVolume: () =>
    'Tes commandes ont bien augmenté depuis un an! À partir d’un certain volume, on offre des rabais à nos clients PME. Continue comme ça.',
};

export const NOMS_PALIERS: Record<string, string> = {
  petite: 'Petite entreprise',
  pme: 'PME',
  grande: 'Grande entreprise',
};
