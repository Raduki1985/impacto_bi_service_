import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
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
 * A ação primária é fixa nos dois temas: o verde é opaco e o texto #06331f
 * sobre ele passa de 8:1 em qualquer superfície. As demais variantes e o anel
 * de foco seguem os tokens do portal desde 13/10/2026, quando as Configurações
 * deixaram de ser brancas fixas e passaram ao tema escuro.
 */
const buttonVariants = cva(
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-linear-to-b from-[#4bdd85] to-[#34d372] text-[#06331f] shadow-sm hover:from-[#23c264] hover:to-[#16b158]',
        secondary:
          'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-heading)] hover:bg-[var(--hover-bg)]',
        ghost: 'text-[var(--text-item)] hover:bg-[var(--hover-bg)]',
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

/**
 * Aparência de "trabalhando", e não de "indisponível".
 *
 * O botão continua `disabled`, porque enquanto a chamada está no ar um segundo
 * clique gravaria o mesmo registro duas vezes. O que muda é a leitura: sai o
 * esmaecimento de 50% do desabilitado comum, que apagaria justamente o giro que
 * prova que algo está acontecendo.
 *
 * Mesma linguagem do botão Entrar da tela de login: o ícone gira, o texto conta
 * o que está em andamento e `aria-busy` diz a mesma coisa a quem usa leitor de
 * tela.
 */
const LOADING_CLASS = 'disabled:opacity-100'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /**
     * Operação em andamento disparada por este botão: acrescenta o giro antes do
     * conteúdo e bloqueia o segundo clique.
     *
     * Ignorado com `asChild`, porque ali o Button não desenha elemento nenhum:
     * ele passa as classes para o filho único, e um segundo filho quebraria o
     * Slot do Radix.
     */
    loading?: boolean
  }

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  const isLoading = loading && !asChild

  return (
    <Comp
      aria-busy={isLoading || undefined}
      className={cn(buttonVariants({ variant, size }), isLoading && LOADING_CLASS, className)}
      disabled={isLoading || disabled}
      {...props}
    >
      {/* Fora da gravação o conteúdo vai INTEIRO, e não ao lado de um `null`:
          com `asChild` o Slot do Radix exige um filho único, e o `null` de um
          giro ausente já contaria como segundo. */}
      {isLoading ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  )
}
