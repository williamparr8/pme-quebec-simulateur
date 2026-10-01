/**
 * Scène 2D du commerce, en blocs et en SVG (aucune image externe).
 * Le nombre de clients reflète l'achalandage réel du dernier mois; les saisons
 * sont visibles (neige, feuilles orange, terrasse l'été).
 * Le rendu animé avec PixiJS arrivera au Jalon 6.
 */
import { useMemo, type CSSProperties } from 'react';
import { Rng } from '../engine/rng';
import { saisonDuMois, type Saison } from './saisons';

const NOMS_SAISONS: Record<Saison, string> = {
  hiver: 'en hiver',
  printemps: 'au printemps',
  ete: 'en été',
  automne: 'en automne',
};

const CIEL: Record<Saison, [string, string]> = {
  hiver: ['#c9d9ea', '#eef3f8'],
  printemps: ['#9fd3fb', '#e3f3ff'],
  ete: ['#6cc0f5', '#d4efff'],
  automne: ['#f3c58d', '#fcebd2'],
};

const FEUILLAGE: Record<Saison, string[]> = {
  hiver: [],
  printemps: ['#7bc96f', '#f4a7c4'],
  ete: ['#2f9e44', '#40b356'],
  automne: ['#e8590c', '#f59f00', '#d9480f'],
};

const PEAUX = ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'];
const VETEMENTS = [
  '#e64980',
  '#4c6ef5',
  '#12b886',
  '#fab005',
  '#7950f2',
  '#fd7e14',
  '#228be6',
  '#be4bdb',
];

interface Personne {
  x: number;
  y: number;
  peau: string;
  haut: string;
  bas: string;
  duree: number;
  distance: number;
  echelle: number;
}

function PersonneBloc({ p, anime, tuque }: { p: Personne; anime: boolean; tuque: boolean }) {
  return (
    <g transform={`translate(${p.x} ${p.y}) scale(${p.echelle})`}>
      <g
        className={anime ? 'anim-marcher' : undefined}
        style={
          anime
            ? ({ '--duree': `${p.duree}s`, '--distance': `${p.distance}px` } as CSSProperties)
            : undefined
        }
      >
        <g className={anime ? 'anim-sautiller' : undefined}>
          <rect x={-5} y={-38} width={10} height={10} rx={2} fill={p.peau} />
          {tuque && <rect x={-6} y={-41} width={12} height={5} rx={2} fill={p.haut} />}
          <rect x={-7} y={-28} width={14} height={15} rx={2} fill={p.haut} />
          <rect x={-6} y={-13} width={5} height={13} rx={1} fill={p.bas} />
          <rect x={1} y={-13} width={5} height={13} rx={1} fill={p.bas} />
        </g>
      </g>
    </g>
  );
}

interface Props {
  nom: string;
  couleur: string;
  mois: number;
  clientsParJour: number;
  nbEmployes: number;
  concurrents: { nom: string; couleur: string }[];
}

export function SceneCommerce({
  nom,
  couleur,
  mois,
  clientsParJour,
  nbEmployes,
  concurrents,
}: Props) {
  const saison = saisonDuMois(mois);
  const nbClients = Math.max(0, Math.min(12, Math.round(clientsParJour / 18)));
  const anime = true;

  // Positions stables (graine fixe) pour éviter que la scène « saute » à chaque rendu.
  const { clients, flocons } = useMemo(() => {
    const rng = new Rng(4242 + mois);
    const clients: Personne[] = Array.from({ length: nbClients }, () => ({
      x: rng.int(20, 760),
      y: rng.int(246, 262),
      peau: rng.pick(PEAUX),
      haut: rng.pick(VETEMENTS),
      bas: rng.pick(['#343a40', '#1c3d6e', '#5c4033', '#495057']),
      duree: rng.int(7, 16),
      distance: rng.int(-140, 140),
      echelle: rng.range(0.9, 1.1),
    }));
    const flocons = Array.from({ length: 36 }, () => ({
      x: rng.int(0, 800),
      y: rng.int(-280, 0),
      r: rng.range(1.2, 3),
      duree: rng.range(5, 11),
      couleur: '',
    }));
    return { clients, flocons };
  }, [nbClients, mois]);

  const [cielHaut, cielBas] = CIEL[saison];
  const feuilles = FEUILLAGE[saison];
  const enseigne = nom.length > 24 ? `${nom.slice(0, 23)}…` : nom;
  const baristas = Math.min(nbEmployes, 4);
  const description = `Façade de ${nom} ${NOMS_SAISONS[saison]} : environ ${Math.round(clientsParJour)} clients par jour et ${nbEmployes} employé${nbEmployes > 1 ? 's' : ''}.`;

  return (
    <svg
      viewBox="0 0 800 300"
      className="h-auto w-full rounded-xl border border-bordure"
      role="img"
      aria-label={description}
    >
      <defs>
        <linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cielHaut} />
          <stop offset="1" stopColor={cielBas} />
        </linearGradient>
        <pattern id="auvent" width="24" height="10" patternUnits="userSpaceOnUse">
          <rect width="12" height="10" fill={couleur} />
          <rect x="12" width="12" height="10" fill="#ffffff" />
        </pattern>
      </defs>
      <rect width="800" height="300" fill="url(#ciel)" />
      {saison === 'ete' && <circle cx="700" cy="50" r="26" fill="#ffd43b" />}

      {/* Bâtiments des concurrents, en arrière-plan */}
      {concurrents.slice(0, 2).map((c, i) => {
        const x = i === 0 ? 10 : 590;
        return (
          <g key={c.nom} opacity="0.92">
            <rect x={x} y={100} width={200} height={140} fill="#d6d3cc" />
            <rect x={x} y={92} width={200} height={14} fill="#a8a29e" />
            <rect x={x + 20} y={112} width={160} height={22} rx={3} fill={c.couleur} />
            <text
              x={x + 100}
              y={127}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill="#ffffff"
            >
              {c.nom.length > 24 ? `${c.nom.slice(0, 23)}…` : c.nom}
            </text>
            <rect x={x + 20} y={148} width={70} height={55} fill="#bcd7ee" />
            <rect x={x + 120} y={150} width={50} height={90} fill="#6b5b4b" />
            {saison === 'hiver' && (
              <rect x={x - 4} y={86} width={208} height={8} rx={4} fill="#ffffff" />
            )}
          </g>
        );
      })}

      {/* Arbre */}
      <g>
        <rect x="226" y="150" width="12" height="90" fill="#7a5230" />
        {feuilles.length > 0 ? (
          <>
            <rect x="196" y="100" width="72" height="56" rx="10" fill={feuilles[0]} />
            <rect
              x="206"
              y="84"
              width="52"
              height="30"
              rx="10"
              fill={feuilles[1 % feuilles.length]}
            />
            {saison === 'printemps' && (
              <rect x="214" y="112" width="10" height="10" rx="3" fill="#f4a7c4" />
            )}
          </>
        ) : (
          <>
            <rect
              x="214"
              y="118"
              width="6"
              height="34"
              fill="#7a5230"
              transform="rotate(-25 217 150)"
            />
            <rect
              x="244"
              y="118"
              width="6"
              height="34"
              fill="#7a5230"
              transform="rotate(25 247 150)"
            />
            <rect x="208" y="112" width="48" height="8" rx="4" fill="#ffffff" />
          </>
        )}
      </g>

      {/* Le commerce du joueur */}
      <g>
        <rect x="270" y="62" width="300" height="178" fill="#f4efe6" />
        <rect x="262" y="52" width="316" height="16" fill="#8d8478" />
        {saison === 'hiver' && (
          <rect x="258" y="44" width="324" height="10" rx="5" fill="#ffffff" />
        )}
        <rect x="292" y="74" width="256" height="30" rx="4" fill={couleur} />
        <text x="420" y="95" textAnchor="middle" fontSize="17" fontWeight="800" fill="#ffffff">
          {enseigne}
        </text>
        <rect x="278" y="110" width="284" height="18" fill="url(#auvent)" />
        <rect x="278" y="126" width="284" height="4" fill={couleur} />
        {/* Vitrine avec les employés au comptoir */}
        <rect
          x="290"
          y="138"
          width="180"
          height="88"
          fill="#cfe6f7"
          stroke="#8d8478"
          strokeWidth="4"
        />
        <rect x="294" y="196" width="172" height="26" fill="#a47148" />
        {Array.from({ length: baristas }, (_, i) => (
          <g key={i} transform={`translate(${318 + i * 40} 196)`}>
            <rect x={-6} y={-36} width={12} height={12} rx={2} fill={PEAUX[i % PEAUX.length]} />
            <rect x={-8} y={-24} width={16} height={24} rx={2} fill="#343a40" />
            <rect x={-6} y={-22} width={12} height={18} fill="#f8f9fa" opacity="0.9" />
          </g>
        ))}
        {baristas === 0 && (
          <text x="380" y="180" textAnchor="middle" fontSize="12" fill="#495057">
            Personne au comptoir
          </text>
        )}
        {/* Porte */}
        <rect x="490" y="146" width="56" height="94" fill="#5c4033" />
        <rect x="498" y="156" width="40" height="44" fill="#cfe6f7" />
        <rect x="532" y="196" width="6" height="6" rx="3" fill="#ffd43b" />
      </g>

      {/* Terrasse l'été */}
      {saison === 'ete' && (
        <g>
          {[300, 360, 420].map((x) => (
            <g key={x}>
              <rect x={x} y={232} width={30} height={5} fill="#868e96" />
              <rect x={x + 13} y={202} width={4} height={34} fill="#868e96" />
              <rect x={x - 6} y={196} width={42} height={10} rx={5} fill={couleur} />
            </g>
          ))}
        </g>
      )}

      {/* Trottoir et rue */}
      <rect
        x="0"
        y="240"
        width="800"
        height="26"
        fill={saison === 'hiver' ? '#f1f3f5' : '#ced4da'}
      />
      <rect x="0" y="266" width="800" height="34" fill="#495057" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={i * 84 + 10} y="281" width="44" height="4" fill="#f8f9fa" />
      ))}

      {/* Clients */}
      {clients.map((p, i) => (
        <PersonneBloc key={i} p={p} anime={anime} tuque={saison === 'hiver'} />
      ))}

      {/* Neige ou feuilles qui tombent */}
      {(saison === 'hiver' || saison === 'automne') &&
        flocons
          .slice(0, saison === 'hiver' ? 36 : 14)
          .map((f, i) =>
            saison === 'hiver' ? (
              <circle
                key={i}
                cx={f.x}
                cy={f.y}
                r={f.r}
                fill="#ffffff"
                className="anim-tomber"
                style={{ '--duree': `${f.duree}s` } as CSSProperties}
              />
            ) : (
              <rect
                key={i}
                x={f.x}
                y={f.y}
                width={5}
                height={4}
                rx={1}
                fill={feuilles[i % feuilles.length]}
                className="anim-tomber"
                style={{ '--duree': `${f.duree + 3}s` } as CSSProperties}
              />
            ),
          )}
    </svg>
  );
}
