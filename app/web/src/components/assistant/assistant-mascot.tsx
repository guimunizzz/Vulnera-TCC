/**
 * Sentinela vetorial da ajuda, desenhada com a geometria e o violeta do Vulnera.
 * Consumida pelo disparador e cabeçalho do painel; decorativa, sem imagem externa ou animação 3D.
 */
export function AssistantMascot() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
      <path d="M24 5v5M20 5h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12 16c0-3.3 2.7-6 6-6h12c3.3 0 6 2.7 6 6v15l-12 9-12-9V16Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="15" y="16" width="18" height="12" rx="5" fill="currentColor" fillOpacity=".16" />
      <path d="M19 21v2m10-2v2M20 31l4 3 4-3M8 20v7m32-7v7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
