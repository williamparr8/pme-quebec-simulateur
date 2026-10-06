/**
 * Mandats du chef de la finance et de la comptabilité. Chaque bonne réponse est recalculée à
 * partir des chiffres affichés dans les documents, pour que le calcul du joueur tombe juste.
 */
import { argent, decimal, moisAnnee, pourcentage } from '../i18n/format';
import { tauxPreferentiel } from './economy';
import { versementMensuel } from './loans';
import { arrondir, type DefinitionMandat, type LigneDocument } from './mandats-types';
import { seuilRentabilite } from './rapports';
import { Rng } from './rng';
import { bilan, etatResultats } from './statements';
import type { Entreprise, MoisArchive } from './types';
import { versCents } from './util';

const nomMois = (a: MoisArchive): string => moisAnnee(a.annee, a.mois);
const pc = (x: number): string => `${decimal(x, 1)} %`;

function extraitBilan(ent: Entreprise, derniere?: MoisArchive) {
  const b = bilan(ent.livre.soldes, derniere?.portionCouranteDette ?? 0);
  const actif = b.actifCourt.map((l) => ({ libelle: l.libelle, montant: arrondir(l.montant, 2) }));
  const passif = b.passifCourt.map((l) => ({
    libelle: l.libelle,
    montant: arrondir(l.montant, 2),
  }));
  const totalActif = arrondir(
    actif.reduce((s, l) => s + l.montant, 0),
    2,
  );
  const totalPassif = arrondir(
    passif.reduce((s, l) => s + l.montant, 0),
    2,
  );
  const lignes: LigneDocument[] = [
    ...actif.map((l) => ({
      libelle: `Actif à court terme : ${l.libelle}`,
      valeur: argent(l.montant),
    })),
    ...passif.map((l) => ({
      libelle: `Passif à court terme : ${l.libelle}`,
      valeur: argent(l.montant),
    })),
    {
      libelle: 'Actif à long terme (immobilisations et dépôts)',
      valeur: argent(b.totalActifLong),
      inutile: true,
    },
    { libelle: 'Passif à long terme (emprunts)', valeur: argent(b.totalPassifLong), inutile: true },
  ];
  return {
    totalActif,
    totalPassif,
    capitaux: b.capitaux.total,
    document: {
      titre: 'Extrait du bilan',
      provenance:
        'Soldes du grand livre en date d’aujourd’hui. La part de la dette exigible d’ici 12 mois vient du tableau d’amortissement des prêts.',
      lignes,
    },
  };
}

export const MANDATS_FINANCE: DefinitionMandat[] = [
  {
    id: 'F1',
    departement: 'finance',
    titre: 'Taux de marge brute',
    unite: 'pourcent',
    enjeu: 'faible',
    formule: 'Taux de marge brute = (ventes − coût des marchandises vendues) ÷ ventes',
    indices: [
      'La marge brute, c’est ce qui reste des ventes une fois payé ce qu’on a vendu.',
      'Ne tiens pas compte du loyer ni des salaires : ils viennent après la marge brute.',
    ],
    generer: ({ derniere }) => {
      if (!derniere) return null;
      const r = etatResultats(derniere.mouvements);
      const ventes = arrondir(r.ventes, 2);
      const cmv = arrondir(r.coutMarchandises, 2);
      if (ventes <= 0) return null;
      const attendu = arrondir(((ventes - cmv) / ventes) * 100, 1);
      return {
        question: `Quel est le taux de marge brute de ${nomMois(derniere)}? (en %, à une décimale)`,
        documents: [
          {
            titre: `État des résultats de ${nomMois(derniere)}`,
            provenance:
              'Produit par le logiciel comptable à partir des ventes enregistrées à la caisse et des factures des fournisseurs.',
            lignes: [
              { libelle: 'Ventes nettes (après rabais)', valeur: argent(ventes) },
              { libelle: 'Coût des marchandises vendues', valeur: argent(cmv) },
              {
                libelle: 'Charges d’exploitation (loyer, salaires, publicité…)',
                valeur: argent(r.totalChargesExploitation),
                inutile: true,
              },
              { libelle: 'Intérêts sur les emprunts', valeur: argent(r.interets), inutile: true },
            ],
          },
        ],
        attendu,
        corrige: [
          `Marge brute = ${argent(ventes)} − ${argent(cmv)} = ${argent(ventes - cmv)}`,
          `Taux de marge brute = ${argent(ventes - cmv)} ÷ ${argent(ventes)} = ${pc(attendu)}`,
        ],
      };
    },
  },
  {
    id: 'F2',
    departement: 'finance',
    titre: 'Seuil de rentabilité',
    unite: 'dollars',
    enjeu: 'moyen',
    formule:
      'Seuil de rentabilité = charges fixes ÷ taux de marge sur coûts variables, où taux = (ventes − charges variables) ÷ ventes',
    indices: [
      'Calcule d’abord le taux de marge sur coûts variables avec les ventes et les charges variables.',
      'Le seuil est le montant de ventes où le bénéfice est exactement de zéro.',
    ],
    generer: ({ derniere }) => {
      if (!derniere) return null;
      const s = seuilRentabilite(derniere.mouvements);
      const ventes = arrondir(s.ventes, 2);
      const variables = arrondir(ventes * (1 - s.tauxMargeContribution), 2);
      const fixes = arrondir(s.chargesFixes, 2);
      if (ventes <= 0 || ventes - variables <= 0 || fixes <= 0) return null;
      const taux = (ventes - variables) / ventes;
      const attendu = arrondir(fixes / taux, 2);
      return {
        question: `Avec les chiffres de ${nomMois(derniere)}, quel montant de ventes mensuelles faut-il pour atteindre le seuil de rentabilité?`,
        documents: [
          {
            titre: `Analyse des charges de ${nomMois(derniere)}`,
            provenance:
              'Classement fait par le commis comptable : les marchandises et les frais de cartes varient avec les ventes; le loyer, les salaires, les assurances et les honoraires sont considérés comme fixes.',
            lignes: [
              { libelle: 'Ventes nettes', valeur: argent(ventes) },
              { libelle: 'Charges variables', valeur: argent(variables) },
              { libelle: 'Charges fixes', valeur: argent(fixes) },
              {
                libelle: 'Encaisse à la fin du mois',
                valeur: argent(derniere.indicateurs.encaisse),
                inutile: true,
              },
            ],
          },
        ],
        attendu,
        corrige: [
          `Taux de marge sur coûts variables = (${argent(ventes)} − ${argent(variables)}) ÷ ${argent(ventes)} = ${pourcentage(taux, 2)}`,
          `Seuil de rentabilité = ${argent(fixes)} ÷ ${pourcentage(taux, 2)} = ${argent(attendu)}`,
        ],
      };
    },
  },
  {
    id: 'F3',
    departement: 'finance',
    titre: 'Ratio de liquidité générale',
    unite: 'ratio',
    enjeu: 'faible',
    formule: 'Ratio de liquidité générale = actif à court terme ÷ passif à court terme',
    indices: [
      'Additionne d’abord tous les postes de l’actif à court terme, puis tous ceux du passif à court terme.',
      'Au-dessus de 1, l’entreprise peut payer ses dettes des 12 prochains mois.',
    ],
    generer: ({ ent, derniere }) => {
      const x = extraitBilan(ent, derniere);
      if (x.totalPassif <= 0) return null;
      const attendu = arrondir(x.totalActif / x.totalPassif, 2);
      return {
        question: 'Quel est le ratio de liquidité générale? (à deux décimales)',
        documents: [x.document],
        attendu,
        corrige: [
          `Actif à court terme = ${argent(x.totalActif)}`,
          `Passif à court terme = ${argent(x.totalPassif)}`,
          `Ratio = ${argent(x.totalActif)} ÷ ${argent(x.totalPassif)} = ${decimal(attendu, 2)}`,
        ],
      };
    },
  },
  {
    id: 'F4',
    departement: 'finance',
    titre: 'Fonds de roulement',
    unite: 'dollars',
    enjeu: 'faible',
    formule: 'Fonds de roulement = actif à court terme − passif à court terme',
    indices: [
      'C’est le coussin qui reste après avoir payé toutes les dettes à court terme.',
      'Il peut être négatif : inscris alors un signe moins.',
    ],
    generer: ({ ent, derniere }) => {
      const x = extraitBilan(ent, derniere);
      if (x.totalPassif <= 0) return null;
      const attendu = arrondir(x.totalActif - x.totalPassif, 2);
      return {
        question: 'Quel est le fonds de roulement de l’entreprise?',
        documents: [x.document],
        attendu,
        corrige: [
          `Actif à court terme = ${argent(x.totalActif)}`,
          `Passif à court terme = ${argent(x.totalPassif)}`,
          `Fonds de roulement = ${argent(x.totalActif)} − ${argent(x.totalPassif)} = ${argent(attendu)}`,
        ],
      };
    },
  },
  {
    id: 'F5',
    departement: 'finance',
    titre: 'Versement mensuel d’un prêt',
    unite: 'dollars',
    enjeu: 'eleve',
    formule: 'Versement = C × i ÷ (1 − (1 + i)^−n), où i = taux annuel ÷ 12 et n = nombre de mois',
    indices: [
      'Convertis d’abord le taux annuel en taux mensuel (divise par 12).',
      'Sur une calculatrice : (1 + i) exposant −n, puis 1 moins ce résultat.',
    ],
    generer: ({ etat, ent }) => {
      const index = etat.moisCourant;
      const annuelles =
        ent.archives.slice(-12).reduce((s, a) => s + a.indicateurs.chiffreAffaires, 0) || 120_000;
      const capital = Math.max(10_000, Math.round((annuelles * 0.15) / 1000) * 1000);
      const taux = arrondir(tauxPreferentiel(etat.conjoncture) + 0.025, 4);
      const duree = [36, 48, 60][index % 3];
      const attendu = versementMensuel(versCents(capital), taux, duree) / 100;
      const i = taux / 12;
      return {
        question: `La banque offre un prêt de ${argent(capital)} pour acheter de l’équipement. Quel serait le versement mensuel?`,
        documents: [
          {
            titre: 'Lettre d’offre de financement',
            provenance:
              'Offre écrite de la directrice de compte de la Caisse du Faubourg, valide 30 jours.',
            lignes: [
              { libelle: 'Capital emprunté', valeur: argent(capital) },
              { libelle: 'Taux d’intérêt annuel (fixe)', valeur: pourcentage(taux, 2) },
              { libelle: 'Durée', valeur: `${duree} mois` },
              { libelle: 'Versements', valeur: 'mensuels, égaux, à la fin de chaque mois' },
              { libelle: 'Frais de dossier (payés à part)', valeur: argent(250), inutile: true },
            ],
          },
        ],
        attendu,
        corrige: [
          `Taux mensuel i = ${pourcentage(taux, 2)} ÷ 12 = ${pourcentage(i, 4)}`,
          `(1 + i)^−n = ${decimal(Math.pow(1 + i, -duree), 6)}`,
          `Versement = ${argent(capital)} × ${pourcentage(i, 4)} ÷ (1 − ${decimal(Math.pow(1 + i, -duree), 6)}) = ${argent(attendu)}`,
        ],
      };
    },
  },
  {
    id: 'F6',
    departement: 'finance',
    titre: 'Intérêts du prochain versement',
    unite: 'dollars',
    enjeu: 'moyen',
    formule: 'Intérêts du mois = solde du prêt × taux annuel ÷ 12',
    indices: [
      'Les intérêts se calculent sur le solde qui reste à rembourser, pas sur le montant emprunté au départ.',
      'Le reste du versement rembourse le capital.',
    ],
    generer: ({ ent }) => {
      const pret = ent.prets.find((p) => p.solde > 0);
      if (!pret) return null;
      const solde = pret.solde / 100;
      const attendu = arrondir((solde * pret.tauxAnnuel) / 12, 2);
      return {
        question: `Quelle part du prochain versement du « ${pret.nom} » servira à payer des intérêts?`,
        documents: [
          {
            titre: 'Relevé de prêt',
            provenance: `Relevé mensuel envoyé par le prêteur (${pret.preteur}).`,
            lignes: [
              { libelle: 'Solde à rembourser', valeur: argent(solde) },
              { libelle: 'Taux d’intérêt annuel', valeur: pourcentage(pret.tauxAnnuel, 2) },
              { libelle: 'Versement mensuel', valeur: argent(pret.versementMensuel / 100) },
              {
                libelle: 'Montant emprunté au départ',
                valeur: argent(pret.capitalInitial / 100),
                inutile: true,
              },
            ],
          },
        ],
        attendu,
        corrige: [
          `Intérêts = ${argent(solde)} × ${pourcentage(pret.tauxAnnuel, 2)} ÷ 12 = ${argent(attendu)}`,
          `Le reste du versement (${argent(pret.versementMensuel / 100 - attendu)}) rembourse le capital.`,
        ],
      };
    },
  },
  {
    id: 'F7',
    departement: 'finance',
    titre: 'Rapprochement bancaire',
    unite: 'dollars',
    enjeu: 'eleve',
    formule:
      'Solde aux livres = solde du relevé bancaire + dépôts en transit − chèques en circulation',
    indices: [
      'Un chèque en circulation est déjà inscrit dans tes livres, mais la banque ne l’a pas encore payé.',
      'Un dépôt en transit est déjà dans tes livres, mais pas encore sur le relevé.',
    ],
    generer: ({ etat, ent }) => {
      const rng = new Rng((etat.config.graine ^ (etat.moisCourant * 7919 + 17)) >>> 0);
      const livres = arrondir(ent.livre.soldes.encaisse / 100, 2);
      const cheques = [
        rng.int(180, 1600) + rng.int(0, 99) / 100,
        rng.int(90, 900) + rng.int(0, 99) / 100,
      ];
      const depot = rng.int(300, 2600) + rng.int(0, 99) / 100;
      const releve = arrondir(livres + cheques[0] + cheques[1] - depot, 2);
      return {
        question:
          'D’après le relevé bancaire et le registre, quel devrait être le solde de l’encaisse aux livres?',
        documents: [
          {
            titre: 'Relevé bancaire',
            provenance: 'Téléchargé du site de la banque le dernier jour du mois.',
            lignes: [
              { libelle: 'Solde à la fin du mois selon la banque', valeur: argent(releve) },
              {
                libelle: 'Limite autorisée de la marge de crédit',
                valeur: argent(ent.margeCredit.limite / 100),
                inutile: true,
              },
            ],
          },
          {
            titre: 'Registre des chèques et des dépôts',
            provenance:
              'Tenu par le commis comptable et pointé ligne par ligne avec le relevé bancaire.',
            lignes: [
              { libelle: 'Chèque no 1 émis, pas encore encaissé', valeur: argent(cheques[0]) },
              { libelle: 'Chèque no 2 émis, pas encore encaissé', valeur: argent(cheques[1]) },
              { libelle: 'Dépôt du dernier jour, pas encore sur le relevé', valeur: argent(depot) },
            ],
          },
        ],
        attendu: livres,
        corrige: [
          `Solde du relevé : ${argent(releve)}`,
          `+ dépôt en transit : ${argent(depot)}`,
          `− chèques en circulation : ${argent(cheques[0])} + ${argent(cheques[1])} = ${argent(cheques[0] + cheques[1])}`,
          `Solde aux livres = ${argent(livres)}`,
        ],
      };
    },
  },
  {
    id: 'F8',
    departement: 'finance',
    titre: 'Amortissement linéaire mensuel',
    unite: 'dollars',
    enjeu: 'faible',
    formule: 'Amortissement mensuel = coût de l’actif ÷ durée de vie utile en mois',
    indices: [
      'L’amortissement linéaire répartit le coût également sur toute la durée de vie.',
      'On suppose ici une valeur de revente nulle à la fin.',
    ],
    generer: ({ etat, ent }) => {
      if (ent.immobilisations.length === 0) return null;
      const immo = ent.immobilisations[etat.moisCourant % ent.immobilisations.length];
      const cout = arrondir(immo.cout, 2);
      if (cout <= 0 || immo.dureeVieMois <= 0) return null;
      const attendu = arrondir(cout / immo.dureeVieMois, 2);
      return {
        question: `Quel est l’amortissement comptable mensuel de « ${immo.nom} » (méthode linéaire)?`,
        documents: [
          {
            titre: 'Fiche de l’immobilisation',
            provenance:
              'Facture du fournisseur classée au registre des immobilisations; la durée de vie utile est une estimation de la direction.',
            lignes: [
              { libelle: 'Coût d’acquisition', valeur: argent(cout) },
              { libelle: 'Durée de vie utile estimée', valeur: `${immo.dureeVieMois} mois` },
              { libelle: 'Valeur de revente prévue à la fin', valeur: argent(0) },
              { libelle: 'Catégorie fiscale (DPA)', valeur: immo.classeDpa, inutile: true },
            ],
          },
        ],
        attendu,
        corrige: [
          `Amortissement mensuel = ${argent(cout)} ÷ ${immo.dureeVieMois} mois = ${argent(attendu)}`,
        ],
      };
    },
  },
  {
    id: 'F9',
    departement: 'finance',
    titre: 'Variation des ventes',
    unite: 'pourcent',
    enjeu: 'faible',
    formule: 'Variation = (ventes du mois − ventes du mois précédent) ÷ ventes du mois précédent',
    indices: [
      'On divise toujours par le mois de départ (le plus ancien).',
      'Une baisse donne un pourcentage négatif.',
    ],
    generer: ({ derniere, precedente }) => {
      if (!derniere || !precedente) return null;
      const v1 = arrondir(derniere.indicateurs.chiffreAffaires, 2);
      const v0 = arrondir(precedente.indicateurs.chiffreAffaires, 2);
      if (v0 <= 0) return null;
      const attendu = arrondir(((v1 - v0) / v0) * 100, 1);
      return {
        question: `De combien les ventes ont-elles varié entre ${nomMois(precedente)} et ${nomMois(derniere)}? (en %, à une décimale)`,
        documents: [
          {
            titre: 'Rapports de ventes mensuels',
            provenance: 'Totaux mensuels du système de caisse, taxes exclues.',
            lignes: [
              { libelle: `Ventes de ${nomMois(precedente)}`, valeur: argent(v0) },
              { libelle: `Ventes de ${nomMois(derniere)}`, valeur: argent(v1) },
              {
                libelle: `Clients servis en ${nomMois(derniere)}`,
                valeur: String(derniere.indicateurs.servies),
                inutile: true,
              },
            ],
          },
        ],
        attendu,
        corrige: [`Variation = (${argent(v1)} − ${argent(v0)}) ÷ ${argent(v0)} = ${pc(attendu)}`],
      };
    },
  },
  {
    id: 'F10',
    departement: 'finance',
    titre: 'Rendement des capitaux propres',
    unite: 'pourcent',
    enjeu: 'faible',
    formule:
      'Rendement des capitaux propres = bénéfice net annualisé ÷ capitaux propres, où bénéfice annualisé = bénéfice de la période × 12 ÷ nombre de mois',
    indices: [
      'Ramène d’abord le bénéfice sur 12 mois si la période est plus courte.',
      'Ce ratio compare ce que l’entreprise rapporte à ce que le propriétaire y a investi.',
    ],
    generer: ({ ent, derniere }) => {
      const mois = ent.archives.slice(-12);
      if (mois.length < 3 || !derniere) return null;
      const benefice = arrondir(
        mois.reduce((s, a) => s + a.indicateurs.beneficeNet, 0),
        2,
      );
      const capitaux = arrondir(extraitBilan(ent, derniere).capitaux, 2);
      if (capitaux <= 0) return null;
      const annualise = (benefice * 12) / mois.length;
      const attendu = arrondir((annualise / capitaux) * 100, 1);
      return {
        question: 'Quel est le rendement annualisé des capitaux propres? (en %, à une décimale)',
        documents: [
          {
            titre: 'Sommaire financier',
            provenance:
              'États financiers internes, non vérifiés par un comptable externe, produits par le logiciel comptable.',
            lignes: [
              {
                libelle: `Bénéfice net des ${mois.length} derniers mois`,
                valeur: argent(benefice),
              },
              { libelle: 'Capitaux propres aujourd’hui', valeur: argent(capitaux) },
              {
                libelle: 'Ventes du dernier mois',
                valeur: argent(derniere.indicateurs.chiffreAffaires),
                inutile: true,
              },
            ],
          },
        ],
        attendu,
        corrige: [
          `Bénéfice annualisé = ${argent(benefice)} × 12 ÷ ${mois.length} = ${argent(annualise)}`,
          `Rendement = ${argent(annualise)} ÷ ${argent(capitaux)} = ${pc(attendu)}`,
        ],
      };
    },
  },
];
