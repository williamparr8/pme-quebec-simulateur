/**
 * Scène 2D animée du commerce, en blocs et en SVG (aucune image externe).
 * - Les clients entrent et sortent; leur nombre reflète l'achalandage réel du dernier mois.
 * - Une file d'attente apparaît quand des clients repartent faute de capacité.
 * - Le décor dépend du secteur (comptoir, présentoirs, entrepôt, camion, atelier…).
 * - Les saisons sont visibles (neige, feuilles orange, fleurs, terrasse l'été).
 * - Les concurrents sont dans la rue; un concurrent fermé affiche « À louer ».
 * Les animations sont en CSS : elles s'arrêtent avec prefers-reduced-motion ou la
 * préférence « Animations » du jeu. Choix du SVG plutôt que PixiJS : voir DECISIONS.md.
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
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
const VETEMENTS = ['#e64980', '#4c6ef5', '#12b886', '#fab005', '#7950f2', '#fd7e14', '#228be6'];
const BAS = ['#343a40', '#1c3d6e', '#5c4033', '#495057'];

/** Secteurs où les clients entrent dans le commerce (les autres livrent ou se déplacent). */
const SUR_PLACE = new Set(['cafe', 'vetements', 'coiffure', 'epicerie', 'atelier']);

/** Position de la porte du commerce (centre, en x). */
const PORTE_X = 512;

const style = (v: Record<string, string>) => v as CSSProperties;

interface Personne {
  x: number;
  y: number;
  peau: string;
  haut: string;
  bas: string;
  duree: number;
  delai: number;
  sortie: number;
}

function Bonhomme({
  peau,
  haut,
  bas,
  tuque,
}: {
  peau: string;
  haut: string;
  bas: string;
  tuque: boolean;
}) {
  return (
    <>
      <rect x={-5} y={-38} width={10} height={10} rx={2} fill={peau} />
      {tuque && <rect x={-6} y={-41} width={12} height={5} rx={2} fill={haut} />}
      <rect x={-7} y={-28} width={14} height={15} rx={2} fill={haut} />
      <rect x={-6} y={-13} width={5} height={13} rx={1} fill={bas} />
      <rect x={1} y={-13} width={5} height={13} rx={1} fill={bas} />
    </>
  );
}

/** Client qui marche vers la porte, entre, ressort puis s'éloigne. */
function Client({ p, tuque, entre }: { p: Personne; tuque: boolean; entre: boolean }) {
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <g
        className={entre ? 'anim-visite' : 'anim-passer'}
        style={style({
          '--duree': `${p.duree}s`,
          '--delai': `-${p.delai}s`,
          '--vers-porte': `${PORTE_X - p.x}px`,
          '--sortie': `${p.sortie - p.x}px`,
        })}
      >
        <g className="anim-sautiller">
          <Bonhomme peau={p.peau} haut={p.haut} bas={p.bas} tuque={tuque} />
        </g>
      </g>
    </g>
  );
}

function Vehicule({
  couleur,
  duree,
  delai,
  y,
  type,
}: {
  couleur: string;
  duree: number;
  delai: number;
  y: number;
  type: 'auto' | 'fourgon' | 'camion' | 'chasseNeige';
}) {
  const long = type === 'auto' ? 56 : 78;
  return (
    <g transform={`translate(0 ${y})`}>
      <g className="anim-rouler" style={style({ '--duree': `${duree}s`, '--delai': `-${delai}s` })}>
        <rect x={0} y={-22} width={long} height={18} rx={4} fill={couleur} />
        <rect
          x={type === 'auto' ? 10 : long - 26}
          y={type === 'auto' ? -32 : -34}
          width={type === 'auto' ? 32 : 24}
          height={12}
          rx={3}
          fill={type === 'auto' ? couleur : '#e9ecef'}
        />
        {type !== 'auto' && <rect x={long - 22} y={-31} width={16} height={8} fill="#a5d8ff" />}
        {type === 'camion' && <rect x={-36} y={-16} width={34} height={10} rx={2} fill="#868e96" />}
        {type === 'chasseNeige' && (
          <rect x={long - 2} y={-18} width={10} height={16} rx={2} fill="#fab005" />
        )}
        <circle cx={14} cy={-4} r={6} fill="#212529" />
        <circle cx={long - 14} cy={-4} r={6} fill="#212529" />
      </g>
    </g>
  );
}

/** Intérieur de la vitrine selon le secteur (fenêtre de 200 × 88 à partir de 262, 138). */
function Vitrine({
  secteurId,
  couleur,
  employes,
}: {
  secteurId: string;
  couleur: string;
  employes: number;
}) {
  const personnel: ReactNode = Array.from({ length: Math.min(employes, 4) }, (_, i) => (
    <g key={i} transform={`translate(${288 + i * 44} 202)`}>
      <rect x={-6} y={-36} width={12} height={12} rx={2} fill={PEAUX[i % PEAUX.length]} />
      <rect x={-8} y={-24} width={16} height={24} rx={2} fill="#343a40" />
      <rect x={-6} y={-22} width={12} height={18} fill={couleur} opacity="0.85" />
    </g>
  ));
  switch (secteurId) {
    case 'cafe':
      return (
        <>
          {personnel}
          <rect x="266" y="200" width="192" height="24" fill="#a47148" />
          <rect x="410" y="178" width="34" height="22" rx="3" fill="#868e96" />
          <rect x="416" y="172" width="8" height="6" fill="#495057" />
          <g className="anim-fumee">
            <rect x="420" y="160" width="4" height="8" rx="2" fill="#ffffff" opacity="0.8" />
          </g>
          {[280, 300, 320].map((x) => (
            <rect key={x} x={x} y={194} width={10} height={8} rx={2} fill="#ffffff" />
          ))}
        </>
      );
    case 'vetements':
      return (
        <>
          <rect x="270" y="150" width="120" height="4" fill="#868e96" />
          {VETEMENTS.slice(0, 6).map((c, i) => (
            <g key={c}>
              <rect x={276 + i * 19} y={152} width={2} height={6} fill="#868e96" />
              <rect x={270 + i * 19} y={158} width={14} height={26} rx={2} fill={c} />
            </g>
          ))}
          <g transform="translate(430 224)">
            <rect x={-6} y={-70} width={12} height={12} rx={6} fill="#dee2e6" />
            <rect x={-12} y={-58} width={24} height={34} rx={4} fill={couleur} />
            <rect x={-2} y={-24} width={4} height={24} fill="#868e96" />
          </g>
          <g transform="translate(40 0)">{personnel}</g>
          <rect x="266" y="216" width="192" height="8" fill="#ced4da" />
        </>
      );
    case 'coiffure':
      return (
        <>
          {[290, 370].map((x) => (
            <g key={x}>
              <rect x={x} y={146} width={44} height={40} rx={4} fill="#e7f5ff" stroke="#adb5bd" />
              <rect x={x + 8} y={196} width={28} height={18} rx={4} fill="#343a40" />
              <rect x={x + 18} y={212} width={8} height={12} fill="#868e96" />
            </g>
          ))}
          {personnel}
        </>
      );
    case 'epicerie':
      return (
        <>
          {[156, 182, 208].map((y) => (
            <rect key={y} x="268" y={y} width="188" height="4" fill="#a47148" />
          ))}
          {Array.from({ length: 27 }, (_, i) => (
            <circle
              key={i}
              cx={276 + (i % 9) * 21}
              cy={150 + Math.floor(i / 9) * 26}
              r={5}
              fill={['#e03131', '#f08c00', '#2f9e44', '#fab005', '#7950f2'][i % 5]}
            />
          ))}
          <g transform="translate(-10 4)">{personnel}</g>
        </>
      );
    case 'atelier':
      return (
        <>
          <rect x="268" y="196" width="150" height="10" fill="#a47148" />
          <rect x="276" y="206" width="8" height="18" fill="#7a5230" />
          <rect x="402" y="206" width="8" height="18" fill="#7a5230" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={290 + i * 30} y={186 - i * 2} width={26} height={10} fill="#d9a066" />
          ))}
          <g transform="translate(430 224)">
            <rect x={-14} y={-30} width={28} height={6} fill="#b5763a" />
            <rect x={-12} y={-24} width={4} height={24} fill="#b5763a" />
            <rect x={8} y={-24} width={4} height={24} fill="#b5763a" />
          </g>
          <g transform="translate(0 -6)">{personnel}</g>
        </>
      );
    case 'enLigne':
      return (
        <>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect
              key={i}
              x={270 + (i % 4) * 40}
              y={160 + Math.floor(i / 4) * 28}
              width={32}
              height={24}
              fill="#d9a066"
              stroke="#a47148"
            />
          ))}
          <rect x="266" y="214" width="192" height="10" fill="#495057" />
          <g transform="translate(20 0)">{personnel}</g>
        </>
      );
    default:
      // Paysagement : outils et sacs de terreau au garage.
      return (
        <>
          <rect x="270" y="196" width="40" height="28" rx="4" fill="#2f9e44" />
          <rect x="316" y="204" width="30" height="20" fill="#8d6e63" />
          <rect x="360" y="160" width="4" height="64" fill="#7a5230" />
          <rect x="352" y="156" width="20" height="8" fill="#868e96" />
          <g transform="translate(60 0)">{personnel}</g>
        </>
      );
  }
}

export interface ConcurrentScene {
  nom: string;
  couleur: string;
  ferme: boolean;
}

interface Props {
  nom: string;
  couleur: string;
  mois: number;
  secteurId: string;
  clientsParJour: number;
  /** Clients perdus par jour faute de capacité (file d'attente). */
  perdusParJour: number;
  nbEmployes: number;
  concurrents: ConcurrentScene[];
}

/** Nombre de personnages affichés : il croît avec l'achalandage, sans surcharger la scène. */
function personnagesAffiches(clientsParJour: number): number {
  return Math.max(0, Math.min(12, Math.round(2.2 * Math.log(1 + Math.max(0, clientsParJour) / 4))));
}

export function SceneCommerce({
  nom,
  couleur,
  mois,
  secteurId,
  clientsParJour,
  perdusParJour,
  nbEmployes,
  concurrents,
}: Props) {
  const saison = saisonDuMois(mois);
  const surPlace = SUR_PLACE.has(secteurId);
  const nbClients = personnagesAffiches(clientsParJour);
  const file = perdusParJour >= 1 ? Math.min(4, Math.ceil(Math.log2(1 + perdusParJour))) : 0;

  // Positions stables (graine fixe) pour éviter que la scène « saute » à chaque rendu.
  const { clients, passants, flocons } = useMemo(() => {
    const rng = new Rng(4242 + mois);
    const personne = (): Personne => {
      const gauche = rng.chance(0.5);
      return {
        x: gauche ? rng.int(-30, 200) : rng.int(600, 830),
        y: rng.int(250, 262),
        peau: rng.pick(PEAUX),
        haut: rng.pick(VETEMENTS),
        bas: rng.pick(BAS),
        duree: rng.int(14, 24),
        delai: rng.int(0, 20),
        sortie: gauche ? rng.int(640, 860) : rng.int(-60, 160),
      };
    };
    const clients = Array.from({ length: surPlace ? nbClients : 0 }, personne);
    const passants = Array.from({ length: surPlace ? 2 : 3 }, personne);
    const flocons = Array.from({ length: 36 }, () => ({
      x: rng.int(0, 800),
      y: rng.int(-280, 0),
      r: rng.range(1.2, 3),
      duree: rng.range(5, 11),
    }));
    return { clients, passants, flocons };
  }, [nbClients, mois, surPlace]);

  // Livraisons (en ligne) ou équipes sur la route (paysagement) : selon l'activité.
  const trajets = surPlace
    ? 0
    : Math.max(1, Math.min(3, Math.round(Math.log(1 + clientsParJour / 3))));
  const typeVehicule =
    secteurId === 'paysagement' ? (saison === 'hiver' ? 'chasseNeige' : 'camion') : 'fourgon';

  const [cielHaut, cielBas] = CIEL[saison];
  const feuilles = FEUILLAGE[saison];
  const enseigne = nom.length > 24 ? `${nom.slice(0, 23)}…` : nom;
  const garage = secteurId === 'paysagement' || secteurId === 'enLigne';
  const voisins = concurrents.slice(0, 4);
  const positions = [6, 120, 580, 694];
  const description =
    `Façade de ${nom} ${NOMS_SAISONS[saison]} : environ ${Math.round(clientsParJour)} clients par jour` +
    `${file > 0 ? `, une file d’attente (environ ${Math.round(perdusParJour)} clients perdus par jour)` : ''}` +
    ` et ${nbEmployes} employé${nbEmployes > 1 ? 's' : ''}. ` +
    `${voisins.filter((c) => !c.ferme).length} concurrent(s) en activité dans la rue` +
    `${voisins.some((c) => c.ferme) ? `, ${voisins.filter((c) => c.ferme).length} local(aux) à louer` : ''}.`;

  return (
    <svg
      viewBox="0 0 800 300"
      className="scene h-auto w-full overflow-hidden rounded-xl border border-bordure"
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
        <pattern id="poteau" width="10" height="16" patternUnits="userSpaceOnUse">
          <rect width="10" height="16" fill="#ffffff" />
          <rect y="0" width="10" height="5" fill="#e03131" />
          <rect y="8" width="10" height="5" fill="#1c7ed6" />
        </pattern>
        <clipPath id="decoupe">
          <rect width="800" height="300" />
        </clipPath>
      </defs>
      <g clipPath="url(#decoupe)">
        <rect width="800" height="300" fill="url(#ciel)" />
        {saison === 'ete' && <circle cx="700" cy="44" r="24" fill="#ffd43b" />}
        <g className="anim-nuage" opacity="0.85">
          <rect x="80" y="30" width="70" height="18" rx="9" fill="#ffffff" />
          <rect x="100" y="20" width="40" height="18" rx="9" fill="#ffffff" />
        </g>
        {/* Silhouette de la ville au loin */}
        {[0, 70, 150, 640, 720].map((x, i) => (
          <rect
            key={x}
            x={x}
            y={60 + (i % 3) * 14}
            width={60}
            height={200}
            fill="#adb5bd"
            opacity="0.35"
          />
        ))}

        {/* Concurrents (4 locaux voisins) */}
        {voisins.map((c, i) => {
          const x = positions[i];
          const h = 120 + (i % 2) * 18;
          return (
            <g key={c.nom}>
              <rect
                x={x}
                y={240 - h}
                width={104}
                height={h}
                fill={c.ferme ? '#c8c4bd' : '#d6d3cc'}
              />
              <rect x={x - 3} y={232 - h} width={110} height={10} fill="#a8a29e" />
              {saison === 'hiver' && (
                <rect x={x - 5} y={226 - h} width={114} height={7} rx={3} fill="#ffffff" />
              )}
              <rect
                x={x + 8}
                y={248 - h}
                width={88}
                height={18}
                rx={3}
                fill={c.ferme ? '#868e96' : c.couleur}
              />
              <text
                x={x + 52}
                y={261 - h}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#ffffff"
              >
                {c.nom.length > 18 ? `${c.nom.slice(0, 17)}…` : c.nom}
              </text>
              <rect
                x={x + 10}
                y={176}
                width={44}
                height={40}
                fill={c.ferme ? '#868e96' : '#bcd7ee'}
              />
              <rect x={x + 64} y={180} width={30} height={60} fill="#6b5b4b" />
              {c.ferme && (
                <g>
                  <rect x={x + 12} y={186} width={40} height={16} fill="#ffffff" />
                  <text
                    x={x + 32}
                    y={198}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="800"
                    fill="#c92a2a"
                  >
                    À LOUER
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Arbres sur le trottoir */}
        {[226, 572].map((x) => (
          <g key={x}>
            <rect x={x} y={168} width={10} height={72} fill="#7a5230" />
            {feuilles.length > 0 ? (
              <>
                <rect x={x - 24} y={124} width={58} height={48} rx={10} fill={feuilles[0]} />
                <rect
                  x={x - 14}
                  y={110}
                  width={38}
                  height={26}
                  rx={10}
                  fill={feuilles[1 % feuilles.length]}
                />
              </>
            ) : (
              <rect x={x - 18} y={150} width={46} height={7} rx={3} fill="#ffffff" />
            )}
          </g>
        ))}

        {/* Le commerce du joueur */}
        <g>
          <rect x="250" y="62" width="300" height="178" fill="#f4efe6" />
          <rect x="242" y="52" width="316" height="16" fill="#8d8478" />
          {saison === 'hiver' && (
            <rect x="238" y="44" width="324" height="10" rx="5" fill="#ffffff" />
          )}
          <rect x="272" y="74" width="256" height="30" rx="4" fill={couleur} />
          <text x="400" y="95" textAnchor="middle" fontSize="17" fontWeight="800" fill="#ffffff">
            {enseigne}
          </text>
          <rect x="258" y="110" width="284" height="18" fill="url(#auvent)" />
          <rect x="258" y="126" width="284" height="4" fill={couleur} />
          <rect
            x="262"
            y="138"
            width="200"
            height="88"
            fill="#cfe6f7"
            stroke="#8d8478"
            strokeWidth="4"
          />
          <Vitrine secteurId={secteurId} couleur={couleur} employes={nbEmployes} />
          {nbEmployes === 0 && (
            <text x="362" y="180" textAnchor="middle" fontSize="12" fill="#495057">
              Personne en poste
            </text>
          )}
          {garage ? (
            <g>
              <rect x="476" y="146" width="66" height="94" fill="#868e96" />
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <rect key={i} x="476" y={152 + i * 12} width="66" height="2" fill="#5c636a" />
              ))}
            </g>
          ) : (
            <g>
              <rect x="484" y="146" width="56" height="94" fill="#5c4033" />
              <rect x="492" y="156" width="40" height="44" fill="#cfe6f7" />
              <rect x="526" y="196" width="6" height="6" rx="3" fill="#ffd43b" />
            </g>
          )}
          {secteurId === 'coiffure' && (
            <g>
              <rect x="546" y="150" width="10" height="48" rx="5" fill="#ffffff" />
              <rect
                x="546"
                y="150"
                width="10"
                height="48"
                rx="5"
                fill="url(#poteau)"
                className="anim-poteau"
              />
            </g>
          )}
        </g>

        {/* Terrasse l'été (café) et étals de fruits (épicerie, hors hiver) */}
        {saison === 'ete' && secteurId === 'cafe' && (
          <g>
            {[286, 346, 406].map((x) => (
              <g key={x}>
                <rect x={x} y={232} width={30} height={5} fill="#868e96" />
                <rect x={x + 13} y={202} width={4} height={34} fill="#868e96" />
                <rect x={x - 6} y={196} width={42} height={10} rx={5} fill={couleur} />
              </g>
            ))}
          </g>
        )}
        {secteurId === 'epicerie' && saison !== 'hiver' && (
          <g>
            {[270, 330, 390].map((x, i) => (
              <g key={x}>
                <rect x={x} y={226} width={48} height={14} fill="#a47148" />
                {[0, 1, 2, 3].map((k) => (
                  <circle
                    key={k}
                    cx={x + 8 + k * 11}
                    cy={224}
                    r={5}
                    fill={['#e03131', '#fab005', '#2f9e44'][i]}
                  />
                ))}
              </g>
            ))}
          </g>
        )}
        {secteurId === 'paysagement' && saison !== 'hiver' && (
          <rect x="560" y="236" width="240" height="6" fill="#51cf66" />
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

        {/* Circulation : une voiture de passage, puis les livraisons ou les camions de l'entreprise */}
        <Vehicule couleur="#748ffc" duree={13} delai={4} y={296} type="auto" />
        {Array.from({ length: trajets }, (_, i) => (
          <Vehicule
            key={i}
            couleur={couleur}
            duree={10 + i * 3}
            delai={i * 4}
            y={290}
            type={typeVehicule}
          />
        ))}

        {/* File d'attente devant la porte : des clients attendent (et certains repartent) */}
        {surPlace &&
          Array.from({ length: file }, (_, i) => (
            <g key={i} transform={`translate(${470 - i * 18} 256)`}>
              <g className="anim-sautiller">
                <Bonhomme
                  peau={PEAUX[(i + 2) % PEAUX.length]}
                  haut={VETEMENTS[(i + 3) % VETEMENTS.length]}
                  bas="#343a40"
                  tuque={saison === 'hiver'}
                />
              </g>
            </g>
          ))}

        {/* Clients et passants */}
        {clients.map((p, i) => (
          <Client key={`c${i}`} p={p} tuque={saison === 'hiver'} entre />
        ))}
        {passants.map((p, i) => (
          <Client key={`p${i}`} p={p} tuque={saison === 'hiver'} entre={false} />
        ))}

        {/* Neige, feuilles ou pluie qui tombent */}
        {saison !== 'ete' &&
          flocons
            .slice(0, saison === 'hiver' ? 36 : saison === 'automne' ? 14 : 10)
            .map((f, i) =>
              saison === 'hiver' ? (
                <circle
                  key={i}
                  cx={f.x}
                  cy={f.y}
                  r={f.r}
                  fill="#ffffff"
                  className="anim-tomber"
                  style={style({ '--duree': `${f.duree}s` })}
                />
              ) : saison === 'automne' ? (
                <rect
                  key={i}
                  x={f.x}
                  y={f.y}
                  width={5}
                  height={4}
                  rx={1}
                  fill={feuilles[i % feuilles.length]}
                  className="anim-tomber"
                  style={style({ '--duree': `${f.duree + 3}s` })}
                />
              ) : (
                <rect
                  key={i}
                  x={f.x}
                  y={f.y}
                  width={2}
                  height={8}
                  fill="#74c0fc"
                  opacity="0.7"
                  className="anim-tomber"
                  style={style({ '--duree': `${f.duree / 3}s` })}
                />
              ),
            )}
      </g>
    </svg>
  );
}
