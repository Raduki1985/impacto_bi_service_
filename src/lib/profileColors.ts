/**
 * Fonte de verdade das cores dos perfis de acesso, compartilhada pelo avatar da
 * tabela de Usuários, pelo badge de perfil e pelo avatar do cabeçalho.
 *
 * As cores são opacas e literais de propósito: tokens como `--accent-weak` têm
 * transparência e mudam de aparência conforme o fundo de cada tema, enquanto as
 * classes precisam ser estáticas para o Tailwind incluí-las no CSS final.
 *
 * Vale apenas para usuários do portal — avatares de técnicos seguem sua própria
 * identidade visual.
 */
export const profileColorClasses: Record<string, string> = {
    adm: 'bg-[#e6ebfc] text-[#003be2]',
    executive: 'bg-[#e0f2fe] text-[#0369a1]',
    analyst: 'bg-[#E8F0E5] text-[#305522]',
}
