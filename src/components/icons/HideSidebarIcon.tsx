type HideSidebarIconProps = {
  /** Mesma métrica dos ícones lucide usados no header (viewBox 24 com traço 2). */
  size?: number
  className?: string
}

/** Painel com a lateral preenchida e a seta para a esquerda: indica recolher o menu lateral. */
export function HideSidebarIcon({ size = 24, className }: HideSidebarIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4z"
        fill="currentColor"
        fillOpacity={0.35}
        stroke="none"
      />
      <rect height="18" rx="2" width="18" x="3" y="3" />
      <path d="M15 3v18" />
      <path d="M12 12H6.5" />
      <path d="m9.5 9-3 3 3 3" />
    </svg>
  )
}
