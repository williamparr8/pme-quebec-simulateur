/** Textes du Jalon 5 : conseillère, rapport de fin, scénarios et classement. */
import { demarche } from '../engine/conformite';
import type { Departement, DecisionMarquante, Mention, TypeDecision } from '../engine/bilan';
import type { TypeObjectif } from '../engine/data-types';
import { argentRond, decimal, nombre, pourcentage } from './format';

type Params = Record<string, number | string>;
const n = (p: Params, cle: string): number => Number(p[cle] ?? 0);
const s = (p: Params, cle: string): string => String(p[cle] ?? '');

/** La mentore du conseiller virtuel (personnage fictif). */
export const MENTORE = {
  nom: 'Monique Gagnon',
  role: 'mentore bénévole, ancienne propriétaire de commerce',
};

export const MESSAGES_JALON5: Record<string, (p: Params) => { titre: string; texte: string }> = {
  conseilDefaut: (p) => ({
    titre: 'Ta survie est en jeu',
    texte: `Ça fait ${n(p, 'mois')} mois que tu ne peux plus payer tes dettes à temps. Au 3e mois, c’est la faillite. Coupe les dépenses non essentielles, injecte des fonds (F) ou négocie avec la banque. Ne laisse pas filer un mois de plus.`,
  }),
  conseilPrixSousCout: (p) => ({
    titre: `Tu vends ${s(p, 'ligne').toLowerCase()} à perte`,
    texte: `Ton prix (${argentRond(n(p, 'prix'))}) couvre à peine ce que te coûte la marchandise (${argentRond(n(p, 'cout'))}), sans compter le loyer ni les salaires. Plus tu en vends, plus tu perds. Monte le prix ou change de fournisseur ou de qualité (M, O).`,
  }),
  conseilDemarche: (p) => ({
    titre: `Démarche oubliée : ${demarche(s(p, 'demarche') as never).nom}`,
    texte:
      'C’est obligatoire pour ton entreprise. Tant que ce n’est pas réglé, tu risques une amende ou même une fermeture. Va dans Juridique et fiscalité (J) pour régulariser.',
  }),
  conseilInscriptionTaxes: () => ({
    titre: 'Inscris-toi aux taxes maintenant',
    texte:
      'Tu as dépassé le seuil de 30 000 $ : tu n’es plus un petit fournisseur. Chaque vente faite sans percevoir la TPS et la TVQ, tu devras quand même les remettre de ta poche. Inscris-toi dans Juridique et fiscalité (J).',
  }),
  conseilSeuilTaxes: (p) => ({
    titre: 'Tu approches du seuil des taxes',
    texte: `Tes ventes taxables des 12 derniers mois atteignent ${argentRond(n(p, 'ventes'))}. À 30 000 $, l’inscription à la TPS et à la TVQ devient obligatoire. Prépare-toi : tes prix affichés devront inclure les taxes en plus.`,
  }),
  conseilMargeCredit: (p) => ({
    titre: 'Ta marge de crédit est presque au maximum',
    texte: `Tu utilises ${argentRond(n(p, 'utilisee'))} sur ${argentRond(n(p, 'limite'))}. Au-delà, tu ne pourras plus payer tes fournisseurs ni ta paie. Une marge de crédit sert aux creux temporaires, pas à couvrir des pertes chaque mois.`,
  }),
  conseilTresorerie: (p) => ({
    titre: 'Ton coussin de liquidités est mince',
    texte: `Tu as ${argentRond(n(p, 'encaisse'))} en banque, alors que tes dépenses du mois dernier ont atteint ${argentRond(n(p, 'charges'))}. Un imprévu (bris, client qui ne paie pas) pourrait te mettre dans le rouge. Vise au moins un mois de dépenses en réserve.`,
  }),
  conseilMargeBrute: (p) => ({
    titre: 'Ta marge brute est faible',
    texte: `Ta marge brute est à ${pourcentage(n(p, 'marge'), 0)}, alors que la moyenne du secteur se situe entre ${pourcentage(n(p, 'min'), 0)} et ${pourcentage(n(p, 'max'), 0)}. Vérifie ton prix ou ton coût des marchandises (fournisseur, qualité, pertes).`,
  }),
  conseilMainOeuvre: (p) => ({
    titre: 'Ta main-d’œuvre coûte cher par rapport à tes ventes',
    texte: `Les salaires représentent ${pourcentage(n(p, 'taux'), 0)} de tes ventes (le secteur vise ${pourcentage(n(p, 'max'), 0)} au plus). Ajuste les horaires aux heures achalandées ou augmente tes ventes avant d’embaucher encore.`,
  }),
  conseilCapacite: (p) => ({
    titre: 'Tu refuses des clients',
    texte: `${pourcentage(n(p, 'pct'), 0)} des clients sont repartis faute de personnel ou de place. C’est de l’argent laissé sur la table, et des clients déçus qui ne reviendront peut-être pas. Ajoute des heures ou du personnel (R, O).`,
  }),
  conseilRuptures: (p) => ({
    titre: 'Tes tablettes sont vides trop souvent',
    texte: `${pourcentage(n(p, 'pct'), 0)} des ventes ont été perdues à cause de ruptures de stock. Augmente ton stock de sécurité ou ton point de commande (O).`,
  }),
  conseilPrixEleve: (p) => ({
    titre: 'Tes prix sont parmi les plus élevés',
    texte: `Ton indice de prix est de ${decimal(n(p, 'indice'), 2)} (1 = prix du marché) et ta part de marché reste petite. Un prix élevé doit se justifier par une meilleure qualité, un meilleur service ou une marque forte.`,
  }),
  conseilPrixBas: (p) => ({
    titre: 'Tes prix sont bas',
    texte: `Ton indice de prix est de ${decimal(n(p, 'indice'), 2)}. Vendre moins cher attire des clients, mais réduit ta marge sur chaque vente. Assure-toi que le volume additionnel compense vraiment.`,
  }),
  conseilNotoriete: (p) => ({
    titre: 'Peu de gens te connaissent',
    texte: `Seulement ${pourcentage(n(p, 'notoriete'), 0)} des clients potentiels connaissent ton commerce, et ton budget de publicité est faible. On n’achète pas chez quelqu’un qu’on ne connaît pas : investis un peu en publicité (M).`,
  }),
  conseilMoral: (p) => ({
    titre: 'Ton équipe est démotivée',
    texte: `Le moral moyen est à ${nombre(n(p, 'moral'))}/100. Un moral bas mène aux absences, aux erreurs et aux démissions, qui coûtent cher. Regarde les salaires, les horaires, la formation et les avantages (R).`,
  }),
  conseilHeuresSup: (p) => ({
    titre: 'Heures supplémentaires',
    texte: `${n(p, 'n')} employé${n(p, 'n') > 1 ? 's travaillent' : ' travaille'} plus de 40 heures par semaine. Ces heures se paient à 150 %, et la fatigue use le moral. Une embauche à temps partiel coûte parfois moins cher.`,
  }),
  conseilDilemmes: (p) => ({
    titre: `${n(p, 'n')} décision${n(p, 'n') > 1 ? 's t’attendent' : ' t’attend'}`,
    texte:
      'Prends le temps de lire les choix : sans réponse, le choix par défaut s’appliquera à la fin du mois.',
  }),
  conseilQuiz: () => ({
    titre: 'Quiz du trimestre',
    texte:
      'Un petit quiz de 3 questions t’attend au tableau de bord. Chaque bonne réponse te donne 10 % de rabais sur ta prochaine formation ou étude de marché.',
  }),
  conseilBravo: () => ({
    titre: 'Trois mois rentables de suite',
    texte:
      'Bravo! Ton entreprise est rentable depuis trois mois. C’est le moment de bâtir une réserve de liquidités et de penser à la suite : investir, former ton équipe ou rembourser ta dette.',
  }),
  conseilRien: () => ({
    titre: 'Rien d’urgent',
    texte:
      'Je ne vois rien d’alarmant. Profites-en pour regarder tes ratios (F) ou faire une étude de marché (M) : les meilleures décisions se prennent quand tout va bien.',
  }),
};

export const DEPARTEMENTS_TEXTE: Record<Departement, string> = {
  marketing: 'Marketing',
  rh: 'Ressources humaines',
  operations: 'Opérations',
  finance: 'Finance',
  conformite: 'Juridique et fiscalité',
};

export const MENTIONS: Record<Mention, string> = {
  excellent: 'Excellent',
  tresBien: 'Très bien',
  bien: 'Bien',
  passable: 'Passable',
  aRetravailler: 'À retravailler',
};

const NOMS_QUALITE: Record<string, string> = {
  economique: 'économique',
  standard: 'standard',
  superieure: 'supérieure',
  artisanale: 'artisanale',
};

/** Description d'une décision marquante. */
export function titreDecision(d: DecisionMarquante): string {
  const p = d.params;
  const textes: Record<TypeDecision, string> = {
    prixHausse: `Hausse des prix (${pourcentage(n(p, 'pct'), 0)})`,
    prixBaisse: `Baisse des prix (${pourcentage(n(p, 'pct'), 0)})`,
    qualite: `Qualité : ${NOMS_QUALITE[s(p, 'de')] ?? s(p, 'de')} → ${NOMS_QUALITE[s(p, 'a')] ?? s(p, 'a')}`,
    publiciteHausse: `Publicité augmentée de ${argentRond(n(p, 'de'))} à ${argentRond(n(p, 'a'))} par mois`,
    publiciteBaisse: `Publicité réduite de ${argentRond(n(p, 'de'))} à ${argentRond(n(p, 'a'))} par mois`,
    heuresHausse: `Heures d’ouverture prolongées (${nombre(n(p, 'de'))} h → ${nombre(n(p, 'a'))} h)`,
    heuresBaisse: `Heures d’ouverture réduites (${nombre(n(p, 'de'))} h → ${nombre(n(p, 'a'))} h)`,
    embauche: `Embauche de ${n(p, 'n')} employé${n(p, 'n') > 1 ? 's' : ''}`,
    promotion: 'Lancement d’une promotion',
    fidelite: 'Lancement du programme de fidélité',
    livraison: 'Ajout de la livraison',
    eco: 'Initiatives écoresponsables',
    investissement: 'Investissement dans un nouvel actif',
    emprunt: 'Nouvel emprunt',
    nouveauProduit: 'Lancement d’un nouveau produit',
  };
  return textes[d.type];
}

/** Explication pédagogique de l'effet observé. */
export function leconDecision(d: DecisionMarquante): string {
  const bon = d.effet > 0;
  const textes: Record<TypeDecision, [string, string]> = {
    prixHausse: [
      'Tes clients ont accepté la hausse : la marge gagnée sur chaque vente a plus que compensé les quelques clients perdus. La demande était peu sensible au prix.',
      'Des clients sont partis chez des concurrents moins chers. Une hausse de prix fait perdre des ventes quand la qualité ou le service ne la justifient pas.',
    ],
    prixBaisse: [
      'Le volume additionnel a compensé la marge plus mince sur chaque vente : tes clients étaient sensibles au prix.',
      'Tu as vendu plus, mais chaque vente rapportait moins : le volume n’a pas compensé la marge perdue.',
    ],
    qualite: [
      'Les clients ont remarqué la différence : meilleure satisfaction, meilleurs avis et plus de ventes.',
      'Le changement de qualité n’a pas payé : soit les coûts ont trop monté, soit les clients ont perçu une baisse.',
    ],
    publiciteHausse: [
      'Ta publicité a attiré assez de nouveaux clients pour se payer : chaque dollar investi a rapporté.',
      'La publicité additionnelle a coûté plus qu’elle n’a rapporté : rendements décroissants, ou des clients attirés mais mal servis.',
    ],
    publiciteBaisse: [
      'Tu as économisé sans perdre beaucoup de clients : ta notoriété et tes avis suffisaient à les attirer.',
      'Moins de publicité, moins de nouveaux clients : la notoriété s’érode vite quand on cesse de communiquer.',
    ],
    heuresHausse: [
      'Les heures ajoutées ont attiré des clients qui ne pouvaient pas venir avant.',
      'Les heures ajoutées ont surtout ajouté des salaires : peu de clients à ces moments-là.',
    ],
    heuresBaisse: [
      'Tu as coupé des heures peu achalandées : moins de salaires, presque pas de ventes perdues.',
      'Des clients trouvaient porte close : les heures coupées étaient payantes.',
    ],
    embauche: [
      'Le personnel ajouté a permis de servir plus de clients, ce qui a payé son salaire.',
      'L’embauche a ajouté des coûts sans assez de ventes supplémentaires : la demande ne justifiait pas encore ce poste.',
    ],
    promotion: [
      'La promotion a attiré assez de clients pour compenser le rabais.',
      'Le rabais a coûté plus cher que les ventes qu’il a attirées : une promotion réduit la marge de toutes les ventes, même celles qui auraient eu lieu sans elle.',
    ],
    fidelite: [
      'Tes clients reviennent plus souvent : la fidélité a augmenté la valeur à vie de chaque client.',
      'Les rabais de fidélité ont coûté plus que les visites additionnelles, du moins à court terme. La fidélité rapporte souvent plus tard.',
    ],
    livraison: [
      'La livraison t’a ouvert une nouvelle clientèle, malgré la commission de la plateforme.',
      'La commission de la plateforme de livraison a mangé ta marge sur ces ventes.',
    ],
    eco: [
      'Tes initiatives ont amélioré ton image auprès de clients prêts à payer pour des valeurs.',
      'Les initiatives écoresponsables coûtent au départ; leur effet sur l’image se bâtit lentement.',
    ],
    investissement: [
      'L’investissement a amélioré ta capacité ou ton attrait assez pour couvrir son coût.',
      'L’investissement pèse sur les résultats à court terme (amortissement, intérêts); il peut rapporter plus tard.',
    ],
    emprunt: [
      'L’argent emprunté a été bien utilisé : il a rapporté plus que les intérêts (effet de levier).',
      'Les intérêts du nouvel emprunt pèsent sur tes résultats; un emprunt doit financer quelque chose qui rapporte.',
    ],
    nouveauProduit: [
      'Le nouveau produit a trouvé ses clients et ajouté des ventes.',
      'Le nouveau produit n’a pas encore couvert ses coûts de développement et de lancement.',
    ],
  };
  return textes[d.type][bon ? 0 : 1];
}

export const OBJECTIFS_TEXTE: Record<TypeObjectif, (cible: number) => string> = {
  survie: () => 'Éviter la faillite',
  beneficeCumule: (c) =>
    c <= 0
      ? 'Terminer avec un bénéfice cumulé positif'
      : `Bénéfice cumulé d’au moins ${argentRond(c)}`,
  ventesCumulees: (c) => `Ventes cumulées d’au moins ${argentRond(c)}`,
  encaisseFinale: (c) => `Encaisse finale d’au moins ${argentRond(c)}`,
  partMarche: (c) => `Part de marché d’au moins ${pourcentage(c, 0)} (3 derniers mois)`,
  noteClients: (c) => `Note en ligne d’au moins ${decimal(c, 1)} ★`,
  satisfaction: (c) => `Satisfaction moyenne des clients d’au moins ${pourcentage(c, 0)}`,
  moral: (c) => `Moral moyen de l’équipe d’au moins ${nombre(c)}/100`,
  valeurEntreprise: (c) => `Valeur de l’entreprise d’au moins ${argentRond(c)}`,
};

/** Valeur atteinte d'un objectif, formatée. */
export function valeurObjectifTexte(type: TypeObjectif, valeur: number): string {
  switch (type) {
    case 'survie':
      return valeur >= 1 ? 'En activité' : 'Faillite';
    case 'partMarche':
    case 'satisfaction':
      return pourcentage(valeur, 1);
    case 'noteClients':
      return `${decimal(valeur, 1)} ★`;
    case 'moral':
      return `${nombre(valeur)}/100`;
    default:
      return argentRond(valeur);
  }
}
