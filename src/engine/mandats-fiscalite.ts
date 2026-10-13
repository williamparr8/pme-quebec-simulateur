/**
 * Mandats du chef de la fiscalité et du juridique. Les montants viennent de la partie quand c'est
 * possible (ventes, achats) et sont tirés de façon reproductible (graine et mois) sinon.
 * Chaque bonne réponse est recalculée à partir des chiffres affichés dans les documents.
 */
import { argent, decimal, moisAnnee, nombre, pourcentage } from '../i18n/format';
import { secteurParId } from '../data';
import { DPA, IMPOT_SOCIETES, TAXES_VENTE } from '../data/fiscalite';
import { demarchesCroissance } from './conformite';
import { arrondir, type ContexteMandat, type DefinitionMandat } from './mandats-types';
import { cotisationsEmployeur } from './payroll';
import { Rng } from './rng';
import { etatResultats } from './statements';
import { impotSociete, retenuesEmploye, taxesSur } from './tax';

/** Générateur reproductible propre à un mandat et à un mois. */
const rngMandat = (c: ContexteMandat, sel: number): Rng =>
  new Rng((c.etat.config.graine ^ (c.etat.moisCourant * 7919 + sel * 104729 + 17)) >>> 0);

const cents = (rng: Rng, minDollars: number, maxDollars: number): number =>
  rng.int(minDollars, maxDollars) + rng.int(0, 99) / 100;

const nomMois = (c: ContexteMandat): string =>
  c.derniere ? moisAnnee(c.derniere.annee, c.derniere.mois) : 'le mois dernier';

/** Ventes taxables et achats taxables du dernier mois, tels que le registre les affiche. */
function ventesEtAchats(c: ContexteMandat): { ventes: number; achats: number } | null {
  if (!c.derniere) return null;
  const r = etatResultats(c.derniere.mouvements);
  const ventes = arrondir(r.ventes, 2);
  const achats = arrondir(r.coutMarchandises, 2);
  if (ventes <= 0 || achats <= 0) return null;
  return { ventes, achats };
}

const PRENOMS = ['Camille', 'Noémie', 'Samuel', 'Jade', 'Mathis', 'Léa', 'Antoine', 'Maya'];
const NOMS = ['Gagnon', 'Roy', 'Côté', 'Bouchard', 'Gauthier', 'Morin', 'Lavoie', 'Fortin'];
const nomAleatoire = (rng: Rng): string =>
  `${PRENOMS[rng.int(0, PRENOMS.length - 1)]} ${NOMS[rng.int(0, NOMS.length - 1)]}`;

/** Semaines de préavis selon le service continu (Loi sur les normes du travail, art. 82). */
export function semainesPreavis(moisService: number): number {
  if (moisService < 3) return 0;
  if (moisService < 12) return 1;
  if (moisService < 60) return 2;
  if (moisService < 120) return 4;
  return 8;
}

const dureeService = (mois: number): string => {
  const a = Math.floor(mois / 12);
  const m = mois % 12;
  const parties = [a > 0 ? `${a} an${a > 1 ? 's' : ''}` : '', m > 0 ? `${m} mois` : ''].filter(
    Boolean,
  );
  return parties.join(' et ') || '0 mois';
};

export const MANDATS_FISCALITE: DefinitionMandat[] = [
  {
    id: 'T1',
    departement: 'fiscalite',
    titre: 'TPS à remettre',
    unite: 'dollars',
    enjeu: 'moyen',
    formule:
      'TPS à remettre = TPS perçue sur les ventes (5 %) − crédits de taxe sur les intrants (CTI)',
    indices: [
      'La TPS perçue se calcule sur les ventes avant taxes; les CTI, sur les achats avant taxes.',
      'Le CTI est la TPS que tu as payée à tes fournisseurs : l’État te la rend.',
    ],
    generer: (c) => {
      const v = ventesEtAchats(c);
      if (!v) return null;
      const percue = taxesSur(v.ventes).tps;
      const cti = taxesSur(v.achats).tps;
      const attendu = arrondir(percue - cti, 2);
      return {
        question: `Quel montant de TPS faut-il remettre pour ${nomMois(c)}?`,
        documents: [
          {
            titre: `Registre des ventes de ${nomMois(c)}`,
            provenance:
              'Totaux de la caisse enregistreuse, ventes taxables avant taxes, tels que transmis au comptable.',
            lignes: [
              { libelle: 'Ventes taxables (avant taxes)', valeur: argent(v.ventes) },
              {
                libelle: 'Nombre de factures émises',
                valeur: nombre(c.derniere!.indicateurs.servies),
                inutile: true,
              },
            ],
          },
          {
            titre: 'Factures des fournisseurs du mois',
            provenance:
              'Factures classées au dossier d’achats; seuls les achats de marchandises donnent droit aux crédits de taxe dans cet exercice.',
            lignes: [
              { libelle: 'Achats de marchandises (avant taxes)', valeur: argent(v.achats) },
              {
                libelle: 'Loyer du local (exonéré dans ce bail)',
                valeur: argent(0),
                inutile: true,
              },
            ],
          },
        ],
        attendu,
        corrige: [
          `TPS perçue = ${argent(v.ventes)} × 5 % = ${argent(percue)}`,
          `CTI = ${argent(v.achats)} × 5 % = ${argent(cti)}`,
          `TPS à remettre = ${argent(percue)} − ${argent(cti)} = ${argent(attendu)}`,
        ],
      };
    },
  },
  {
    id: 'T2',
    departement: 'fiscalite',
    titre: 'TVQ à remettre',
    unite: 'dollars',
    enjeu: 'moyen',
    formule:
      'TVQ à remettre = TVQ perçue sur les ventes (9,975 %) − remboursements de taxe sur les intrants (RTI)',
    indices: [
      'La TVQ se calcule sur le prix avant taxes, pas sur le prix incluant la TPS.',
      'Le RTI est la TVQ que tu as payée à tes fournisseurs.',
    ],
    generer: (c) => {
      const v = ventesEtAchats(c);
      if (!v) return null;
      const percue = taxesSur(v.ventes).tvq;
      const rti = taxesSur(v.achats).tvq;
      const attendu = arrondir(percue - rti, 2);
      return {
        question: `Quel montant de TVQ faut-il remettre pour ${nomMois(c)}?`,
        documents: [
          {
            titre: `Registre des ventes de ${nomMois(c)}`,
            provenance:
              'Totaux de la caisse enregistreuse, ventes taxables avant taxes, tels que transmis au comptable.',
            lignes: [
              { libelle: 'Ventes taxables (avant taxes)', valeur: argent(v.ventes) },
              { libelle: 'TPS perçue', valeur: argent(taxesSur(v.ventes).tps), inutile: true },
            ],
          },
          {
            titre: 'Factures des fournisseurs du mois',
            provenance:
              'Factures classées au dossier d’achats; seuls les achats de marchandises donnent droit aux remboursements de taxe dans cet exercice.',
            lignes: [{ libelle: 'Achats de marchandises (avant taxes)', valeur: argent(v.achats) }],
          },
        ],
        attendu,
        corrige: [
          `TVQ perçue = ${argent(v.ventes)} × 9,975 % = ${argent(percue)}`,
          `RTI = ${argent(v.achats)} × 9,975 % = ${argent(rti)}`,
          `TVQ à remettre = ${argent(percue)} − ${argent(rti)} = ${argent(attendu)}`,
        ],
      };
    },
  },
  {
    id: 'T3',
    departement: 'fiscalite',
    titre: 'Total d’une facture avec taxes',
    unite: 'dollars',
    enjeu: 'faible',
    formule: 'Total = prix + TPS (5 %) + TVQ (9,975 %), c’est-à-dire prix × 1,14975',
    indices: [
      'Calcule la TPS et la TVQ séparément, chacune sur le prix avant taxes, puis additionne.',
      'Arrondis chaque taxe au cent avant de les additionner.',
    ],
    generer: (c) => {
      const rng = rngMandat(c, 3);
      const prix = cents(rng, 180, 3200);
      const t = taxesSur(prix);
      const attendu = arrondir(prix + t.tps + t.tvq, 2);
      const objets = [
        'un four à convection',
        'des chaises de salle à manger',
        'un système de caisse',
        'des présentoirs',
        'une enseigne lumineuse',
      ];
      const objet = objets[rng.int(0, objets.length - 1)];
      return {
        question: `Combien devras-tu payer au total pour ${objet}, taxes comprises?`,
        documents: [
          {
            titre: 'Soumission d’un fournisseur',
            provenance:
              'Soumission reçue par courriel du fournisseur, valide 30 jours; les prix sont affichés avant taxes.',
            lignes: [
              { libelle: `Prix de ${objet} (avant taxes)`, valeur: argent(prix) },
              { libelle: 'Livraison incluse dans le prix', valeur: 'oui', inutile: true },
            ],
          },
        ],
        attendu,
        corrige: [
          `TPS = ${argent(prix)} × 5 % = ${argent(t.tps)}`,
          `TVQ = ${argent(prix)} × 9,975 % = ${argent(t.tvq)}`,
          `Total = ${argent(prix)} + ${argent(t.tps)} + ${argent(t.tvq)} = ${argent(attendu)}`,
        ],
      };
    },
  },
  {
    id: 'T4',
    departement: 'fiscalite',
    titre: 'Seuil du petit fournisseur',
    unite: 'dollars',
    enjeu: 'faible',
    formule:
      'Écart = ventes taxables des 4 derniers trimestres − 30 000 $. Si l’écart est positif, l’inscription aux fichiers de la TPS et de la TVQ est obligatoire',
    indices: [
      'Additionne les quatre trimestres, pas seulement le dernier.',
      'Un écart négatif veut dire que le commerce est encore sous le seuil.',
    ],
    generer: (c) => {
      const rng = rngMandat(c, 4);
      const base = rng.int(55, 105) * 100;
      const trimestres = [0, 1, 2, 3].map(() => arrondir(base * rng.range(0.7, 1.3), 0));
      const total = arrondir(
        trimestres.reduce((s, x) => s + x, 0),
        2,
      );
      const seuil = TAXES_VENTE.seuilPetitFournisseur;
      const attendu = arrondir(total - seuil, 2);
      return {
        question:
          'Un atelier voisin te demande conseil. De combien ses ventes taxables des 4 derniers trimestres dépassent-elles le seuil du petit fournisseur? (Un nombre négatif veut dire qu’il est sous le seuil.)',
        documents: [
          {
            titre: 'Registre des ventes de l’atelier voisin',
            provenance:
              'Totaux trimestriels recopiés par le propriétaire à partir de ses factures de vente; ventes avant taxes.',
            lignes: [
              ...trimestres.map((t, i) => ({
                libelle: `Ventes taxables du trimestre ${i + 1}`,
                valeur: argent(t),
              })),
              {
                libelle: 'Ventes à l’extérieur du Canada (détaxées)',
                valeur: argent(0),
                inutile: true,
              },
            ],
          },
        ],
        attendu,
        corrige: [
          `Ventes des 4 trimestres = ${trimestres.map((t) => argent(t)).join(' + ')} = ${argent(total)}`,
          `Écart = ${argent(total)} − ${argent(seuil)} = ${argent(attendu)}`,
          attendu > 0
            ? 'Le seuil est dépassé : l’inscription est obligatoire.'
            : 'Le seuil n’est pas dépassé : l’inscription est facultative.',
        ],
      };
    },
  },
  {
    id: 'T5',
    departement: 'fiscalite',
    titre: 'Retenues à la source à remettre',
    unite: 'dollars',
    enjeu: 'eleve',
    formule:
      'Montant à remettre = retenues faites sur la paie des employés + cotisations de l’employeur (RRQ, RQAP, assurance-emploi, FSS, CNT, CNESST)',
    indices: [
      'Les retenues de l’employé viennent de la paie; les cotisations de l’employeur s’y ajoutent.',
      'Le salaire brut n’est pas un montant à remettre : seulement les retenues et les cotisations.',
    ],
    generer: (c) => {
      const rng = rngMandat(c, 5);
      const secteur = secteurParId(c.etat.config.secteurId);
      const nb = rng.int(2, 4);
      const employes = Array.from({ length: nb }, () => {
        const brut = arrondir(rng.int(1900, 4200) + rng.int(0, 99) / 100, 2);
        const retenues = retenuesEmploye(brut, 0).total;
        const cot = cotisationsEmployeur(brut, 0, secteur.tauxCnesst, brut * 12 * nb).total;
        return { nom: nomAleatoire(rng), brut, retenues, cot };
      });
      const totalRetenues = arrondir(
        employes.reduce((s, e) => s + e.retenues, 0),
        2,
      );
      const totalCot = arrondir(
        employes.reduce((s, e) => s + e.cot, 0),
        2,
      );
      const attendu = arrondir(totalRetenues + totalCot, 2);
      return {
        question: `Quel montant total faut-il remettre à Revenu Québec et à l’Agence du revenu du Canada pour la paie de ${nomMois(c)}?`,
        documents: [
          {
            titre: 'Registre de paie du mois',
            provenance:
              'Produit par le logiciel de paie à partir des feuilles de temps approuvées; les retenues suivent les tables de 2026.',
            lignes: employes.flatMap((e) => [
              { libelle: `${e.nom} : salaire brut`, valeur: argent(e.brut), inutile: true },
              {
                libelle: `${e.nom} : retenues de l’employé (RRQ, RQAP, AE, impôts)`,
                valeur: argent(e.retenues),
              },
            ]),
          },
          {
            titre: 'Cotisations de l’employeur du mois',
            provenance:
              'Calculées par le logiciel de paie selon les taux 2026 et le taux de la CNESST du secteur.',
            lignes: employes.map((e) => ({
              libelle: `${e.nom} : cotisations de l’employeur`,
              valeur: argent(e.cot),
            })),
          },
        ],
        attendu,
        corrige: [
          `Retenues des employés = ${employes.map((e) => argent(e.retenues)).join(' + ')} = ${argent(totalRetenues)}`,
          `Cotisations de l’employeur = ${employes.map((e) => argent(e.cot)).join(' + ')} = ${argent(totalCot)}`,
          `À remettre = ${argent(totalRetenues)} + ${argent(totalCot)} = ${argent(attendu)}`,
        ],
      };
    },
  },
  {
    id: 'T6',
    departement: 'fiscalite',
    titre: 'Déduction pour amortissement (DPA)',
    unite: 'dollars',
    enjeu: 'moyen',
    formule:
      'DPA de l’année d’achat = coût × taux de la catégorie × facteur de la première année (indiqué dans le tableau)',
    indices: [
      'Trouve la catégorie du bien dans le tableau, puis son taux.',
      'L’année d’achat, le taux est multiplié par le facteur de la première année.',
    ],
    generer: (c) => {
      const rng = rngMandat(c, 6);
      const biens = [
        { nom: 'un four à convection', classe: '8' as const },
        { nom: 'une camionnette de livraison', classe: '10' as const },
        { nom: 'des ordinateurs portables', classe: '50' as const },
      ];
      const bien = biens[c.etat.moisCourant % biens.length];
      const annee = c.derniere?.annee ?? c.etat.config.anneeDepart;
      const cout = arrondir(rng.int(40, 400) * 100, 2);
      const taux = DPA.taux[bien.classe];
      const facteur = DPA.facteurPremiereAnnee(annee);
      const attendu = arrondir(cout * taux * facteur, 2);
      return {
        question: `Quelle est la DPA maximale de l’année d’achat pour ${bien.nom}?`,
        documents: [
          {
            titre: 'Facture d’achat',
            provenance:
              'Facture du fournisseur, bien payé et mis en service dans l’année en cours.',
            lignes: [
              { libelle: `Prix de ${bien.nom} (avant taxes)`, valeur: argent(cout) },
              { libelle: 'Catégorie fiscale', valeur: `Catégorie ${bien.classe}` },
              { libelle: 'Année de mise en service', valeur: String(annee) },
              { libelle: 'Garantie prolongée offerte', valeur: '2 ans', inutile: true },
            ],
          },
          {
            titre: 'Tableau des catégories de DPA',
            provenance:
              'Extrait de la liste des catégories de l’Agence du revenu du Canada, avec l’incitatif à l’investissement accéléré en vigueur.',
            lignes: [
              {
                libelle: 'Catégorie 8 : mobilier et équipement',
                valeur: pourcentage(DPA.taux['8'], 0),
              },
              { libelle: 'Catégorie 10 : véhicules', valeur: pourcentage(DPA.taux['10'], 0) },
              {
                libelle: 'Catégorie 50 : matériel informatique',
                valeur: pourcentage(DPA.taux['50'], 0),
              },
              {
                libelle: 'Catégorie 12 : logiciels',
                valeur: pourcentage(DPA.taux['12'], 0),
                inutile: true,
              },
              {
                libelle: `Facteur de la première année (bien mis en service en ${annee})`,
                valeur: `× ${decimal(facteur, 1)}`,
              },
            ],
          },
        ],
        attendu,
        corrige: [
          `Taux de la catégorie ${bien.classe} = ${pourcentage(taux, 0)}`,
          `DPA = ${argent(cout)} × ${pourcentage(taux, 0)} × ${decimal(facteur, 1)} = ${argent(attendu)}`,
        ],
      };
    },
  },
  {
    id: 'T7',
    departement: 'fiscalite',
    titre: 'Impôt d’une société',
    unite: 'dollars',
    enjeu: 'eleve',
    formule:
      'Impôt = (partie du revenu sous le plafond des affaires × taux réduit fédéral + taux réduit du Québec) + (partie au-delà du plafond × taux général fédéral + taux général du Québec)',
    indices: [
      'Sépare le revenu imposable en deux : la partie sous le plafond de 500 000 $ et ce qui dépasse.',
      'Les taux réduits ne valent que si les heures rémunérées atteignent 5 500.',
    ],
    generer: (c) => {
      const rng = rngMandat(c, 7);
      const revenu = arrondir(rng.int(900, 6200) * 100, 2);
      const heures = rng.int(5500, 7500);
      const r = impotSociete(revenu, heures);
      const s = IMPOT_SOCIETES;
      const admissible = Math.min(revenu, s.plafondAffaires);
      const reste = arrondir(revenu - admissible, 2);
      return {
        question: 'Quel est l’impôt total (fédéral et Québec) de cette société pour l’année?',
        documents: [
          {
            titre: 'État des résultats fiscal de l’exercice',
            provenance:
              'Préparé par le comptable externe à partir des livres de l’exercice, après les ajustements fiscaux (DPA, repas, etc.).',
            lignes: [
              { libelle: 'Revenu imposable', valeur: argent(revenu) },
              { libelle: 'Heures rémunérées de l’exercice', valeur: nombre(heures) },
              {
                libelle: 'Plafond des affaires (déduction pour petite entreprise)',
                valeur: argent(s.plafondAffaires),
              },
              {
                libelle: 'Dividendes versés à l’actionnaire',
                valeur: argent(revenu * 0.2),
                inutile: true,
              },
            ],
          },
          {
            titre: 'Taux d’imposition des sociétés',
            provenance:
              'Taux de l’Agence du revenu du Canada et de Revenu Québec pour une société privée sous contrôle canadien.',
            lignes: [
              {
                libelle: 'Taux fédéral réduit (petite entreprise)',
                valeur: pourcentage(s.federal.tauxPetiteEntreprise, 1),
              },
              {
                libelle: 'Taux du Québec réduit (petite entreprise)',
                valeur: pourcentage(s.quebec.tauxPetiteEntreprise, 1),
              },
              { libelle: 'Taux fédéral général', valeur: pourcentage(s.federal.tauxGeneral, 1) },
              { libelle: 'Taux du Québec général', valeur: pourcentage(s.quebec.tauxGeneral, 1) },
            ],
          },
        ],
        attendu: r.total,
        corrige: [
          `Partie sous le plafond = ${argent(admissible)}; au-delà = ${argent(reste)}`,
          `Fédéral = ${argent(admissible)} × ${pourcentage(s.federal.tauxPetiteEntreprise, 1)} + ${argent(reste)} × ${pourcentage(s.federal.tauxGeneral, 1)} = ${argent(r.impotFederal)}`,
          `Québec = ${argent(admissible)} × ${pourcentage(s.quebec.tauxPetiteEntreprise, 1)} + ${argent(reste)} × ${pourcentage(s.quebec.tauxGeneral, 1)} = ${argent(r.impotQuebec)}`,
          `Impôt total = ${argent(r.impotFederal)} + ${argent(r.impotQuebec)} = ${argent(r.total)}`,
        ],
      };
    },
  },
  {
    id: 'T8',
    departement: 'fiscalite',
    titre: 'Acompte provisionnel',
    unite: 'dollars',
    enjeu: 'moyen',
    formule:
      'Acompte = impôt de l’année précédente ÷ nombre de versements de l’année (12 si mensuels, 4 si trimestriels)',
    indices: [
      'Regarde la fréquence des versements indiquée dans l’avis.',
      'Les acomptes d’une année se basent sur l’impôt de l’année précédente.',
    ],
    generer: (c) => {
      const rng = rngMandat(c, 8);
      const impot = arrondir(rng.int(60, 450) * 100, 2);
      const trimestriel = c.etat.moisCourant % 2 === 1;
      const n = trimestriel ? 4 : 12;
      const attendu = arrondir(impot / n, 2);
      return {
        question: 'Quel est le montant de chaque acompte provisionnel de l’année?',
        documents: [
          {
            titre: 'Avis de cotisation de l’année précédente',
            provenance:
              'Avis reçu par la poste de Revenu Québec après le traitement de la déclaration de la société.',
            lignes: [
              { libelle: 'Impôt total de l’année précédente', valeur: argent(impot) },
              {
                libelle: 'Fréquence des versements',
                valeur: trimestriel
                  ? 'trimestriels (société admissible)'
                  : 'mensuels (régime général)',
              },
              {
                libelle: 'Intérêts de l’année précédente',
                valeur: argent(arrondir(impot * 0.01, 2)),
                inutile: true,
              },
            ],
          },
        ],
        attendu,
        corrige: [
          `Nombre de versements = ${n} (${trimestriel ? 'trimestriels' : 'mensuels'})`,
          `Acompte = ${argent(impot)} ÷ ${n} = ${argent(attendu)}`,
        ],
      };
    },
  },
  {
    id: 'T9',
    departement: 'fiscalite',
    titre: 'Indemnité de préavis',
    unite: 'dollars',
    enjeu: 'moyen',
    formule:
      'Indemnité = semaines de préavis × taux horaire × heures par semaine, où le préavis est de 0 semaine (moins de 3 mois de service), 1 (3 mois à 1 an), 2 (1 à 5 ans), 4 (5 à 10 ans) ou 8 (10 ans et plus)',
    indices: [
      'Compte le service continu en mois, puis trouve la tranche du barème.',
      'Le salaire hebdomadaire = taux horaire × heures par semaine.',
    ],
    generer: (c) => {
      const rng = rngMandat(c, 9);
      const services = [2, 8, 20, 40, 70, 100, 140, 190];
      const mois = services[(c.etat.moisCourant + rng.int(0, 2)) % services.length];
      const taux = arrondir(16.6 + rng.int(0, 1500) / 100, 2);
      const heures = rng.int(24, 40);
      const semaines = semainesPreavis(mois);
      const hebdo = arrondir(taux * heures, 2);
      const attendu = arrondir(semaines * hebdo, 2);
      const nom = nomAleatoire(rng);
      return {
        question: `Quelle indemnité faut-il verser à ${nom} si l’employeur met fin à son emploi sans préavis (sans faute grave)?`,
        documents: [
          {
            titre: `Dossier de l’employé : ${nom}`,
            provenance:
              'Extrait du dossier du personnel : la date d’embauche vient du contrat signé, le taux horaire de la dernière fiche de paie.',
            lignes: [
              { libelle: 'Service continu', valeur: dureeService(mois) },
              { libelle: 'Taux horaire', valeur: argent(taux) },
              { libelle: 'Heures par semaine', valeur: nombre(heures) },
              { libelle: 'Évaluation de rendement', valeur: 'satisfaisante', inutile: true },
            ],
          },
        ],
        attendu,
        corrige: [
          `Service de ${dureeService(mois)} : ${semaines} semaine${semaines > 1 ? 's' : ''} de préavis`,
          `Salaire hebdomadaire = ${argent(taux)} × ${heures} = ${argent(hebdo)}`,
          `Indemnité = ${semaines} × ${argent(hebdo)} = ${argent(attendu)}`,
        ],
      };
    },
  },
  {
    id: 'T10',
    departement: 'fiscalite',
    titre: 'Démarches obligatoires selon la taille',
    unite: 'nombre',
    enjeu: 'faible',
    formule:
      'Compte les démarches dont le seuil d’employés est atteint ou dépassé (seuil ≤ nombre d’employés)',
    indices: [
      'Compare le nombre d’employés au seuil de chaque démarche, une à la fois.',
      'Un seuil de 10 veut dire « à partir de 10 employés », 10 inclus.',
    ],
    generer: (c) => {
      const rng = rngMandat(c, 10);
      const tailles = [6, 9, 10, 14, 19, 20, 22, 26, 31];
      const n = tailles[(c.etat.moisCourant + rng.int(0, 3)) % tailles.length];
      const demarches = demarchesCroissance().filter((d) => d.seuilEmployes !== undefined);
      const obligatoires = demarches.filter((d) => (d.seuilEmployes ?? Infinity) <= n);
      const attendu = obligatoires.length;
      return {
        question: `Une entreprise voisine compte ${n} employés. Combien de ces démarches lui sont obligatoires?`,
        documents: [
          {
            titre: 'Liste des démarches liées à la taille',
            provenance:
              'Tirée des guides de la CNESST et de l’Office québécois de la langue française; les seuils comptent les salariés.',
            lignes: [
              ...demarches.map((d) => ({
                libelle: d.nom,
                valeur: `à partir de ${d.seuilEmployes} employés`,
              })),
              {
                libelle: 'Retenues à la source (dès le premier employé)',
                valeur: 'toujours',
                inutile: true,
              },
            ],
          },
        ],
        attendu,
        corrige: [
          `Nombre d’employés : ${n}`,
          ...demarches.map(
            (d) =>
              `${d.nom} : seuil ${d.seuilEmployes} → ${(d.seuilEmployes ?? Infinity) <= n ? 'obligatoire' : 'pas obligatoire'}`,
          ),
          `Total obligatoire = ${attendu}`,
        ],
      };
    },
  },
];
