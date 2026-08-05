import type { DepartmentCoverage } from './accessProfilesPreviewModel'

/**
 * Indicador de um departamento concedido, que é também o medidor de cobertura.
 *
 * Mostra o nome do departamento e a fração de páginas disponíveis que o perfil
 * libera nele, com preenchimento proporcional da esquerda para a direita dentro
 * do próprio indicador: `12/13` preenche cerca de 92%.
 *
 * Todos os departamentos usam a mesma identidade azul do portal. A cor não
 * distingue departamento nenhum, e é justamente por isso que ela não precisa
 * ser calculada, sorteada nem persistida: o que distingue um indicador do outro
 * é o nome e a fração, que estão escritos.
 *
 * O que a cor comunica é apenas a proporção, e mesmo isso não fica só nela: o
 * preenchimento é mais forte que o fundo para o olho, e a fração diz o mesmo em
 * número. O nome acessível completo acompanha o indicador para quem usa leitor
 * de tela, no lugar do texto abreviado que aparece na tela.
 *
 * Renderiza somente `span`: os indicadores aparecem dentro dos cards, que são
 * botões, e um elemento de bloco ali dentro produziria marcação inválida.
 */

/**
 * Azul institucional em quatro tons, literais como as demais cores desta área.
 *
 * O painel das Configurações é branco fixo nos dois temas, e o contraste entre
 * `FILL` e `SURFACE` é o que mantém a área preenchida visível sem transformar o
 * indicador em um selo azul chapado. O texto é o tom mais escuro dos quatro e
 * continua legível sobre os dois fundos.
 */
const SURFACE = '#f4f7fc'
const FILL = '#dce7ff'
const BORDER = '#c8d4ea'
const TEXT = '#274a8a'

export function DepartmentCoverageChip({
  coverage,
  label,
}: {
  coverage: DepartmentCoverage
  label: string
}) {
  return (
    <span
      className="relative inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-1 text-[11.5px] font-semibold leading-4"
      style={{ backgroundColor: SURFACE, borderColor: BORDER, color: TEXT }}
      title={coverage.accessibleLabel}
    >
      {/* Preenchimento atrás do texto, preso à borda esquerda e recortado pelo
          arredondamento do indicador. Sem largura quando a cobertura é zero. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0"
        style={{ backgroundColor: FILL, width: `${coverage.percent}%` }}
      />
      <span aria-hidden="true" className="relative min-w-0 break-words">
        {label}
      </span>
      <span aria-hidden="true" className="relative flex-none tabular-nums">
        {coverage.fraction}
      </span>
      <span className="sr-only">{coverage.accessibleLabel}</span>
    </span>
  )
}
