/**
 * Graphiques (Recharts), chargés à la demande pour accélérer l'ouverture du jeu.
 * Règles : un seul axe par graphique, lignes de 2 px, grille discrète, légende
 * pour 2 séries et plus, infobulle au survol et tableau de données pour l'accessibilité.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MoisArchive } from '../../engine/types';
import type { SeuilRentabilite } from '../../engine/rapports';
import { argentRond, moisCourt, pourcentage } from '../../i18n/format';

interface Couleurs {
  serie1: string;
  serie2: string;
  serie3: string;
  grille: string;
  axe: string;
  texte: string;
  surface: string;
  bordure: string;
}

function lireCouleurs(): Couleurs {
  const s = getComputedStyle(document.documentElement);
  const v = (nom: string) => s.getPropertyValue(nom).trim();
  return {
    serie1: v('--serie-1'),
    serie2: v('--serie-2'),
    serie3: v('--serie-3'),
    grille: v('--grille'),
    axe: v('--axe'),
    texte: v('--texte'),
    surface: v('--surface'),
    bordure: v('--bordure'),
  };
}

/** Couleurs du thème actif; se met à jour quand le joueur change de thème. */
function useCouleurs(): Couleurs {
  const [c, setC] = useState(lireCouleurs);
  useEffect(() => {
    const obs = new MutationObserver(() => setC(lireCouleurs()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return c;
}

const abregerArgent = (v: number) =>
  Math.abs(v) >= 1000 ? `${Math.round(v / 1000).toLocaleString('fr-CA')} k$` : `${Math.round(v)} $`;

function Cadre({
  titre,
  children,
  tableau,
}: {
  titre: string;
  children: ReactNode;
  tableau: ReactNode;
}) {
  return (
    <figure className="rounded-xl border border-bordure bg-surface p-4 shadow-carte">
      <figcaption className="mb-2 font-bold">{titre}</figcaption>
      <div className="h-56 w-full">{children}</div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-doux">Voir les données (tableau)</summary>
        <div className="mt-2 max-h-56 overflow-auto">{tableau}</div>
      </details>
    </figure>
  );
}

function Table({ entetes, lignes }: { entetes: string[]; lignes: (string | number)[][] }) {
  return (
    <table className="chiffres w-full text-left text-xs">
      <thead>
        <tr>
          {entetes.map((e) => (
            <th key={e} className="border-b border-bordure py-1 pr-2 font-semibold">
              {e}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={i}>
            {l.map((c, j) => (
              <td key={j} className={`py-0.5 pr-2 ${j > 0 ? 'text-right' : ''}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function styleInfobulle(c: Couleurs) {
  return {
    contentStyle: {
      background: c.surface,
      border: `1px solid ${c.bordure}`,
      borderRadius: 8,
      color: c.texte,
    },
    labelStyle: { color: c.texte, fontWeight: 700 },
    itemStyle: { color: c.texte },
  };
}

function axes(c: Couleurs, formatY: (v: number) => string) {
  return (
    <>
      <CartesianGrid stroke={c.grille} strokeWidth={1} vertical={false} />
      <XAxis
        dataKey="mois"
        tick={{ fill: c.axe, fontSize: 12 }}
        stroke={c.grille}
        tickLine={false}
        minTickGap={16}
      />
      <YAxis
        tickFormatter={formatY}
        tick={{ fill: c.axe, fontSize: 12 }}
        stroke={c.grille}
        tickLine={false}
        width={56}
      />
    </>
  );
}

export function GraphiqueVentesBenefice({ archives }: { archives: MoisArchive[] }) {
  const c = useCouleurs();
  const donnees = archives.map((a) => ({
    mois: moisCourt(a.annee, a.mois),
    ventes: Math.round(a.indicateurs.chiffreAffaires),
    benefice: Math.round(a.indicateurs.beneficeNet),
  }));
  return (
    <Cadre
      titre="Ventes et bénéfice net par mois"
      tableau={
        <Table
          entetes={['Mois', 'Ventes', 'Bénéfice net']}
          lignes={donnees.map((d) => [d.mois, argentRond(d.ventes), argentRond(d.benefice)])}
        />
      }
    >
      <ResponsiveContainer>
        <LineChart data={donnees} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          {axes(c, abregerArgent)}
          <ReferenceLine y={0} stroke={c.axe} />
          <Tooltip formatter={(v) => argentRond(Number(v))} {...styleInfobulle(c)} />
          <Legend
            wrapperStyle={{ color: c.texte, fontSize: 13 }}
            formatter={(valeur: string) => <span style={{ color: c.texte }}>{valeur}</span>}
          />
          <Line
            type="monotone"
            dataKey="ventes"
            name="Ventes"
            stroke={c.serie1}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="benefice"
            name="Bénéfice net"
            stroke={c.serie2}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Cadre>
  );
}

export function GraphiqueEncaisse({ archives }: { archives: MoisArchive[] }) {
  const c = useCouleurs();
  const donnees = archives.map((a) => ({
    mois: moisCourt(a.annee, a.mois),
    encaisse: Math.round(a.indicateurs.encaisse - a.indicateurs.margeCreditUtilisee),
  }));
  return (
    <Cadre
      titre="Trésorerie nette (encaisse − marge de crédit)"
      tableau={
        <Table
          entetes={['Mois', 'Trésorerie nette']}
          lignes={donnees.map((d) => [d.mois, argentRond(d.encaisse)])}
        />
      }
    >
      <ResponsiveContainer>
        <LineChart data={donnees} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          {axes(c, abregerArgent)}
          <ReferenceLine y={0} stroke={c.axe} />
          <Tooltip formatter={(v) => argentRond(Number(v))} {...styleInfobulle(c)} />
          <Line
            type="monotone"
            dataKey="encaisse"
            name="Trésorerie nette"
            stroke={c.serie1}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Cadre>
  );
}

export function GraphiquePartsMarche({
  archives,
  nomJoueur,
  concurrents,
}: {
  archives: MoisArchive[];
  nomJoueur: string;
  concurrents: { id: string; nom: string }[];
}) {
  const c = useCouleurs();
  const couleurs = [c.serie2, c.serie3];
  const donnees = archives.map((a) => {
    const ligne: Record<string, string | number> = {
      mois: moisCourt(a.annee, a.mois),
      joueur: a.indicateurs.partMarche,
    };
    for (const x of a.concurrents) ligne[x.id] = x.part;
    return ligne;
  });
  return (
    <Cadre
      titre="Parts de marché (clients servis)"
      tableau={
        <Table
          entetes={['Mois', nomJoueur, ...concurrents.map((x) => x.nom)]}
          lignes={donnees.map((d) => [
            String(d.mois),
            pourcentage(Number(d.joueur), 0),
            ...concurrents.map((x) => pourcentage(Number(d[x.id] ?? 0), 0)),
          ])}
        />
      }
    >
      <ResponsiveContainer>
        <LineChart data={donnees} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          {axes(c, (v) => pourcentage(v, 0))}
          <Tooltip formatter={(v) => pourcentage(Number(v), 1)} {...styleInfobulle(c)} />
          <Legend
            wrapperStyle={{ color: c.texte, fontSize: 13 }}
            formatter={(valeur: string) => <span style={{ color: c.texte }}>{valeur}</span>}
          />
          <Line
            type="monotone"
            dataKey="joueur"
            name={nomJoueur}
            stroke={c.serie1}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          {concurrents.map((x, i) => (
            <Line
              key={x.id}
              type="monotone"
              dataKey={x.id}
              name={x.nom}
              stroke={couleurs[i % couleurs.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Cadre>
  );
}

/** Graphique du seuil de rentabilité : droite des revenus et droite des coûts totaux. */
export function GraphiqueSeuil({ seuil }: { seuil: SeuilRentabilite }) {
  const c = useCouleurs();
  const max = Math.max(seuil.ventes, seuil.seuil ?? 0) * 1.4 || 10_000;
  const points = Array.from({ length: 11 }, (_, i) => {
    const ventes = (max * i) / 10;
    return {
      mois: argentRond(ventes),
      ventes: Math.round(ventes),
      revenus: Math.round(ventes),
      couts: Math.round(seuil.chargesFixes + ventes * (1 - seuil.tauxMargeContribution)),
    };
  });
  return (
    <Cadre
      titre="Seuil de rentabilité du mois"
      tableau={
        <Table
          entetes={['Ventes', 'Revenus', 'Coûts totaux']}
          lignes={points.map((p) => [p.mois, argentRond(p.revenus), argentRond(p.couts)])}
        />
      }
    >
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={c.grille} vertical={false} />
          <XAxis
            dataKey="ventes"
            type="number"
            domain={[0, max]}
            tickFormatter={abregerArgent}
            tick={{ fill: c.axe, fontSize: 12 }}
            stroke={c.grille}
          />
          <YAxis
            tickFormatter={abregerArgent}
            tick={{ fill: c.axe, fontSize: 12 }}
            stroke={c.grille}
            width={56}
          />
          <Tooltip
            formatter={(v) => argentRond(Number(v))}
            labelFormatter={(v) => `Ventes : ${argentRond(Number(v))}`}
            {...styleInfobulle(c)}
          />
          <Legend
            wrapperStyle={{ color: c.texte, fontSize: 13 }}
            formatter={(valeur: string) => <span style={{ color: c.texte }}>{valeur}</span>}
          />
          {seuil.seuil !== null && (
            <ReferenceLine
              x={seuil.seuil}
              stroke={c.axe}
              strokeDasharray="4 4"
              label={{ value: 'Seuil', fill: c.texte, fontSize: 12, position: 'top' }}
            />
          )}
          <ReferenceLine
            x={seuil.ventes}
            stroke={c.serie1}
            label={{ value: 'Tes ventes', fill: c.texte, fontSize: 12, position: 'insideTopRight' }}
          />
          <Line
            type="linear"
            dataKey="revenus"
            name="Revenus (ventes)"
            stroke={c.serie1}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="couts"
            name="Coûts totaux"
            stroke={c.serie2}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Cadre>
  );
}
