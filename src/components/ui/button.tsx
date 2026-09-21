import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

/**
 * Botão do portal.
 *
 * A ação primária é o cinza-azulado escuro #182230, decisão do Mário em
 * 21/09/2026, e não mais o azul #003be2 do rebrand. É o mesmo tom da faixa da
 * marca no topo (`--brand-strip-bg`), então o botão passa a repetir a cor que já
 * fecha a moldura do portal, em vez de disputar atenção com ela. O azul continua
 * sendo o acento do sistema, em links, seleção e no anel de foco, e continua
 * sendo a cor do botão de entrar na tela de login, que tem estilo próprio e não
 * usa este componente.
 *
 * A cor é fixa nos dois temas porque todas as telas que usam este botão têm
 * superfície branca fixa, claro e escuro: Configurações e Boas-vindas. Sobre
 * branco, o contraste do texto passa de 16:1. Se algum dia um botão primário for
 * parar em um painel que acompanha o tema, ele vai precisar de um token por
 * tema, porque no escuro a superfície é esse mesmo #182230 e o botão sumiria.
 */
const buttonVariants = cva(
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003be2] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-[#182230] text-white shadow-sm hover:bg-[#101828]',
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
