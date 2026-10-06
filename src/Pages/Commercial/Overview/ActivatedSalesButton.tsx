/**
 * Ícone do card Vendas ativadas que abre a lista das vendas ativadas do
 * período (06/10/2026). O desenho é o ícone de arquivo XLSX que o Mário
 * trouxe no mesmo dia: a folha com a dobra e a faixa escrita "XLSX"
 * atravessando. Ele substituiu a folha com tabela e selo de seta, que
 * vinha numa caixa verde; a caixa saiu a pedido dele, e o ícone ficou solto
 * no canto, como o olho dos R$ no card ao lado.
 *
 * Mora na pasta da página, e não em `components`, porque só este card o usa.
 * A cor é a das ações de texto do portal (`impacto-text-action`): o azul do
 * acento no tema claro e o verde no escuro, onde o azul não alcança
 * contraste. O clique e o teclado param aqui: sem isso, o mesmo clique
 * viraria o card para a leitura gerencial, como no olho dos R$.
 */

function XlsxFileIcon() {
  return (
    <svg aria-hidden="true" fill="none" height={20} viewBox="0 0 24 24" width={20}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}>
        <path d="M13.5 2.8H7a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.3z" />
        <path d="M13.5 2.8v3.5a2 2 0 0 0 2 2H19" />
      </g>
      {/* A faixa atravessa a folha, como no ícone original; as letras saem
          na cor da superfície do card, nos dois temas. */}
      <rect fill="currentColor" height="6.6" rx="1.4" width="19.6" x="2.2" y="10.6" />
      <text
        fill="var(--surface)"
        fontFamily="Inter, Segoe UI, system-ui, sans-serif"
        fontSize="5.4"
        fontWeight={800}
        letterSpacing="-0.15"
        textAnchor="middle"
        x="12"
        y="15.9"
      >
        XLSX
      </text>
    </svg>
  )
}

export function ActivatedSalesButton({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button
      aria-label={label}
      className="impacto-text-action flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-xl text-[var(--accent)] transition-colors hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
      onKeyDown={(event) => event.stopPropagation()}
      title={label}
      type="button"
    >
      <XlsxFileIcon />
    </button>
  )
}
