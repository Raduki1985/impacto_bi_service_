import { createContext } from 'react'

/**
 * Estado da fonte que alimenta a página aberta.
 *
 * Existe por causa do selo do cabeçalho. Ele nasceu quando toda página lia uma
 * base local, sempre pronta, e por isso dizia "Atualizado" o tempo inteiro.
 * Com as Visões Gerais ligadas ao serviço de BI isso deixou de ser verdade: a
 * página pode estar buscando ou pode ter falhado, e o cabeçalho continuava
 * afirmando que o dado estava atualizado enquanto o corpo da tela dizia que o
 * serviço não respondeu.
 *
 * `loading` cobre os dois momentos de espera, o primeiro carregamento e a
 * releitura depois de trocar um filtro: dos dois lados o que está na tela
 * ainda não é o resultado do recorte pedido.
 */
export type PageSourceStatus = 'ready' | 'loading' | 'unavailable'

/** Função que a página usa para informar o próprio estado ao cabeçalho. */
export type ReportPageSourceStatus = (status: PageSourceStatus) => void

/**
 * Fora do layout do dashboard não existe cabeçalho para avisar, então o padrão
 * ignora o aviso. É isso que mantém as páginas renderizáveis isoladamente nos
 * testes, sem montar o portal inteiro em volta.
 */
export const PageSourceStatusContext = createContext<ReportPageSourceStatus>(() => {})
