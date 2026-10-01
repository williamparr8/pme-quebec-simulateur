/** Textes du comparatif des formes juridiques (création de l'entreprise et département Juridique). */
import type { FormeJuridique } from '../../engine/types';

export interface InfoForme {
  id: FormeJuridique;
  nom: string;
  resume: string;
  responsabilite: string;
  imposition: string;
  remuneration: string;
  formalites: string;
}

export const FORMES: InfoForme[] = [
  {
    id: 'individuelle',
    nom: 'Entreprise individuelle',
    resume: 'Tu exploites seul, sans créer de personne morale. Simple et peu coûteuse.',
    responsabilite: 'Illimitée : tes biens personnels répondent des dettes.',
    imposition:
      'Le bénéfice s’ajoute à ton revenu personnel (T1 et TP-1), aux taux progressifs, plus le RRQ des travailleurs autonomes.',
    remuneration: 'Prélèvements (pas de salaire).',
    formalites: 'Immatriculation au REQ si le nom diffère du tien; mise à jour annuelle.',
  },
  {
    id: 'senc',
    nom: 'Société en nom collectif (SENC)',
    resume: 'Deux associés ou plus exploitent ensemble et partagent les bénéfices.',
    responsabilite: 'Solidaire : chaque associé peut devoir payer toutes les dettes de la société.',
    imposition: 'Chaque associé est imposé personnellement sur sa part du bénéfice.',
    remuneration: 'Prélèvements des associés.',
    formalites: 'Immatriculation obligatoire au REQ, convention entre associés recommandée.',
  },
  {
    id: 'sec',
    nom: 'Société en commandite (SEC)',
    resume: 'Un commandité gère; un commanditaire investit sans gérer.',
    responsabilite: 'Commandité : illimitée. Commanditaire : limitée à son apport.',
    imposition: 'Chaque associé est imposé personnellement sur sa part du bénéfice.',
    remuneration: 'Prélèvements des associés.',
    formalites: 'Immatriculation obligatoire au REQ.',
  },
  {
    id: 'inc-qc',
    nom: 'Société par actions du Québec (inc.)',
    resume:
      'Une personne morale distincte, constituée selon la Loi sur les sociétés par actions du Québec.',
    responsabilite: 'Limitée à ta mise de fonds (sauf caution personnelle exigée par la banque).',
    imposition:
      'La société paie son impôt : 11,2 % sur les premiers 500 000 $ avec la DPE (5 500 heures rémunérées au Québec), 26,5 % sinon.',
    remuneration: 'Salaire (cotisations, droits REER, rente RRQ) ou dividendes.',
    formalites:
      'Statuts de constitution (397 $), registres, états financiers et déclarations T2 et CO-17 : frais comptables plus élevés.',
  },
  {
    id: 'inc-federal',
    nom: 'Société par actions fédérale (inc.)',
    resume:
      'Constituée selon la Loi canadienne sur les sociétés par actions : nom protégé partout au Canada.',
    responsabilite: 'Limitée à ta mise de fonds (sauf caution personnelle).',
    imposition: 'Mêmes taux qu’une société du Québec (l’impôt dépend du lieu d’exploitation).',
    remuneration: 'Salaire ou dividendes.',
    formalites:
      'Constitution auprès de Corporations Canada et immatriculation au REQ quand même obligatoire.',
  },
];
