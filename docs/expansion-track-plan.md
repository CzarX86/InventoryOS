# Expansion Track Plan

Plano detalhado para evolucao do `InventoryOS` com CRM, WhatsApp, automacao operacional e IA como principal operadora, preservando o sistema atual de inventario em producao.

Data de referencia: `2026-03-23`

## 1. Objetivo

O objetivo deste plano e permitir a evolucao do sistema atual para uma plataforma operacional habilitada por IA sem reescrever a base estrutural no futuro. O backend, os contratos de dados e a infraestrutura do novo modulo devem nascer com shape suficientemente final desde o inicio, enquanto a exposicao ao usuario acontece de forma faseada.

O sistema atual ja esta em producao para cadastro de itens e inventario. Essa parte continua relevante e nao pode sofrer regressao funcional. A evolucao deve conviver com o produto atual durante o desenvolvimento, testes e rollout.

Este documento foi escrito para ser um handoff para outros agentes de IA e engenheiros. A expectativa e que qualquer implementador consiga continuar o trabalho sem redefinir arquitetura, politica de rollout ou estrutura de dados principal.

## 2. Principios obrigatorios

### 2.1 TDD

Todo o desenvolvimento do expansion track deve seguir `Test Driven Development`.

Fluxo obrigatorio por feature:

1. Definir comportamento esperado, contratos e criterio de aceite.
2. Criar ou atualizar testes.
3. Implementar o minimo necessario para os testes passarem.
4. Refatorar sem alterar comportamento.
5. Validar em staging.
6. Abrir PR.

Nao implementar comportamento novo sem testes correspondentes, exceto scaffolding tecnico minimo sem efeito funcional direto.

### 2.2 Rollout progressivo com backend final

O backend novo nao deve crescer de forma oportunista ou improvisada. Mesmo que a exposicao ao usuario seja faseada, a base de dados, os pontos de extensao e as interfaces principais precisam nascer desde o inicio com o shape certo.

Isso significa:

- nao adiar modelagem essencial para "fase futura" se isso causar refactor estrutural depois
- construir a infraestrutura de dominio e integracao cedo
- usar `feature flags` para liberar comportamento
- separar "backend pronto" de "experiencia liberada ao usuario"

### 2.3 Governanca de IA

A IA e a principal operadora do sistema, mas o rollout inicial deve ser `approval-first`.

Regras:

- toda tarefa relevante deve poder ser planejada antes de ser executada
- tarefas caras devem mostrar estimativa de tokens e custo em USD antes da execucao
- tarefas baratas e reversiveis podem futuramente ser automaticas, mas isso nao e o default inicial
- todo resultado da IA precisa de rastreabilidade, custo e lineage

### 2.4 Coexistencia com producao

O sistema atual continua em producao. O novo modulo nao pode quebrar:

- login
- inventario
- auditoria existente
- deploy pipeline atual
- regras de acesso do produto atual

### 2.5 UI padrao do expansion track

A partir do inicio do expansion track, `shadcn/ui` e a biblioteca padrao para toda nova interface do modulo em evolucao.

Regras:

- todo componente novo do expansion track usa `shadcn/ui`
- componentes legados fora do escopo imediato podem permanecer
- componentes antigos tocados pelo expansion track devem ser migrados gradualmente quando houver valor claro
- nao travar entrega por migracao ampla de UI sem necessidade

## 3. Branching e fluxo de desenvolvimento

### 3.1 Branch principal do trilho

Nome oficial do trilho paralelo: `Expansion Track`

Branch longa recomendada:

- `codex/expansion-foundation`

Essa branch concentra toda a fundacao da nova plataforma e recebe PRs das features da evolucao.

### 3.2 Relacao com a main

A `main` continua recebendo manutencao e melhorias do sistema atual.

Regras:

- nao misturar manutencao corrente da `main` com implementacao estrutural do expansion track no mesmo PR
- atualizar o expansion track regularmente com mudancas da `main` para evitar divergencia alta
- o expansion track nao deve ser usado como branch de manutencao geral do sistema atual
- branches filhas do expansion track tambem devem seguir o prefixo `codex/`

Exemplos:

- `codex/expansion-foundation`
- `codex/contact-review-queue`
- `codex/ai-cost-governance`
- `codex/whatsapp-webhook-store`

### 3.3 PR strategy

Tipos de PR aceitos no expansion track:

- fundacao de dominio
- integracao WhatsApp/webhooks
- camada de IA e auditoria
- snapshots/context builders
- telas novas do modulo
- migracao pontual para `shadcn/ui`

Cada PR deve:

- manter o sistema atual operacional
- trazer testes
- ser passivel de deploy em staging
- preferencialmente ser protegivel por flag quando houver superficie funcional

## 4. Ambientes

### 4.1 Staging

O ambiente `staging` Firebase continua sendo o ambiente unico de testes para:

- melhorias da `main`
- evolucao do expansion track

Consequencia pratica:

- tudo que for do expansion track deve nascer com `feature flags`
- os dados do modulo novo devem ter isolamento logico
- a ativacao do modulo novo em staging deve ser controlada

### 4.2 Production

`production` continua sendo ambiente produtivo de verdade.

Regras:

- nao usar production para testes exploratorios do expansion track
- nao liberar modulos do expansion track sem criterio de aceite claro
- liberar por ondas pequenas e observaveis

### 4.3 Backup e risco

Ja existem mecanismos de backup e isso reduz o risco operacional, mas nao substitui:

- TDD
- staging validation
- feature flags
- logs e auditoria
- rollout gradual

## 5. Infraestrutura alvo

### 5.1 Estrategia geral

Adotar estrategia `hibrida`:

- `Firebase/GCP` para app, auth, Firestore, Storage, regras, deploy e boa parte da logica de dominio
- `VPS` para integracao WhatsApp/Evolution e servicos auxiliares de ingestao

### 5.2 VPS existente

A mesma VPS atual pode ser reutilizada, desde que haja isolamento forte. Nao destruir nem afetar o projeto atual que ja roda nela.

Regras obrigatorias de isolamento:

- containers separados para este projeto
- rede Docker separada
- variaveis de ambiente separadas
- volumes separados
- logs separados
- nomes de servico separados
- subdominio ou reverse proxy separado
- health checks separados
- politicas de backup claras

Nao compartilhar infraestrutura sem namespacing explicito.

### 5.3 O que roda na VPS

Recomendado:

- instancia dedicada do Evolution API para este app
- endpoint de webhook da integracao
- fila/cache/locks leves se necessario
- servico de integracao WhatsApp -> Firestore

Redis pode ser reutilizado apenas se houver:

- db/logical separation clara
- chaveamento por prefixo
- protecao contra colisao

Postgres so deve ser reutilizado se realmente trouxer vantagem clara para a camada de integracao. Caso contrario, evitar duplicacao desnecessaria no inicio.

### 5.4 O que fica no Firebase/GCP

- Auth
- Firestore operacional
- Storage para anexos e TXT exportado do WhatsApp
- Cloud Functions ou jobs de dominio
- Hosting do app
- regras de seguranca
- auditoria
- flags e configuracoes do sistema

### 5.5 Analytics

Preparar o modelo para analytics macro e Big Data, mas sem bloquear a primeira fase.

Diretriz:

- modelagem ja pronta para export ou agregacao futura em `BigQuery`
- adotar ids e entidades consistentes desde o inicio
- preservar fatos de negocio e lineage

## 6. Arquitetura funcional alvo

O sistema novo deve ser desenhado como um conjunto de modulos coesos.

### 6.1 Modulos de dominio

- `accounts`
  - empresa ou organizacao
- `contacts`
  - pessoa vinculada a uma conta
- `contact_channels`
  - canal como WhatsApp, email etc.
- `conversations`
  - agrupamento logico por canal/contato
- `messages`
  - mensagem individual com origem, timestamp e metadados
- `opportunities`
  - oportunidades de negocio
- `contracts`
  - vinculo contratual ou relacionamento comercial recorrente
- `crm_events`
  - fatos relevantes extraidos do relacionamento
- `tasks`
  - proximas acoes
- `interests`
  - vinculos entre cliente/oportunidade e hardware

### 6.2 Modulos de estoque e hardware

- `catalog_items`
  - item canonico de catalogo
- `inventory_items`
  - item fisicamente em estoque
- `installed_base`
  - base instalada confirmada ou inferida do cliente
- `maintenance_rules`
  - politicas de manutencao e periodicidade
- `item_relationships`
  - relacoes comerciais entre itens, sempre filtradas pelo contexto do negocio

### 6.3 Modulos de fornecedores e procurement

- `supplier_accounts`
- `supplier_contacts`
- `quote_requests`
- `quote_responses`
- `supplier_performance_profiles`
- `procurement_opportunities`

### 6.4 Modulos de IA e auditoria

- `ai_runs`
  - execucoes de IA
- `ai_cost_policies`
  - orcamentos e thresholds
- `prompt_templates`
  - templates versionados
- `style_profiles`
  - estilo do vendedor e do contato
- `relationship_digests`
  - resumo consolidado do relacionamento
- `account_snapshots`
- `contact_snapshots`
- `segment_snapshots`
- `message_lineage`
  - vinculo entre mensagem e tudo que foi derivado dela

### 6.5 Modulos de controle

- `contact_monitoring_policies`
  - `pending_review`
  - `candidate_professional`
  - `professional_monitored`
  - `personal_ignored`
  - `blocked_by_user`
- `history_backfill_jobs`
- `txt_import_jobs`
- `message_dispatch_jobs`
- `supplier_rfq_jobs`
- `feature_flags`

## 7. Modelo operacional da IA

### 7.1 Papel da IA

A IA e a principal operadora do sistema. Isso significa que o banco precisa ser legivel e acionavel por ela, mas sempre via interfaces controladas.

A IA nao deve:

- consultar o banco livremente sem controle
- escrever diretamente em colecoes de dominio sem validacao
- inferir entidades sem schema

### 7.2 Interface de orquestracao

Criar uma camada interna de orquestracao com estes contratos logicos:

- `planAiTask(taskType, targetId, options)`
  - define contexto, modelo, custo estimado e plano de execucao
- `executeAiTask(planId, approvedBy)`
  - executa a tarefa com registro de custo e writeback
- `queryAiContext(toolName, params)`
  - tools internas controladas para leitura de contexto
- `writeAiResult(taskId, result)`
  - grava resultados validados e rastreaveis

### 7.3 Tooling interno para IA

Ferramentas previstas:

- `getAccountSnapshot(accountId)`
- `getContactSnapshot(contactId)`
- `getConversationWindow(conversationId, from, to)`
- `getRelationshipDigest(accountId)`
- `getPurchaseHistory(accountId)`
- `getInstalledBase(accountId)`
- `getOpenTasks(accountId)`
- `getCatalogRelationships(itemId)`
- `getSegmentBenchmarks(segmentId)`
- `searchRelevantMessages(accountId, topic)`

### 7.4 Politica de modelos

Politica inicial:

- `DeepSeek` como modelo default
- `Gemini` como escalation path para:
  - ambiguidades
  - historico longo
  - consolidacoes complexas
  - tarefas multimodais ou com maior exigencia

Nao adotar LangChain ou Agno no primeiro ciclo. Criar orquestrador proprio simples, previsivel e testavel.

### 7.5 Governanca de custo

Toda tarefa precisa poder registrar:

- tokens estimados de entrada
- tokens estimados de saida
- custo estimado em USD
- modelo previsto
- tokens reais
- custo real
- duracao
- versao do prompt
- pipeline version

Politica inicial:

- pedir aprovacao para quase tudo que seja relevante
- executar automaticamente apenas tarefas muito baratas, reversiveis e com risco baixo

## 8. Linha de dados e LGPD

### 8.1 Lineage obrigatoria

Toda entidade inferida precisa guardar:

- `source_message_ids`
- confianca
- trecho de evidencia ou referencia
- pipeline version
- modelo utilizado

Exemplos de derivados:

- evento CRM
- tarefa
- oportunidade
- inferencia de base instalada
- interesse em hardware
- mensagem sugerida

### 8.2 Exclusao e reversibilidade

O usuario deve poder:

- apagar uma mensagem
- apagar uma mensagem e manter derivados
- apagar uma mensagem e apagar tambem o lastro que ela deixou no sistema
- marcar contato como pessoal a qualquer momento
- interromper monitoramento

Se um contato for marcado como `personal_ignored`, o sistema nunca mais deve monitorar semanticamente esse contato ate nova acao explicita do usuario.

### 8.3 Relevancia por mensagem

Mesmo em contatos profissionais, nem toda mensagem gera valor.

A digestao deve separar:

- pessoal
- irrelevante
- operacional
- comercial

Somente mensagens `operacionais` e `comerciais` devem gerar entidades, eventos e sugestoes.

## 9. WhatsApp e processamento de historico

### 9.1 Unidade de backfill

O processamento retroativo nao e por "mensagens de um dia". A unidade correta e:

- `fila por data`
- dentro de cada data, `contatos que interagiram naquela data`
- para cada contato, digerir o `relacionamento completo disponivel` do primeiro contato ate aquela data

Exemplo:

- fila "ontem": todos os contatos que tiveram interacao ontem
- para cada contato dessa fila, processar todo o historico conhecido ate ontem
- depois repetir para anteontem, e assim por diante

### 9.2 Comportamento do backfill

Regras:

- nao ser agressivo
- respeitar limites operacionais do WhatsApp
- ser agendado
- ter estado e checkpoint por job
- poder ser interrompido
- nao reprocessar desnecessariamente relacionamentos ja consolidados

### 9.3 Review queue

Primeira superficie de alto valor:

- lista de numeros/contatos sugeridos
- status visual:
  - habilitado
  - desabilitado
  - pendente
- score de confianca
- nome do perfil quando disponivel
- numero
- preview das ultimas mensagens
- acao manual:
  - monitorar
  - ignorar
  - revisar depois

## 10. CRM, hardware e oportunidades

### 10.1 Eventos de CRM

Eventos a extrair:

- primeiro contato comercial
- pedido de preco
- pedido de orcamento
- envio de proposta
- objecao
- negociacao
- promessa de retorno
- follow-up pendente
- sumico
- reativacao
- fechamento ganho
- fechamento perdido
- recompra
- indicacao
- reclamacao
- manutencao

Cada evento deve ser estruturado e nao apenas texto solto.

### 10.2 Hardware intelligence

O sistema deve extrair:

- hardware citado
- modelo
- linha
- especificacao
- marca
- contexto de interesse

Se um item for relevante comercialmente e ainda nao existir no catalogo, o sistema deve poder sugerir sua criacao como `catalog_item` com estoque zero, sujeito a regra do processo adotado.

### 10.3 Restricao ao nicho

O grafo de relacao entre itens nao pode refletir o "mundo real inteiro". Ele deve refletir o contexto do negocio.

So podem ser usados para sugestao:

- itens vendidos
- itens suportados
- servicos realmente prestados
- manutencoes executadas pela operacao

Itens tecnicamente relacionados mas fora do escopo comercial nao devem ser sugeridos.

### 10.4 Action Inbox

Criar uma tela de oportunidades/acoes que mostre:

- quem contatar
- por que contatar
- historico resumido
- itens relacionados
- risco/oportunidade
- mensagem sugerida
- confianca
- impacto esperado

Tipos de acao:

- reativacao
- cross-sell
- upsell
- manutencao preventiva
- follow-up
- retomada de negociacao

## 11. Playbooks e estilo de comunicacao

Criar playbooks base:

- reativacao
- pos-venda
- manutencao preventiva
- cross-sell
- upsell
- pedido de cotacao a fornecedor

Esses playbooks devem ser adaptados pelo estilo observado nas conversas do vendedor.

Modelos de perfil:

- `SellerCommunicationProfile`
- `ContactCommunicationProfile`

Sinais:

- formalidade
- objetividade
- nivel tecnico
- estrutura de abertura
- estrutura de fechamento
- tom geral

No inicio, usar:

- prompt templates
- few-shot examples
- perfis estruturados

Nao fazer fine-tuning de modelo no primeiro ciclo.

## 12. Fornecedores e automacao de cotacao

Esse modulo e um dos maiores motores de adocao.

Fluxo desejado:

1. surge demanda por uma peca
2. sistema identifica a peca
3. consulta fornecedores elegiveis
4. dispara mensagens de cotacao
5. le respostas
6. extrai preco, prazo e condicao
7. compara fornecedores
8. estima margem
9. sugere decisao

Primeiro ciclo:

- assistido
- com aprovacao
- sem negociacao totalmente autonoma

## 13. Fases de implementacao

### 13.1 Fase 0 - Fundacao invisivel

Entregas:

- modelo de dados principal
- orchestrator de IA
- ledger de custo estimado/real
- event store de webhooks
- jobs de backfill
- snapshots consolidados
- feature flags
- reforco de auditoria e seguranca
- admin basico de custos e jobs

Nao expor ainda automacao ampla ao usuario final.

### 13.2 Fase 1 - Review Queue + Insights + Action Inbox

Primeira release visivel.

Entregas:

- ingestao de contatos e mensagens
- classificacao inicial
- fila de revisao
- preview de conversa
- estados visuais
- inbox de oportunidades
- confirmacao com custo para tarefas pesadas

Objetivo:

- gerar valor sem outbound automatico forte
- fazer o usuario desejar usar o sistema porque ele traz organizacao e oportunidade acionavel

### 13.3 Fase 2 - CRM Estruturado + Hardware Intelligence

Entregas:

- CRM estruturado
- hardware extraction
- relacao com catalogo e estoque
- base instalada provavel
- regras de manutencao
- playbooks
- perfis de estilo

### 13.4 Fase 3 - TXT Import + Supplier RFQ

Entregas:

- upload de TXT exportado do WhatsApp
- parser com lineage
- reconstituicao de contexto
- procurement assistido
- cotacao com fornecedores

### 13.5 Fase 4 - Semiautonomia + Analytics Macro

Entregas:

- budgets
- autoexecucao limitada
- analytics macro
- consolidacao de Big Data

## 14. Testes obrigatorios

### 14.1 Unitarios

- classificacao de contatos
- classificacao de mensagem por relevancia
- validacao de JSON schemas
- roteamento DeepSeek/Gemini
- calculo de custo estimado
- calculo de custo real
- lineage
- cascata de delecao
- regras de nicho para item relationships

### 14.2 Integracao

- ingestao de webhook WhatsApp
- criacao de jobs por bucket de data
- digestao de relacionamento completo por contato
- criacao de snapshots
- criacao de eventos CRM
- criacao de tasks
- RFQ com multiplos fornecedores

### 14.3 UI

- fila de revisao
- action inbox
- badges de status
- dialogos de aprovacao de custo
- componentes `shadcn/ui` principais do novo modulo

### 14.4 Smoke tests em staging

- login
- inventario atual
- area admin atual
- flags desligadas
- flags ligadas
- convivencia entre sistema atual e modulo novo

## 15. Sequencia recomendada de implementacao no expansion track

Ordem recomendada para evitar retrabalho estrutural:

1. criar branch longa `codex/expansion-foundation`
2. introduzir feature flags e boundaries de owner/account
3. criar colecoes/entidades novas e contratos internos
4. criar orchestrator de IA e ledger de custo
5. criar event store de webhooks e jobs
6. integrar Evolution na VPS com isolamento forte
7. implementar snapshots/context builders
8. criar review queue e action inbox com `shadcn/ui`
9. implementar CRM structured extraction
10. implementar hardware intelligence
11. implementar TXT import
12. implementar supplier RFQ
13. ampliar analytics e semiautonomia

## 16. Regras de seguranca e operacao

- nenhum contato marcado como pessoal pode continuar sendo monitorado semanticamente
- nenhuma mensagem deve gerar derivado sem possibilidade de rastreio
- nenhuma tarefa cara deve executar sem visibilidade de custo na politica inicial
- nenhum rollout deve depender de refactor estrutural futuro
- nenhum modulo novo deve ser acoplado de forma a quebrar o inventario atual

## 17. Decisoes fechadas

- nome do trilho: `Expansion Track`
- branch longa recomendada: `codex/expansion-foundation`
- estrategia de rollout: backend completo cedo, exposicao gradual
- metodologia de desenvolvimento: `TDD`
- ambiente de teste: `staging`
- ambiente produtivo: `production`
- UI padrao do novo modulo: `shadcn/ui`
- politica inicial de autonomia: `approval-first`
- modelo default: `DeepSeek`
- escalation model: `Gemini`
- tenancy inicial: `single-tenant com isolacao logica`
- infraestrutura: `VPS reutilizada com isolamento forte + Firebase/GCP`

## 18. O que nao fazer

- nao construir o modulo novo como hacks em torno da tela atual de inventario
- nao postergar modelagem essencial do dominio
- nao permitir acesso arbitrario da IA ao banco
- nao liberar automacao ampla sem lineage, custos e flags
- nao usar production como ambiente de descoberta
- nao criar componentes novos fora de `shadcn/ui` dentro do expansion track
- nao misturar manutencao corrente da `main` com fundacao do expansion track no mesmo pacote de entrega

## 19. Resultado esperado

Ao final da implementacao faseada deste plano, o `InventoryOS` deve ter:

- inventario atual preservado
- backend novo pronto para CRM e operacao comercial
- ingestao e digestao de conversas de WhatsApp com governanca
- action inbox que gera valor concreto
- inteligencia vinculada ao catalogo e estoque
- automacao assistida de cotacao com fornecedores
- logs de custo e tokens
- base de dados preparada para analytics micro e macro
- estrutura que permite evoluir sem refatoracoes estruturais futuras
