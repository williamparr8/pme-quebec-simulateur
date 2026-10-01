/** Textes des messages liés aux départements complets (Jalon 3). */
import { argent, argentRond, nombre, pourcentage } from './format';

type Params = Record<string, number | string>;
const n = (p: Params, cle: string): number => Number(p[cle] ?? 0);
const s = (p: Params, cle: string): string => String(p[cle] ?? '');

export const MESSAGES_JALON3: Record<string, (p: Params) => { titre: string; texte: string }> = {
  produitSucces: (p) => ({
    titre: `Lancement réussi : ${s(p, 'nom')}`,
    texte:
      'Ton nouveau produit plaît : il augmente ton panier moyen et la variété de ta gamme attire des clients. Surveille sa marge et son stock (O).',
  }),
  produitEchec: (p) => ({
    titre: `Lancement décevant : ${s(p, 'nom')}`,
    texte:
      'Le produit n’a pas trouvé son public. C’est le risque de l’innovation : une étude de marché (groupe de discussion) aurait pu t’aider à choisir. Tu peux le retirer de ta gamme (M).',
  }),
  traiteurOuvert: () => ({
    titre: 'Ton service de traiteur est prêt',
    texte:
      'Des entreprises lanceront des appels d’offres. Soumissionne dans le département Ventes (V) : attention aux délais de paiement et à la cote de crédit des clients.',
  }),
  soumissionGagnee: (p) => ({
    titre: `Contrat gagné : ${s(p, 'client')}`,
    texte: `Ta soumission à ${argent(n(p, 'prix'))} par boîte a été retenue. Tu factureras chaque mois; le client paiera plus tard (comptes clients).`,
  }),
  soumissionPerdue: (p) => ({
    titre: `Soumission perdue : ${s(p, 'client')}`,
    texte: `Un concurrent a offert un meilleur prix ou une meilleure réputation que ta soumission à ${argent(n(p, 'prix'))}.`,
  }),
  contratAnnule: (p) => ({
    titre: `${s(p, 'client')} annule son contrat`,
    texte:
      'Tu n’as pas livré toutes les boîtes promises ou la qualité a déçu. Avant de signer un contrat, assure-toi d’avoir la capacité en cuisine et les stocks.',
  }),
  contratTermine: (p) => ({
    titre: `Contrat terminé : ${s(p, 'client')}`,
    texte: 'Le contrat est arrivé à échéance. Surveille les prochains appels d’offres (V).',
  }),
  clientEnRetard: (p) => ({
    titre: `${s(p, 'client')} paie en retard`,
    texte:
      'Une facture est échue mais n’est pas payée. Un retard augmente le risque de mauvaise créance : relance le client, et évite d’accorder plus de crédit aux clients à risque.',
  }),
  creanceIrrecouvrable: (p) => ({
    titre: `Mauvaise créance : ${argentRond(n(p, 'montant'))}`,
    texte: `${s(p, 'client')} ne paiera jamais. Ses factures sont radiées (créance irrécouvrable, une charge); la TPS et la TVQ facturées sont récupérées. Une vente à crédit n’est vraiment gagnée qu’une fois encaissée.`,
  }),
  appelsOffres: (p) => ({
    titre: `${nombre(n(p, 'n'))} appel${n(p, 'n') > 1 ? 's' : ''} d’offres d’entreprises`,
    texte: 'Dépose tes soumissions avant la fin du mois dans le département Ventes (V).',
  }),
  tauxVariableAjuste: (p) => ({
    titre: 'Tes prêts à taux variable changent de taux',
    texte: `Le taux préférentiel est maintenant de ${pourcentage(n(p, 'prime'), 2)} : le versement mensuel de tes prêts à taux variable a été recalculé.`,
  }),
  placementEchu: (p) => ({
    titre: `Certificat de placement échu : ${argentRond(n(p, 'montant'))}`,
    texte:
      'Le capital est revenu dans ton encaisse. Tu peux le replacer (F) ou le garder pour tes besoins.',
  }),
  nouveauDilemme: (p) => ({
    titre: `À décider : ${s(p, 'titre')}`,
    texte:
      'Une situation demande ta décision avant la fin du prochain mois (tableau de bord ou RH).',
  }),
  dilemmeNonTranche: (p) => ({
    titre: `Sans décision de ta part : ${s(p, 'titre')}`,
    texte: `Le choix par défaut s’est appliqué (« ${s(p, 'choix')} »). Ne rien décider, c’est aussi décider.`,
  }),
  plainteCNT: (p) => ({
    titre: `Plainte à la CNESST : ${argentRond(n(p, 'montant'))}`,
    texte:
      'Un employé a porté plainte pour non-respect de la Loi sur les normes du travail. L’entreprise doit payer les sommes dues et une pénalité. Ces normes sont d’ordre public : on ne peut pas y renoncer.',
  }),
  plainteCongediement: (p) => ({
    titre: `Plainte pour congédiement : ${argentRond(n(p, 'montant'))}`,
    texte:
      'Un ancien employé a contesté son congédiement sans avertissements préalables. Un règlement a été négocié. La discipline progressive et la documentation protègent l’employeur.',
  }),
  plainteHarcelement: (p) => ({
    titre: `Plainte pour harcèlement : ${argentRond(n(p, 'montant'))}`,
    texte:
      'L’employeur n’a pas fait cesser une situation de harcèlement. Il doit avoir une politique de prévention et intervenir, même quand le harceleur est un client.',
  }),
  infractionHygiene: (p) => ({
    titre: `Constat d’infraction du MAPAQ : ${argentRond(n(p, 'amende'))}`,
    texte:
      'Lors d’une inspection, aucune personne formée en hygiène et salubrité alimentaires n’était responsable. La formation de gestionnaire a été suivie d’urgence.',
  }),
  majAnnuelleAuto: (p) => ({
    titre: `Déclaration annuelle ${s(p, 'annee')} produite par ton commis comptable`,
    texte:
      'Ton commis comptable s’occupe des obligations du Registraire des entreprises : aucune pénalité de retard.',
  }),
  candidatsRecus: (p) => ({
    titre: `${nombre(n(p, 'n'))} candidature${n(p, 'n') > 1 ? 's' : ''} pour le poste de ${s(p, 'poste').toLowerCase()}`,
    texte:
      'Consulte les candidats dans le département RH (R) : ils ne resteront pas disponibles longtemps.',
  }),
  aucunCandidat: (p) => ({
    titre: `Aucun candidat pour le poste de ${s(p, 'poste').toLowerCase()}`,
    texte:
      'La pénurie de main-d’œuvre se fait sentir. Essaie une autre plateforme, un meilleur salaire ou une agence de placement.',
  }),
  syndicatAccredite: () => ({
    titre: 'Tes employés se sont syndiqués',
    texte:
      'Après des mois de moral très bas, la majorité des employés a signé une carte d’adhésion et le Tribunal administratif du travail a accrédité le syndicat. La première convention collective hausse les salaires de 5 %. L’employeur ne peut pas s’ingérer dans la formation d’un syndicat.',
  }),
  sansCuisinier: (p) => ({
    titre: `Sans cuisinier : ${nombre(n(p, 'perdues'))} plats non vendus`,
    texte:
      'Ton équipe au comptoir n’arrive pas à préparer tous les repas, et la qualité en souffre. Un cuisinier (R) augmente la capacité de la cuisine.',
  }),
  cuisineInsuffisante: (p) => ({
    titre: `Cuisine débordée : ${nombre(n(p, 'perdues'))} plats non vendus`,
    texte:
      'La demande de repas dépasse la capacité de ta cuisine. Ajoute des heures de cuisinier ou d’aide-cuisinier, ou limite les contrats de traiteur.',
  }),
  pertesPeremption: (p) => ({
    titre: `Produits périmés : ${argentRond(n(p, 'montant'))}`,
    texte: `Tu as jeté l’équivalent de ${pourcentage(n(p, 'pct'), 1)} du coût de tes ventes. Commande plus souvent en plus petites quantités, ou choisis des produits qui se conservent plus longtemps (O).`,
  }),
  defautsEleves: (p) => ({
    titre: `Taux de défauts élevé : ${pourcentage(n(p, 'taux'), 1)}`,
    texte: `${nombre(n(p, 'plaintes'))} plaintes ce mois-ci. Équipe surchargée, peu formée ou équipement usé : forme ton personnel (R) ou réduis la surcharge.`,
  }),
  previsionJuste: (p) => ({
    titre: 'Ta prévision était juste',
    texte: `Ventes prévues : ${argentRond(n(p, 'prevu'))}; réelles : ${argentRond(n(p, 'reel'))}. Bénéfice prévu : ${argentRond(n(p, 'beneficePrevu'))}; réel : ${argentRond(n(p, 'beneficeReel'))}.`,
  }),
  previsionEcart: (p) => ({
    titre: `Écart de ${pourcentage(Math.abs(n(p, 'ecart')))} entre le prévu et le réel`,
    texte: `Ventes prévues : ${argentRond(n(p, 'prevu'))}; réelles : ${argentRond(n(p, 'reel'))}. Bénéfice prévu : ${argentRond(n(p, 'beneficePrevu'))}; réel : ${argentRond(n(p, 'beneficeReel'))}. Cherche la cause de l’écart (saison, prix, concurrence, capacité) : c’est le rôle du contrôle budgétaire.`,
  }),
  cacSuperieurClv: (p) => ({
    titre: 'Acquérir un client coûte plus qu’il ne rapporte',
    texte: `Coût d’acquisition : ${argent(n(p, 'cac'))}; valeur à vie d’un client : ${argent(n(p, 'clv'))}. Réduis ou réoriente ta publicité, ou améliore la fidélité.`,
  }),
  livraisonCapacite: (p) => ({
    titre: 'La livraison occupe une équipe déjà débordée',
    texte: `Tu as vendu ${argentRond(n(p, 'livraison'))} en livraison, mais ${nombre(n(p, 'perdues'))} clients sont repartis faute de personnel. Une commande livrée rapporte moins qu’une vente au comptoir (commission de 30 %) : la livraison est rentable quand il te reste de la capacité.`,
  }),
  absenteismeEleve: (p) => ({
    titre: `Absentéisme élevé : ${pourcentage(n(p, 'taux'), 1)}`,
    texte:
      'Des employés démotivés s’absentent davantage : ta capacité diminue. Le moral, les avantages sociaux et la reconnaissance réduisent l’absentéisme.',
  }),
};
