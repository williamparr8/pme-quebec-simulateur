/** Logo en blocs, généré en SVG (aucune image externe). */
export function Logo({ taille = 48 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="18" width="40" height="26" rx="4" fill="#0b5cd5" />
      <rect x="8" y="6" width="32" height="14" rx="3" fill="#f59e0b" />
      <rect x="8" y="16" width="32" height="5" fill="#ffffff" opacity="0.9" />
      <rect x="10" y="26" width="10" height="9" rx="1.5" fill="#bfdbfe" />
      <rect x="28" y="28" width="10" height="16" rx="1.5" fill="#ffffff" />
      <rect x="15" y="9" width="18" height="5" rx="1" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}
