/** Textes des messages du monde vivant (Jalon 4) : conjoncture, concurrents, événements. */
import { argentRond, nombre, pourcentage } from './format';

type Params = Record<string, number | string>;
const n = (p: Params, cle: string): number => Number(p[cle] ?? 0);
const s = (p: Params, cle: string): string => String(p[cle] ?? '');

/** Nom des phases du cycle économique. */
export const PHASES_TEXTE: Record<string, { nom: string; explication: string }> = {
  expansion: {
    nom: 'Expansion',
    explication:
      'L’économie croît : les ménages dépensent plus, mais le chômage baisse et il devient difficile de recruter. L’inflation et les taux d’intérêt ont tendance à monter.',
  },
  stable: {
    nom: 'Croissance stable',
    explication: 'L’économie croît à un rythme normal : la demande suit surtout la saison.',
  },
  ralentissement: {
    nom: 'Ralentissement',
    explication:
      'La croissance ralentit : les ménages deviennent prudents et comparent davantage les prix. Les achats non essentiels (meubles, vêtements) baissent en premier.',
  },
  recession: {
    nom: 'Récession',
    explication:
      'L’économie recule : le chômage monte, la confiance chute et les ventes baissent, surtout dans les secteurs cycliques. La Banque du Canada baisse souvent son taux directeur. Une trésorerie solide fait la différence.',
  },
  reprise: {
    nom: 'Reprise',
    explication:
      'L’économie repart lentement après une récession : la confiance revient et le chômage commence à baisser.',
  },
};

const IDEES: Record<string, string> = {
  livraison: 'la livraison par plateforme',
  fidelite: 'un programme de fidélité',
  eco: 'des initiatives écoresponsables',
  produits: 'une gamme élargie de produits',
};

const RISQUES: Record<string, string> = {
  moisissures:
    'L’humidité laissée par le dégât d’eau a causé de la moisissure : il a fallu décontaminer et fermer quelques jours. Un nettoyage professionnel aurait coûté moins cher.',
  fauxAvisDecouverts:
    'La plateforme a détecté les faux avis : ils ont été retirés, ta fiche affiche un avertissement et ta réputation en souffre. Acheter des avis est une pratique commerciale trompeuse.',
  amendeOqlf:
    'L’OQLF a constaté que la situation n’était pas corrigée : l’entreprise reçoit une amende et doit quand même corriger son affichage.',
  accidentNonDeclare:
    'L’accident non déclaré a été découvert (l’employé a dû consulter et a porté plainte). L’entreprise paie une amende et le climat de travail se dégrade.',
  poursuiteClient:
    'La cliente a poursuivi l’entreprise aux petites créances et a eu gain de cause. Ignorer une mise en demeure coûte souvent plus cher que de négocier.',
  avisCnesst:
    'L’inspecteur est revenu : les corrections n’étaient pas terminées. L’entreprise reçoit un constat d’infraction.',
  loi25Sanction:
    'La fuite de renseignements personnels a été rendue publique et la Commission d’accès à l’information a imposé une sanction. Les clients ont perdu confiance.',
  amendeOpc:
    'L’Office de la protection du consommateur a donné raison au client : la publicité était trompeuse. L’entreprise paie une amende.',
  evasionDecouverte:
    'Revenu Québec a recoupé tes ventes (dépôts bancaires, achats, ratios du secteur) : cotisation des taxes et de l’impôt éludés, pénalité de 50 % et intérêts. L’évasion fiscale ne paie pas.',
  syndicatApresRefus:
    'Après le refus de leur demande, les employés se sont tournés vers un syndicat.',
  rappelIgnore:
    'Un client a été malade après avoir mangé un produit rappelé. L’entreprise reçoit une amende et sa réputation est touchée.',
};

export const MESSAGES_JALON4: Record<string, (p: Params) => { titre: string; texte: string }> = {
  phaseEconomique: (p) => ({
    titre: `Conjoncture : ${PHASES_TEXTE[s(p, 'phase')]?.nom ?? s(p, 'phase')}`,
    texte: `${PHASES_TEXTE[s(p, 'phase')]?.explication ?? ''} Taux de chômage au Québec : ${pourcentage(n(p, 'chomage'), 1)}.`,
  }),
  concurrentArrive: (p) => ({
    titre: `Nouveau concurrent : ${s(p, 'nom')}`,
    texte:
      'Un nouveau joueur financé par du capital de risque ouvre ses portes. Il accepte de perdre de l’argent pour gagner des clients : attends-toi à beaucoup de publicité et à des prix agressifs (V : veille concurrentielle).',
  }),
  concurrentFaillite: (p) => ({
    titre: `${s(p, 'nom')} ferme ses portes`,
    texte:
      'Ce concurrent a épuisé sa trésorerie. Ses clients vont chercher un autre commerce : c’est une occasion de gagner des parts de marché.',
  }),
  concurrentRachete: (p) => ({
    titre: `${s(p, 'acheteur')} rachète ${s(p, 'nom')}`,
    texte:
      'En difficulté, ce concurrent a été racheté par la grande chaîne, qui devient encore plus présente dans le marché (concentration).',
  }),
  concurrentCopie: (p) => ({
    titre: `${s(p, 'nom')} copie ton idée`,
    texte: `Ce concurrent offre maintenant ${IDEES[s(p, 'idee')] ?? 'une idée semblable à la tienne'}. Une bonne idée facile à copier ne reste pas longtemps un avantage concurrentiel : il faut innover sans cesse.`,
  }),
  concurrentClientele: (p) => ({
    titre: `Tu as racheté la clientèle de ${s(p, 'nom')}`,
    texte: 'Ce concurrent ferme et une partie de ses clients te connaît maintenant.',
  }),
  sansProducteur: (p) => ({
    titre: `${s(p, 'production')} : ${nombre(n(p, 'perdues'))} unités non vendues`,
    texte:
      'Personne de ton équipe n’est affecté à la production : la capacité est très faible et la qualité en souffre. Embauche un employé de production (R).',
  }),
  productionInsuffisante: (p) => ({
    titre: `${s(p, 'production')} débordé : ${nombre(n(p, 'perdues'))} unités non vendues`,
    texte: `Ton équipe disposait d’environ ${nombre(n(p, 'heures'))} heures de production, mais la demande en exigeait ${nombre(n(p, 'demandees'))}. Ajoute des heures ou des employés de production (R), investis dans l’équipement (F) ou limite les contrats aux entreprises.`,
  }),
  b2bOuvert: (p) => ({
    titre: `Ventes aux entreprises : ${s(p, 'nom')}`,
    texte:
      'Des entreprises lanceront des appels d’offres. Soumissionne dans le département Ventes (V) : attention aux délais de paiement et à la cote de crédit des clients.',
  }),
  stockPerdu: (p) => ({
    titre: `Stock perdu : ${argentRond(n(p, 'montant'))}`,
    texte:
      'Une partie de tes marchandises a été perdue. Cette perte réduit ton bénéfice (pertes sur stocks).',
  }),
  fournisseurFaillite: (p) => ({
    titre: `${s(p, 'nom')} a fait faillite`,
    texte: `Tes commandes passent maintenant chez ${s(p, 'remplacant') || 'un autre fournisseur'}. Vérifie les prix, les délais et les conditions dans Opérations (O).`,
  }),
  embaucheEvenement: (p) => ({
    titre: `Nouvel employé : ${s(p, 'nom')}`,
    texte: `${s(p, 'nom')} se joint à l’équipe (${s(p, 'poste')}). Ajuste ses heures au besoin (R).`,
  }),
  recouvrement: (p) => ({
    titre: `Recouvrement : ${s(p, 'client')}`,
    texte: `L’agence a récupéré ${argentRond(n(p, 'recu'))}; ${argentRond(n(p, 'perte'))} sont perdus (créance irrécouvrable et commission).`,
  }),
  venteEntreprise: (p) => ({
    titre: `Tu as vendu ton entreprise pour ${argentRond(n(p, 'prix'))}`,
    texte:
      'La partie se termine. Le prix a été fixé à partir de la rentabilité de l’entreprise (un multiple de son bénéfice) et de la valeur de ses actifs.',
  }),
  ...Object.fromEntries(
    Object.entries(RISQUES).map(([code, texte]) => [
      code,
      (p: Params) => ({
        titre: `Conséquence d’une décision passée : ${argentRond(n(p, 'montant'))}`,
        texte,
      }),
    ]),
  ),
};
