/**
 * Fonte de verdade das cores dos perfis de acesso, compartilhada pelo avatar da
 * tabela de Usuários, pelo badge de perfil e pelo avatar do cabeçalho.
 *
 * Cada entrada é uma classe de `src/styles.css`, com o par de cada tema: no
 * claro as cores opacas de sempre, no escuro a cor clara sobre a própria cor
 * misturada com transparente, como o chip de filtro das faixas. Até
 * 13/10/2026 eram literais do Tailwind, opacas e só do claro, porque as telas
 * que as usavam eram brancas fixas nos dois temas.
 *
 * Vale apenas para usuários do portal, avatares de técnicos seguem sua própria
 * identidade visual.
 */
export const profileColorClasses: Record<string, string> = {
    adm: 'impacto-profile-adm',
    executive: 'impacto-profile-executive',
    analyst: 'impacto-profile-analyst',
}

export function profileColorClass(code: string | undefined) {
    return profileColorClasses[code ?? ''] ?? 'impacto-profile-unknown'
}
