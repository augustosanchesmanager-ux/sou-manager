# Definicao Oficial da Arquitetura de Acesso - SMG

## Visao Geral

A plataforma **SMG - Sou.Manager** deve operar com acesso centralizado em `soumanager.com`, que representa:

- a landing page institucional da marca;
- o portal principal de acesso;
- o ponto central de entrada da plataforma.

Os sistemas operacionais devem ser publicados em subdominios proprios, com separacao clara entre marca, autenticacao e operacao.

## Estrutura de Dominios

### Dominio principal

- `soumanager.com`
  - landing page institucional da **SMG**
  - portal principal de acesso
  - entrada central da plataforma

### Subdominios de sistemas

- `barber.soumanager.com` -> **SMG Barber** (ÚNICO SISTEMA ATIVO)

> **Nota:** Domínios para futuros sistemas serão definidos quando houver decisão oficial do Product Owner.

## Problema identificado

A landing page estava sendo exibida em todos os dominios e subdominios porque o mesmo projeto estava atendendo multiplos hosts dentro da Vercel com fallback global de SPA.

Na pratica:

- qualquer requisicao era reescrita para `index.html`;
- o servidor nao distinguia `soumanager.com` dos subdominios operacionais;
- o frontend iniciava sempre na mesma experiencia base;
- todos os hosts acabavam carregando a landing institucional da **SMG**.

## Solucao implementada na base atual

Foi criada uma base de roteamento orientada por hostname para que a aplicacao mude de comportamento conforme o dominio acessado.

### Regras atuais

- `soumanager.com`
  - exibe a landing page quando o usuario nao esta autenticado
  - envia o usuario autenticado para a tela de selecao de sistema

- subdominios de app
  - direcionam o usuario diretamente para login ou dashboard
  - nao passam pela landing institucional

### Melhorias aplicadas

- rota inicial inteligente baseada no host
- tela central de selecao de sistemas
- catalogo centralizado de apps e hostnames
- CTA principal da landing apontando para o portal de acesso

## Fluxo de acesso esperado

### Entrada pelo dominio principal

1. O usuario acessa `soumanager.com`.
2. Visualiza a landing page institucional da **SMG**.
3. Clica em `Acessar plataforma`.
4. Realiza login.
5. Escolhe o sistema desejado:
   - `SMG Barber` (ÚNICO SISTEMA ATIVO)
6. E redirecionado para o subdominio correspondente.

### Entrada por subdominio direto

1. O usuario acessa, por exemplo, `barber.soumanager.com`.
2. Nao visualiza a landing page.
3. E direcionado diretamente para login ou dashboard.
4. Apos autenticacao, permanece no app correto.

## Arquitetura recomendada para producao

A recomendacao oficial para producao e separar institucional e sistemas em projetos independentes na Vercel:

- **Projeto 1** -> landing page + portal principal da **SMG**
  - `soumanager.com`
  - `www.soumanager.com`

- **Projeto 2** -> **SMG Barber** (ÚNICO SISTEMA ATIVO)
  - `barber.soumanager.com`

> **Nota:** Projetos para futuros sistemas serão criados quando houver decisão oficial do Product Owner.

## Justificativa tecnica

Essa arquitetura e a mais adequada porque:

- separa marketing de operacao;
- reduz risco de deploy cruzado entre sistemas;
- simplifica variaveis de ambiente por aplicacao;
- melhora a organizacao da infraestrutura;
- facilita manutencao e evolucao futura;
- permite escalar novos sistemas sem retrabalho estrutural.

Ela tambem prepara a plataforma para futuros dominios como:

- `financeiro.soumanager.com`
- `admin.soumanager.com`
- `portal.soumanager.com`

## Diretriz de plataforma

A **SMG - Sou.Manager** deve ser tratada como uma **plataforma multiapp**, com entrada centralizada e aplicacoes operacionais desacopladas.

O dominio principal representa:

- a marca **SMG**;
- o posicionamento institucional;
- o portal principal de acesso.

Os subdominios representam:

- produtos operacionais independentes;
- experiencia propria por contexto;
- deploy isolado;
- configuracao especifica por negocio.

## Diretriz de marca

### Estrutura oficial da marca

`SMG - Sou.Manager`

### Padrao de uso recomendado

- `SMG` para comunicacao principal
- `Sou.Manager` como assinatura institucional
- `SMG - Sou.Manager` como forma oficial completa

### Aplicacao nos produtos

- `SMG Barber` (ÚNICO PRODUTO ATIVO)

> **Nota:** Novos produtos serão adicionados quando houver decisão oficial do Product Owner.

## Configuracao recomendada na Vercel

### Projeto institucional

- anexar `soumanager.com`
- anexar `www.soumanager.com`
- configurar redirect `301` de `www.soumanager.com` para `soumanager.com`
- manter apenas envs do portal central e da camada institucional

### Projeto Barber

- anexar `barber.soumanager.com`
- remover esse subdominio do projeto institucional
- manter envs proprias do **SMG Barber**

> **Nota:** Projetos para futuros sistemas serão criados quando houver decisão oficial do Product Owner.

## Variaveis de ambiente recomendadas

```env
VITE_APP_PUBLIC_HOSTNAME_MAP={"barber":"barber.soumanager.com"}
VITE_APP_HOSTNAME_MAP={"barber.soumanager.com":"barber"}
```

## Proximo passo recomendado

O proximo passo ideal e realizar o **cutover definitivo na Vercel**, removendo os subdominios de app do projeto institucional e vinculando cada subdominio ao seu respectivo projeto.

Isso consolida a separacao entre:

- portal principal;
- autenticacao central;
- sistemas operacionais.

Com isso, a base atual passa a refletir uma arquitetura pronta para producao, governanca tecnica e crescimento escalavel da **SMG - Sou.Manager**.
