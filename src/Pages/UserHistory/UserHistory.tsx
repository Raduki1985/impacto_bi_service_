/**
 * Aba Histórico das Configurações do Portal, hoje SEM FUNÇÃO NENHUMA.
 *
 * O Histórico era gravado e lido no `localStorage` do navegador: cada operação
 * sobre usuários e sobre Perfis de Acesso acrescentava um evento à coleção
 * `impacto-bi.userHistory`, e esta página a exibia. Esse registro foi removido
 * por inteiro — o armazenamento, os eventos e o vocabulário deles — porque um
 * histórico preso a um navegador não é auditoria: ele não acompanha a pessoa,
 * some com a limpeza do navegador e nunca viu o que foi feito de outro lugar.
 *
 * Nada o substitui por enquanto. A auditoria pertence ao `impacto-bi-service`, e
 * ele ainda não a expõe; quando expuser, é dele que esta página vai ler.
 *
 * A aba está comentada em `App.tsx`, então esta página não é alcançável pela
 * interface. Ela continua existindo apenas para a rota
 * `/dashboard/configuracoes/historico` não cair em lugar nenhum, e não lê nem
 * grava coisa alguma.
 */
export function UserHistory() {
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-5">
            <div className="flex-none">
                <h2 className="text-base font-bold text-[#1a2331]">Histórico</h2>
                <p className="mt-1 text-[13px] text-[#667085]">
                    Esta aba está desativada.
                </p>
            </div>
        </div>
    )
}
