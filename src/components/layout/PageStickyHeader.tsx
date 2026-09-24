import type {ReactNode} from 'react'

import {cn} from '../../lib/utils'

type PageStickyHeaderProps = {
    children: ReactNode
    /** Espaço externo de quem consome (ex.: distância até o conteúdo abaixo). */
    className?: string
}

/**
 * Faixa de cabeçalho fixa ESPECÍFICA de uma página do dashboard.
 *
 * Representa só o conceito estrutural: uma faixa que permanece visível no topo
 * do `main` rolável enquanto o conteúdo da própria página desce. Nenhuma regra
 * de página mora aqui; quem decide o conteúdo, e se a faixa existe, é a página
 * que a renderiza. Páginas que não a usam não mudam em nada.
 *
 * O posicionamento é `sticky top-0` dentro da rolagem única do shell, sem
 * nenhum offset compensando a altura do cabeçalho: o `AppHeader` segue fora do
 * `main` e a faixa simplesmente encosta na borda inferior dele. A classe
 * `page-sticky-header` aciona a regra estrutural de `styles.css` que zera o
 * `padding-top` do `main` quando a faixa existe: o Chromium limita um `sticky`
 * à área interna DEPOIS do padding do rolável, e com o respiro no `main` a
 * faixa ficaria presa 22px abaixo do cabeçalho, com o conteúdo vazando nessa
 * fresta. A margem negativa espelha só o respiro horizontal do `main`
 * (`px-[26px]` no `DashboardLayout`) para a faixa ocupar a largura útil
 * inteira, com a mesma superfície opaca do cabeçalho; a borda inferior separa
 * a faixa do conteúdo que rola por baixo. `z-[1]` é o menor nível acima dos
 * painéis da página, que não têm z-index, e é só disso que a faixa precisa: a
 * barra superior do `DashboardLayout` tem contexto próprio em `z-40`, então o
 * menu do usuário aberto sobre a faixa continua por cima dela.
 */
export function PageStickyHeader({children, className}: PageStickyHeaderProps) {
    return (
        <div
            className={cn(
                'page-sticky-header sticky top-0 z-[1] -mx-[26px] border-b border-[var(--border)] bg-[var(--surface)]',
                className,
            )}
        >
            {children}
        </div>
    )
}
