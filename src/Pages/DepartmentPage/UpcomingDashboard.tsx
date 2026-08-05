/**
 * Conteúdo central de uma página departamental que ainda não tem dashboard
 * próprio.
 *
 * Um componente só para todos os departamentos: o que muda é o nome da página e
 * o do departamento, que chegam por parâmetro e vêm dos catálogos oficiais.
 *
 * O painel repete o padrão já usado nas Visões Gerais dos dez departamentos:
 * fundo branco, borda discreta, texto secundário e o mesmo respiro interno. Sem
 * ilustração, sem animação, sem indicador e sem aparência de erro, porque não é
 * erro nenhum: a página existe, está liberada e abre normalmente.
 */
export function UpcomingDashboard({
  departmentLabel,
  pageLabel,
}: {
  departmentLabel: string
  pageLabel: string
}) {
  return (
    <div className="rounded-xl border border-[#e4e7ee] bg-white p-6 text-[13px] leading-6 text-[#667085]">
      O dashboard {pageLabel} do departamento {departmentLabel} será exibido aqui em uma etapa
      futura.
    </div>
  )
}
