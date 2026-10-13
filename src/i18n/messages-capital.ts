/** Textes du capital (sociofinancement, conseil d'administration) et de la transmission. */
import { argentRond } from './format';

type Params = Record<string, number | string>;
const n = (p: Params, cle: string): number => Number(p[cle] ?? 0);
const s = (p: Params, cle: string): string => String(p[cle] ?? '');

export const MESSAGES_CAPITAL: Record<string, (p: Params) => { titre: string; texte: string }> = {
  sociofinancementReussi: (p) => ({
    titre: `Campagne réussie : ${argentRond(n(p, 'brut'))} amassés!`,
    texte: `L’objectif de ${argentRond(n(p, 'objectif'))} est atteint. La plateforme et le traitement des paiements gardent ${argentRond(n(p, 'frais'))}. Les contributions sont des produits perçus d’avance (une dette envers tes contributeurs) : elles deviennent des revenus au fil de la livraison des contreparties, sur 3 mois, et leur fabrication te coûte environ 35 %.`,
  }),
  sociofinancementEchec: (p) => ({
    titre: 'Campagne ratée : objectif non atteint',
    texte: `Tu visais ${argentRond(n(p, 'objectif'))} : en sociofinancement « tout ou rien », si l’objectif n’est pas atteint, personne n’est débité et tu ne reçois rien. Tu as quand même payé le lancement de la campagne. Un objectif plus modeste, ou une notoriété plus grande, aurait aidé.`,
  }),
  conseilRevue: (p) =>
    n(p, 'croissance') >= n(p, 'objectif')
      ? {
          titre: 'Revue du conseil : objectif atteint',
          texte: `Tes ventes ont crû de ${String(n(p, 'croissance')).replace('.', ',')} % cette année (objectif : ${n(p, 'objectif')} %). Le conseil est satisfait.`,
        }
      : {
          titre: `Revue du conseil : avertissement (${n(p, 'avertissements')})`,
          texte: `Tes ventes ont crû de ${String(n(p, 'croissance')).replace('.', ',')} % cette année, sous l’objectif de ${n(p, 'objectif')} % fixé avec le fonds. Après deux avertissements, les investisseurs peuvent forcer la vente de l’entreprise. C’est le prix d’un capital de risque : l’argent vient avec des attentes.`,
        },
  venteForcee: (p) => ({
    titre: 'Le conseil force la vente de l’entreprise',
    texte: `Deux années sans atteindre l’objectif : le fonds exerce sa clause d’entraînement et l’entreprise est vendue pour ${argentRond(n(p, 'prix'))}, à rabais. La partie se termine.`,
  }),
  dividendeRefuse: () => ({
    titre: 'Dividende refusé par le conseil',
    texte:
      'Ton entente avec le fonds de capital de risque interdit de verser des dividendes : l’argent doit rester dans l’entreprise pour la faire croître. Le dividende prévu n’a pas été versé.',
  }),
  releveePrete: (p) => ({
    titre: `${s(p, 'nom')} est prêt(e) à prendre la relève`,
    texte:
      'Après 12 mois de préparation, ta relève connaît l’entreprise et peut l’acheter. Dans Finance, onglet « Vendre ou transmettre », compare les offres : le prix d’une relève est plus bas, mais le paiement échelonné et la fiscalité changent le résultat net.',
  }),
};
