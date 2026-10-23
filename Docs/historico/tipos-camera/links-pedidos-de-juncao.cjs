// Links do GitLab para abrir os pedidos de junção de 21/10/2026 já preenchidos.
// O Mário abre, confere e clica em Criar: o autor é quem está logado.
const CAIO = 220806 // usuário caioherrera no GitLab (busca pública)

const pedidos = [
  {
    repo: 'impacto-bi-service',
    source: 'fix/os-tipos-de-camera',
    title: 'fix(os): tipos de câmera como no SGI',
    description: [
      '## O que muda',
      '- Reconhece o tipo `security_maintenance` ("Manutenção de Câmeras"). Desde 21/10/2026, 09h15, o SGI passou as 9 categorias de manutenção de câmera para ele (355 OS, inclusive as antigas), e o BI mostrava o código cru no filtro Tipo de OS, nas listas e na rosca de tipos.',
      '- Os três tipos de câmera passam a ser escritos como no cadastro de tipos do SGI, no plural: "Instalação de Câmeras", "Manutenção de Câmeras", "Retirada de Câmeras". O singular antigo continua aceito.',
      '- Consultas de referência do DataGrip (`app/sql/os/98` e `99`) atualizadas.',
      '',
      '## Atenção',
      'Precisa ser publicado junto com o pedido do portal da branch `fix/os-tipos-de-camera`. Se só um subir, a fatia de câmera fica sem cor e os técnicos de câmera caem em "Outros serviços" até o outro chegar.',
      '',
      '## Testes',
      'Testes de OS: 172 passaram. As 4 falhas (formato da resposta dos endpoints, `updatedAt` x `updated_at`) já falham na develop, sem relação com esta mudança.',
    ].join('\n'),
  },
  {
    repo: 'impacto-bi-web',
    source: 'fix/os-tipos-de-camera',
    title: 'fix(os): tipos de câmera como no SGI',
    description: [
      '## O que muda',
      '- Os três tipos de câmera escritos como no SGI, no plural: "Instalação de Câmeras", "Manutenção de Câmeras", "Retirada de Câmeras".',
      '- Rosca "Composição por tipo de OS": cor própria para os dois tipos novos, com contraste medido nos dois temas. Manutenção de Câmeras em fúcsia `#c026d3` (4,71 claro, 3,12 escuro) e Retirada de Câmeras em `#5b8a86` (3,87 e 3,79).',
      '- Página de Técnicos: Instalação, Manutenção e Retirada de Câmeras formam a frente Câmeras (antes manutenção e retirada caíam em "Outros serviços").',
      '- A base local antiga (agosto) continua escrita no singular e é lida como o plural, sem reescrever o arquivo.',
      '',
      '## Atenção',
      'Precisa ser publicado junto com o pedido do serviço da branch `fix/os-tipos-de-camera`.',
      '',
      '## Testes',
      'lint ok, build ok, 2.317 testes passaram. A única falha é a antiga de `DefinePassword.test.tsx` ("10 minutos"), sem relação.',
    ].join('\n'),
  },
  {
    repo: 'impacto-bi-web',
    source: 'feat/os-rosca-tipo-lista',
    title: 'feat(os): lista na rosca de tipos e legenda que só destaca',
    description: [
      '## O que muda',
      '- Clique numa fatia da rosca "Composição por tipo de OS" abre a janela de lista com as OS daquele tipo, com o mesmo número da fatia, atalhos "Todas" e um por tipo, e Baixar Excel.',
      '- A lista segue a regra da rosca: tipo da fatia, sem os filtros Tipo de OS e Categoria da página, e Status solto quando todo marcado (como o `effective_selection` do serviço). Usa o painel `all` de `/bi/os/overview/period/records`; o serviço não muda.',
      '- Clique na legenda não esconde mais a fatia: destaca o tipo e esmaece os outros, como o filtro Tipo de OS. O subtítulo diz qual tipo está destacado e como tirar.',
      '',
      '## Depende de',
      'Pedido do portal da branch `fix/os-tipos-de-camera`. Enquanto ele não entrar, este pedido mostra os dois commits.',
      '',
      '## Testes',
      'lint ok, build ok, 2.335 testes passaram. A única falha é a antiga de `DefinePassword.test.tsx`. Sugestão para o serviço: um teste provando que `period_records(panel="all")` com o tipo da fatia bate com `service_type_slices`.',
    ].join('\n'),
  },
]

for (const p of pedidos) {
  const params = [
    ['merge_request[source_branch]', p.source],
    ['merge_request[target_branch]', 'develop'],
    ['merge_request[title]', p.title],
    ['merge_request[description]', p.description],
    ['merge_request[reviewer_ids][]', String(CAIO)],
  ]
  const query = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  console.log(`${p.repo} | ${p.source}`)
  console.log(`https://gitlab.com/impacto-business/${p.repo}/-/merge_requests/new?${query}`)
  console.log('')
}
