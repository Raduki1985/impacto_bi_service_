import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

/**
 * Botão do portal.
 *
 * A ação primária é o verde do botão Entrar da tela de login, com o mesmo
 * degradê, o mesmo texto verde-escuro e o mesmo escurecer ao passar o mouse
 * (pedido do Mário em 28/09/2026). Antes era o cinza-azulado #182230, decisão
 * de 21/09/2026. O login tem estilo próprio em `Login.css` e não usa este
 * componente; as cores aqui repetem as de lá. O azul continua sendo o acento
 * do sistema, em links, seleção e no anel de foco.
 *
 * A cor é fixa nos dois temas porque todas as telas que usam este botão têm
 * superfície branca fixa, claro e escuro: Configurações e Boas-vindas. O texto
 * #06331f sobre o verde passa de 8:1.
 */
const buttonVariants = cva(
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003be2] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-linear-to-b from-[#4bdd85] to-[#34d372] text-[#06331f] shadow-sm hover:from-[#23c264] hover:to-[#16b158]',
        secondary:
          'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100',
        ghost: 'text-slate-700 hover:bg-slate-100',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 px-3',
        icon: 'h-10 w-10 px-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
