/** Textes des messages liés à la fiscalité et au juridique (Jalon 2). */
import { argent, argentRond } from './format';

type Params = Record<string, number | string>;
const n = (p: Params, cle: string): number => Number(p[cle] ?? 0);
const s = (p: Params, cle: string): string => String(p[cle] ?? '');

const NOMS_FORMES: Record<string, string> = {
  'inc-qc': 'société par actions du Québec',
  'inc-federal': 'société par actions fédérale',
};

export const MESSAGES_JALON2: Record<string, (p: Params) => { titre: string; texte: string }> = {
  incorporationEffectuee: (p) => ({
    titre: `Ton entreprise est maintenant une ${NOMS_FORMES[s(p, 'forme')] ?? 'société par actions'}`,
    texte:
      'Ton capital a été converti en actions. Tu ne fais plus de prélèvements : tu te paies par un salaire ou des dividendes (Finance et Juridique). La société paie maintenant son propre impôt.',
  }),
  sinistreNonAssure: (p) => ({
    titre: `Sinistre non assuré : ${argentRond(n(p, 'montant'))}`,
    texte: 'Un dégât d’eau ou une réclamation d’un client a dû être payé par l’entreprise, faute d’assurance. Une assurance coûte peu par mois comparé à ce risque.',
  }),
  demarcheDecouverte: (p) => ({
    titre: `Contrôle : ${s(p, 'nom')}`,
    texte: `${s(p, 'organisme')} a constaté que cette démarche n’avait pas été faite. Amende de ${argentRond(n(p, 'amende'))}${
      n(p, 'jours') > 0 ? ` et fermeture forcée de ${n(p, 'jours')} jours` : ''
    }. La démarche a été régularisée.`,
  }),
  cotisationTaxes: (p) => ({
    titre: `Avis de cotisation de Revenu Québec : ${argentRond(n(p, 'montant'))}`,
    texte: `Tu as fait ${argentRond(n(p, 'ventes'))} de ventes sans percevoir la TPS et la TVQ alors que l’inscription était obligatoire. Tu dois payer ces taxes de ta poche, avec une pénalité et des intérêts. Ton entreprise est maintenant inscrite.`,
  }),
  seuilTaxesDepasse: (p) => ({
    titre: 'Seuil du petit fournisseur dépassé : inscris-toi à la TPS et à la TVQ',
    texte: `Tes ventes taxables des 12 derniers mois atteignent ${argentRond(n(p, 'ventes'))}, plus que 30 000 $. L’inscription est obligatoire (Juridique, touche J). Chaque vente sans taxes te coûtera 14,975 % si Revenu Québec le découvre.`,
  }),
  inscriptionTaxesRequise: (p) => ({
    titre: 'Tu n’es toujours pas inscrit à la TPS et à la TVQ',
    texte: `Ventes faites sans percevoir les taxes obligatoires : ${argentRond(n(p, 'ventes'))}. Inscris-toi dans le département Juridique (J).`,
  }),
  remiseTaxes: (p) => ({
    titre: `Remise de TPS et de TVQ : ${argent(n(p, 'montant'))}`,
    texte: 'Tu as remis aux gouvernements les taxes perçues sur tes ventes, moins celles payées sur tes achats (CTI et RTI). Cet argent ne t’appartenait pas : garde-le de côté!',
  }),
  remboursementTaxes: (p) => ({
    titre: `Remboursement de TPS et de TVQ : ${argent(n(p, 'montant'))}`,
    texte: 'Tes CTI et RTI (taxes payées sur tes achats, comme l’équipement) dépassent les taxes perçues : les gouvernements te remboursent la différence.',
  }),
  soldeImpotPaye: (p) => ({
    titre: `Solde d’impôt de la société payé : ${argentRond(n(p, 'montant'))}`,
    texte: 'L’impôt de l’an dernier dépassait les acomptes versés. Des acomptes provisionnels mensuels évitent cette grosse sortie d’argent et les intérêts.',
  }),
  remboursementImpot: (p) => ({
    titre: `Remboursement d’impôt de la société : ${argentRond(n(p, 'montant'))}`,
    texte: 'Les acomptes versés l’an dernier dépassaient l’impôt réel.',
  }),
  dividendeVerse: (p) => ({
    titre: `Dividende versé : ${argentRond(n(p, 'montant'))}`,
    texte: 'Un dividende n’est pas une dépense de la société : il est payé à même les bénéfices après impôt et réduit les bénéfices non répartis. Il sera imposé dans ta déclaration personnelle.',
  }),
  rappelMajAnnuelle: (p) => ({
    titre: `Rappel : déclaration de mise à jour annuelle ${s(p, 'annee')} au REQ`,
    texte: 'Tu dois la produire avant la fin de juin (département Juridique). En retard, une pénalité de 50 % des droits s’ajoute.',
  }),
  majAnnuelleEnRetard: (p) => ({
    titre: `Déclaration annuelle ${s(p, 'annee')} produite en retard`,
    texte: `Le Registraire des entreprises a imposé une pénalité de ${argent(n(p, 'penalite'))}. Une entreprise qui néglige ses déclarations peut même être radiée d’office du registre.`,
  }),
  declarationsSociete: (p) => ({
    titre: `Déclarations de revenus ${s(p, 'annee')} de la société (T2 et CO-17)`,
    texte: `Revenu fiscal : ${argentRond(n(p, 'revenu'))}. Impôt de la société : ${argentRond(n(p, 'impot'))}. ${n(p, 'feuillets')} relevé(s) T4 et RL-1 produit(s). Détails dans le département Juridique (J).`,
  }),
  declarationsPersonnelles: (p) => ({
    titre: `Déclarations de revenus ${s(p, 'annee')} (T1 et TP-1)`,
    texte: `Ton revenu d’entreprise fiscal : ${argentRond(n(p, 'revenu'))}. Impôt et cotisations estimés : ${argentRond(n(p, 'impot'))}, payables de ta poche d’ici le 30 avril : prévois-les dans tes prélèvements. ${n(p, 'feuillets')} relevé(s) T4 et RL-1 produit(s).`,
  }),
  failliteSociete: () => ({
    titre: 'Faillite de la société',
    texte: 'Trois mois de suite à découvert : la société cesse ses activités. Grâce à la responsabilité limitée, tes biens personnels sont protégés… sauf si tu as signé une caution personnelle pour le prêt, ce que les banques exigent presque toujours des petites sociétés.',
  }),
};
