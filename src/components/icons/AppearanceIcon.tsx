import type { SVGProps } from 'react'

type AppearanceIconProps = Omit<SVGProps<SVGSVGElement>, 'height' | 'width'> & {
  /** Mesma métrica dos ícones lucide usados na sidebar (viewBox 24 com traço 2). */
  size?: number
}

/**
 * Círculo com a metade esquerda preenchida e a direita vazada: representa a
 * divisão entre o tema claro e o escuro. É o símbolo fixo do controle, então
 * não indica qual tema está ativo; quem mostra o estado é a chave ao lado.
 */
export function AppearanceIcon({ size = 24, ...props }: AppearanceIconProps) {
  return (
    // aria-hidden vem antes do spread para continuar decorativo por padrão, e
    // ainda assim poder ser sobrescrito por quem usa, como nos ícones lucide.
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Arco do topo até a base pelo lado esquerdo, fechado pela vertical do
          meio: preenche exatamente metade do círculo. Desenhado antes do
          contorno para o traço do círculo ficar por cima. */}
      <path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor" fillOpacity={0.65} stroke="none" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  )
}
