import { describe, expect, it } from 'vitest';
import { simulerMois } from '../src/engine/simulation';
import { analyserFichier, compresser, decompresser } from '../src/store/sauvegarde';
import { jouerMois, nouvellePartie } from './helpers';

describe('sauvegardes compressées', () => {
  it('compressent fortement une longue partie et la restituent à l’identique', () => {
    const etat = jouerMois(nouvellePartie(3, 24), 18);
    const json = JSON.stringify({ format: 'pme-quebec-simulateur', version: etat.version, etat });
    const compresse = compresser(json);
    // Au moins 4 fois plus petit (en caractères stockés).
    expect(compresse.length).toBeLessThan(json.length / 4);
    const texte = decompresser(compresse);
    expect(texte).toBe(json);
    const relu = analyserFichier(texte as string);
    // La partie reprend exactement au même point (même graine, mêmes résultats).
    expect(JSON.stringify(simulerMois(relu))).toBe(JSON.stringify(simulerMois(etat)));
  });

  it('lit encore une sauvegarde non compressée', () => {
    expect(decompresser('{"a":1}')).toBe('{"a":1}');
  });
});
