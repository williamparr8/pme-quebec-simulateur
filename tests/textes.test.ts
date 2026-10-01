import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import glossaire from '../src/data/glossaire.json';
import { texteMessage } from '../src/i18n/fr-CA';
import { jouerAleatoirement } from './helpers';

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory()
      ? fichiers(chemin)
      : chemin.endsWith('.tsx')
        ? [chemin]
        : [];
  });
}

describe('textes destinés au joueur', () => {
  it('chaque message produit par le moteur a un texte en français', () => {
    const codes = new Set<string>();
    for (const graine of [2, 3, 5, 8, 13]) {
      const etat = jouerAleatoirement(graine, 36);
      for (const a of etat.entreprises[0].archives) for (const m of a.messages) codes.add(m.code);
    }
    const sansTexte = [...codes].filter(
      (c) => texteMessage({ code: c, niveau: 'info' }).titre === c,
    );
    expect(sansTexte).toEqual([]);
    expect(codes.size).toBeGreaterThan(30);
  });

  it('chaque terme cité dans l’interface existe dans le glossaire', () => {
    const ids = new Set(glossaire.termes.map((t) => t.id));
    expect(ids.size).toBe(glossaire.termes.length);
    const manquants = new Set<string>();
    for (const f of fichiers(join(process.cwd(), 'src', 'ui'))) {
      const texte = readFileSync(f, 'utf8');
      for (const m of texte.matchAll(/(?:Terme id|terme)="([a-zA-Z0-9]+)"/g)) {
        if (!ids.has(m[1])) manquants.add(`${m[1]} (${f})`);
      }
    }
    expect([...manquants]).toEqual([]);
    expect(ids.size).toBeGreaterThanOrEqual(150);
  });
});
