# Expansion Track Backlog

Backlog tecnico faseado derivado de [expansion-track-plan.md](/Users/juliocezar/Dev/personal/InventoryOS/docs/expansion-track-plan.md).

Objetivo deste documento:

- transformar o plano em ordem concreta de implementacao
- definir pacotes de trabalho pequenos o suficiente para PRs curtos
- preservar a estrategia de `backend final cedo, rollout gradual`
- servir como fila de trabalho para outros agentes de IA

Data de referencia: `2026-03-23`

## Regras globais do backlog

- Toda entrega segue `TDD`.
- Toda entrega do expansion track deve nascer em branch `codex/<descricao>`.
- PRs do expansion track devem apontar primeiro para `codex/expansion-foundation`.
- Toda feature nova com superficie funcional deve estar protegida por flag.
- Todo componente novo do expansion track deve usar `shadcn/ui`.
- Nao misturar manutencao rotineira da `main` com este backlog.
- O sistema atual de inventario nao pode sofrer regressao.

## Legenda de prioridade

- `P0`: bloqueador estrutural
- `P1`: essencial para a primeira release visivel
- `P2`: importante para valor comercial e consolidacao
- `P3`: evolucao posterior

## Fase 0: Fundacao invisivel

Meta da fase:

- preparar a base de dominio, integracao e governanca
- manter o sistema atual intacto
- deixar o backend pronto para liberar features por flag sem refactor estrutural

## Epic 0.1: Branching, flags e guardrails

### Story 0.1.1 - Criar o trilho oficial da expansao

- Prioridade: `P0`
- Branch sugerida: `codex/expansion-foundation`

Escopo:

- estabelecer a branch longa do expansion track
- documentar no repositório que PRs da expansao partem dela
- definir convencao de nomes para branches filhas

Criterios de aceite:

- existe branch longa dedicada
- o documento de plano referencia o fluxo corretamente
- outros agentes conseguem identificar o branch target sem ambiguidade

### Story 0.1.2 - Introduzir feature flags do expansion track

- Prioridade: `P0`
- Branch sugerida: `codex/expansion-feature-flags`

Escopo:

- criar mecanismo simples de flags para modulos novos
- prever flags para:
  - `contact_review_queue`
  - `whatsapp_ingestion`
  - `action_inbox`
  - `hardware_intelligence`
  - `txt_import`
  - `supplier_rfq`
  - `semi_autonomous_ai`

Criterios de aceite:

- flags podem ser lidas no app e no backend
- flags desligadas nao impactam a UX atual
- testes cobrem comportamento habilitado/desabilitado

### Story 0.1.3 - Definir boundaries de owner/account

- Prioridade: `P0`
- Branch sugerida: `codex/owner-account-boundaries`

Escopo:

- introduzir identificadores consistentes de ownership nas colecoes novas
- manter tenancy inicial `single-tenant com isolacao logica`
- garantir que o modelo futuro nao exija refactor para multi-tenant

Criterios de aceite:

- novas entidades possuem `ownerId` ou equivalente consistente
- regras e consultas conseguem isolar dados por ownership
- testes cobrem autorizacao basica

## Epic 0.2: Dominio novo e persistencia

### Story 0.2.1 - Criar modelos base de CRM

- Prioridade: `P0`
- Branch sugerida: `codex/crm-domain-foundation`

Escopo:

- criar shape inicial para:
  - `accounts`
  - `contacts`
  - `contact_channels`
  - `conversations`
  - `messages`
  - `opportunities`
  - `contracts`
  - `crm_events`
  - `tasks`
  - `interests`

Criterios de aceite:

- modelos e factories estao definidos
- ids e relacionamentos principais estao claros
- testes validam criacao, leitura e coerencia estrutural

### Story 0.2.2 - Criar modelos base de hardware e estoque expandido

- Prioridade: `P0`
- Branch sugerida: `codex/hardware-domain-foundation`

Escopo:

- criar shape inicial para:
  - `catalog_items`
  - `inventory_items`
  - `installed_base`
  - `maintenance_rules`
  - `item_relationships`

Criterios de aceite:

- separacao entre catalogo e estoque esta clara
- ha suporte a itens com quantidade zero
- relacoes entre itens suportam filtro por contexto comercial

### Story 0.2.3 - Criar modelos base de fornecedores

- Prioridade: `P1`
- Branch sugerida: `codex/supplier-domain-foundation`

Escopo:

- criar shape inicial para:
  - `supplier_accounts`
  - `supplier_contacts`
  - `quote_requests`
  - `quote_responses`
  - `supplier_performance_profiles`
  - `procurement_opportunities`

Criterios de aceite:

- dominio de fornecedor e separado do CRM de cliente
- quote request e quote response possuem ids e referencias coerentes
- testes cobrem vinculacao com catalogo

## Epic 0.3: IA operadora e custo

### Story 0.3.1 - Criar ledger unificado de execucao de IA

- Prioridade: `P0`
- Branch sugerida: `codex/ai-runs-ledger`

Escopo:

- introduzir `ai_runs` como sucessor natural de `task_ai_usage`
- suportar:
  - custo estimado
  - custo real
  - tokens estimados
  - tokens reais
  - modelo
  - task type
  - actor
  - status
  - pipeline version
  - prompt version

Criterios de aceite:

- nova estrutura existe sem quebrar a dashboard atual
- ha compatibilidade ou ponte com a auditoria atual
- testes validam acumulacao correta de custo e tokens

### Story 0.3.2 - Criar planner de tarefas de IA

- Prioridade: `P0`
- Branch sugerida: `codex/ai-task-planner`

Escopo:

- implementar interface logica para:
  - `planAiTask`
  - `executeAiTask`
  - `writeAiResult`
- separar fase de planejamento da execucao
- gerar pre-visualizacao de custo para tarefas pesadas

Criterios de aceite:

- uma task pode ser planejada sem executar
- a execucao usa o plano criado
- o custo planejado e persistido antes da execucao

### Story 0.3.3 - Implementar model router

- Prioridade: `P0`
- Branch sugerida: `codex/model-router`

Escopo:

- criar roteamento interno entre `DeepSeek` e `Gemini`
- definir regras iniciais de escalonamento
- manter interface unica para o dominio

Criterios de aceite:

- task simples usa modelo default
- task marcada como complexa pode escalar
- testes validam roteamento sem depender de provider real

## Epic 0.4: Seguranca, regras e lineage

### Story 0.4.1 - Expandir regras do Firestore para o novo dominio

- Prioridade: `P0`
- Branch sugerida: `codex/firestore-rules-expansion`

Escopo:

- adicionar regras para colecoes novas
- preservar seguranca atual
- refletir `owner/account boundaries`

Criterios de aceite:

- regras cobrem leitura e escrita das entidades novas
- regras antigas continuam validas
- testes de regras cobrem acessos permitidos e negados

### Story 0.4.2 - Criar camada de lineage

- Prioridade: `P0`
- Branch sugerida: `codex/message-lineage`

Escopo:

- introduzir estrutura que ligue:
  - mensagem
  - extrações
  - eventos
  - oportunidades
  - tarefas
  - sugestoes

Criterios de aceite:

- todo derivado pode apontar para mensagens de origem
- exclusao futura consegue localizar dependencias
- testes cobrem resolucao de lineage

### Story 0.4.3 - Implementar politica de delecao e cascata

- Prioridade: `P1`
- Branch sugerida: `codex/deletion-cascade`

Escopo:

- permitir apagar:
  - so a mensagem
  - a mensagem e os derivados
- criar mecanismo de resolucao de impacto por lineage

Criterios de aceite:

- ha forma de localizar derivados afetados
- cascata remove apenas o que depende da mensagem
- testes cobrem multiplos tipos de derivado

## Epic 0.5: Integracao WhatsApp e ingestao

### Story 0.5.1 - Criar store de eventos de webhook

- Prioridade: `P0`
- Branch sugerida: `codex/whatsapp-webhook-store`

Escopo:

- receber e persistir eventos do Evolution/WhatsApp
- armazenar payload bruto e metadados relevantes
- garantir idempotencia basica

Criterios de aceite:

- eventos podem ser reprocessados sem duplicar efeitos
- payload bruto fica auditavel
- falhas nao derrubam o app principal

### Story 0.5.2 - Criar jobs de backfill por bucket de data

- Prioridade: `P0`
- Branch sugerida: `codex/history-backfill-jobs`

Escopo:

- modelar jobs com:
  - data alvo
  - fila de contatos
  - checkpoint
  - estado
- respeitar a regra:
  - selecionar contatos que interagiram numa data
  - processar relacionamento completo de cada contato ate aquela data

Criterios de aceite:

- job nao processa so mensagens do dia
- job processa relacionamento completo por contato
- testes cobrem checkpoint e retomada

### Story 0.5.3 - Criar snapshots consolidados para IA

- Prioridade: `P1`
- Branch sugerida: `codex/relationship-snapshots`

Escopo:

- introduzir:
  - `relationship_digests`
  - `account_snapshots`
  - `contact_snapshots`
  - `segment_snapshots`

Criterios de aceite:

- uma task de IA nao precisa ler o banco cru inteiro
- snapshots podem ser atualizados incrementalmente
- testes validam montagem de contexto minimo

## Fase 1: Review Queue + Insights + Action Inbox

Meta da fase:

- primeira entrega visivel ao usuario
- criar desejo de uso sem outbound automatico forte
- dar visibilidade comercial e organizacao

## Epic 1.1: Contact review queue

### Story 1.1.1 - Criar UI da fila de revisao com `shadcn/ui`

- Prioridade: `P1`
- Branch sugerida: `codex/contact-review-queue-ui`

Escopo:

- criar tela/lista com:
  - nome do contato quando disponivel
  - numero
  - score de confianca
  - status visual `habilitado/desabilitado/pendente`
  - acao de monitorar/ignorar/revisar depois

Criterios de aceite:

- UI nova usa `shadcn/ui`
- estados visuais estao claros
- testes de UI cobrem renderizacao e acoes principais

### Story 1.1.2 - Adicionar preview expandivel de mensagens

- Prioridade: `P1`
- Branch sugerida: `codex/contact-preview`

Escopo:

- exibir ultimas 5 a 10 mensagens
- permitir expandir sem entrar numa conversa completa
- ajudar o usuario a identificar numeros desconhecidos

Criterios de aceite:

- preview usa dados reais ou mocks de integracao
- preview nao quebra performance da lista
- testes cobrem expandir e recolher

### Story 1.1.3 - Implementar politicas de monitoramento

- Prioridade: `P1`
- Branch sugerida: `codex/contact-monitoring-policies`

Escopo:

- persistir decisoes do usuario:
  - monitorar
  - ignorar
  - pendente
- garantir que `personal_ignored` interrompe monitoramento sem ambiguidade

Criterios de aceite:

- contato ignorado nao entra no fluxo semantico
- contato monitorado pode gerar tarefas futuras
- testes cobrem transicoes de estado

## Epic 1.2: Classificacao inicial e relevancia

### Story 1.2.1 - Classificar contato como pessoal/profissional/indefinido

- Prioridade: `P1`
- Branch sugerida: `codex/contact-classification`

Escopo:

- classificar contato inicialmente
- respeitar thresholds de confianca
- nao executar processamento agressivo de conversas pessoais

Criterios de aceite:

- ha score de confianca
- classificacao alimenta a review queue
- testes cobrem falsos positivos obvios

### Story 1.2.2 - Classificar mensagem por relevancia

- Prioridade: `P1`
- Branch sugerida: `codex/message-relevance`

Escopo:

- separar mensagens em:
  - pessoal
  - irrelevante
  - operacional
  - comercial

Criterios de aceite:

- somente mensagens relevantes seguem para extracao
- conversas casuais em contato profissional nao viram entidade
- testes cobrem exemplos positivos e negativos

## Epic 1.3: Action Inbox

### Story 1.3.1 - Criar tela de oportunidades e proximas acoes

- Prioridade: `P1`
- Branch sugerida: `codex/action-inbox-ui`

Escopo:

- criar inbox com cards de:
  - follow-up
  - reativacao
  - retomada
  - oportunidade de manutencao

Criterios de aceite:

- cards mostram motivo, contexto, confianca e acao sugerida
- UI usa `shadcn/ui`
- testes cobrem renderizacao dos tipos principais

### Story 1.3.2 - Implementar motor inicial de sugestoes

- Prioridade: `P1`
- Branch sugerida: `codex/action-suggestion-engine`

Escopo:

- gerar sugestoes iniciais baseadas em:
  - ultima interacao
  - historico consolidado
  - inatividade
  - compras passadas

Criterios de aceite:

- existe ao menos uma heuristica funcional por tipo de card
- sugestoes apontam para evidencias
- testes cobrem geracao deterministica minima

## Epic 1.4: Custo e aprovacao visiveis

### Story 1.4.1 - Exibir previa de custo de tarefas pesadas

- Prioridade: `P1`
- Branch sugerida: `codex/ai-cost-preview-ui`

Escopo:

- antes de tarefas pesadas, mostrar:
  - objetivo
  - tokens estimados
  - custo estimado
  - modelo

Criterios de aceite:

- usuario consegue aprovar ou cancelar
- custo aparece de forma clara
- testes cobrem renderizacao e fluxo de aprovacao

### Story 1.4.2 - Expandir dashboard admin com custos novos

- Prioridade: `P1`
- Branch sugerida: `codex/admin-ai-costs`

Escopo:

- mostrar custo estimado e real
- mostrar modelo e task type
- manter dashboard atual funcional

Criterios de aceite:

- admin ve execucoes recentes
- custo monetario aparece junto dos tokens
- testes cobrem leitura da colecao nova

## Fase 2: CRM Estruturado + Hardware Intelligence

Meta da fase:

- transformar conversas em CRM utilizavel
- conectar CRM ao catalogo e ao estoque
- gerar oportunidades com contexto do nicho

## Epic 2.1: Extracao estruturada de CRM

### Story 2.1.1 - Criar schemas de extracao de CRM

- Prioridade: `P1`
- Branch sugerida: `codex/crm-extraction-schemas`

Escopo:

- definir schemas para:
  - contato
  - conta
  - evento CRM
  - oportunidade
  - task

Criterios de aceite:

- schemas sao fechados e validaveis
- IA nao grava sem passar pelo schema
- testes cobrem validacao e rejeicao de payload invalido

### Story 2.1.2 - Persistir eventos e tarefas derivados

- Prioridade: `P1`
- Branch sugerida: `codex/crm-event-writeback`

Escopo:

- transformar extrações validadas em:
  - `crm_events`
  - `tasks`
  - `opportunities`

Criterios de aceite:

- writeback e idempotente
- lineage e preservado
- testes cobrem duplicidade e reconciliação

## Epic 2.2: Hardware intelligence

### Story 2.2.1 - Criar schemas de hardware mention

- Prioridade: `P1`
- Branch sugerida: `codex/hardware-mention-schemas`

Escopo:

- extrair:
  - marca
  - linha
  - modelo
  - especificacao
  - contexto de interesse

Criterios de aceite:

- schema e estrito
- testes cobrem mencoes completas e parciais

### Story 2.2.2 - Resolver mencoes contra o catalogo

- Prioridade: `P1`
- Branch sugerida: `codex/hardware-resolution`

Escopo:

- vincular hardware citado ao catalogo existente
- criar sugestao de item novo quando fizer sentido
- permitir item com estoque zero

Criterios de aceite:

- mencao conhecida resolve para item existente
- mencao desconhecida pode virar sugestao
- testes cobrem match, no-match e ambiguidade

### Story 2.2.3 - Implementar filtro de nicho em relacoes de itens

- Prioridade: `P1`
- Branch sugerida: `codex/item-relationship-guardrails`

Escopo:

- impedir sugestoes fora do escopo comercial
- usar apenas itens/servicos suportados pelo negocio

Criterios de aceite:

- item tecnicamente relacionado mas nao comercializavel nao e sugerido
- testes cobrem bloqueio por contexto

## Epic 2.3: Base instalada e manutencao

### Story 2.3.1 - Inferir base instalada do cliente

- Prioridade: `P2`
- Branch sugerida: `codex/installed-base-inference`

Escopo:

- consolidar o que foi comprado ou inferido
- diferenciar confirmado de inferido

Criterios de aceite:

- base instalada indica nivel de confianca
- testes cobrem inferencia a partir de compras e conversas

### Story 2.3.2 - Modelar regras de manutencao

- Prioridade: `P2`
- Branch sugerida: `codex/maintenance-rules`

Escopo:

- associar periodicidade e servicos a itens suportados

Criterios de aceite:

- regras podem ser consultadas pelo motor de oportunidades
- testes cobrem janelas de manutencao

## Epic 2.4: Playbooks e estilo

### Story 2.4.1 - Criar playbooks base

- Prioridade: `P2`
- Branch sugerida: `codex/base-playbooks`

Escopo:

- criar templates para:
  - reativacao
  - manutencao preventiva
  - cross-sell
  - upsell
  - pos-venda

Criterios de aceite:

- playbooks possuem versao
- testes cobrem selecao do playbook correto

### Story 2.4.2 - Persistir perfil de estilo do vendedor

- Prioridade: `P2`
- Branch sugerida: `codex/seller-style-profile`

Escopo:

- criar `SellerCommunicationProfile`
- extrair sinais de estilo do historico

Criterios de aceite:

- perfil pode ser consultado pelo gerador de mensagem
- testes cobrem consolidacao de sinais

## Fase 3: TXT Import + Supplier RFQ

Meta da fase:

- recuperar contexto historico quando o sync nao bastar
- automatizar operacao relevante com fornecedores

## Epic 3.1: TXT Import

### Story 3.1.1 - Criar upload e armazenamento de TXT

- Prioridade: `P2`
- Branch sugerida: `codex/txt-import-upload`

Escopo:

- aceitar upload de export TXT do WhatsApp
- armazenar no Storage com metadados

Criterios de aceite:

- arquivo pode ser anexado a conta/contato
- testes cobrem upload e metadados

### Story 3.1.2 - Criar parser estruturado de TXT

- Prioridade: `P2`
- Branch sugerida: `codex/txt-parser`

Escopo:

- transformar TXT em mensagens estruturadas
- preservar origem para lineage

Criterios de aceite:

- parser reconhece autor, timestamp e texto
- mensagens parsed podem ser digeridas pelo mesmo pipeline
- testes cobrem formatos comuns de export

### Story 3.1.3 - Detectar lacuna de historico e sugerir upload

- Prioridade: `P2`
- Branch sugerida: `codex/history-gap-detection`

Escopo:

- detectar quando o historico sincronizado e insuficiente
- sugerir upload de TXT de forma contextual

Criterios de aceite:

- sistema nao pede TXT sem motivo
- sugestao aparece quando ha evidencias de lacuna
- testes cobrem deteccao minima

## Epic 3.2: Supplier RFQ

### Story 3.2.1 - Modelar demanda e elegibilidade de fornecedor

- Prioridade: `P2`
- Branch sugerida: `codex/rfq-demand-model`

Escopo:

- representar demanda por peca
- selecionar fornecedores elegiveis por item

Criterios de aceite:

- demanda referencia item corretamente
- fornecedores elegiveis podem ser listados
- testes cobrem selecao basica

### Story 3.2.2 - Gerar e disparar pedidos de cotacao

- Prioridade: `P2`
- Branch sugerida: `codex/rfq-dispatch`

Escopo:

- criar mensagem de cotacao
- disparar para fornecedores selecionados
- registrar lineage e custo

Criterios de aceite:

- disparo e auditavel
- politica de aprovacao e respeitada
- testes cobrem geracao do payload

### Story 3.2.3 - Ler respostas e comparar cotacoes

- Prioridade: `P2`
- Branch sugerida: `codex/rfq-response-processing`

Escopo:

- extrair preco, prazo e condicao
- montar comparativo
- estimar margem

Criterios de aceite:

- respostas viram dados estruturados
- comparativo aponta melhor opcao
- testes cobrem cenarios com 2 ou 3 fornecedores

## Fase 4: Semiautonomia + Analytics Macro

Meta da fase:

- elevar automacao com controle financeiro
- transformar a base em fonte de insight operacional

## Epic 4.1: Semiautonomia

### Story 4.1.1 - Criar budgets e limites por tarefa

- Prioridade: `P3`
- Branch sugerida: `codex/ai-budget-policies`

Escopo:

- definir limites diarios e mensais
- limitar custo por tipo de task

Criterios de aceite:

- planner respeita limites
- tarefas acima do limite nao executam sem aprovacao
- testes cobrem bloqueio

### Story 4.1.2 - Permitir autoexecucao de tarefas seguras

- Prioridade: `P3`
- Branch sugerida: `codex/safe-autoexecution`

Escopo:

- executar automaticamente tarefas baratas e reversiveis

Criterios de aceite:

- tarefas elegiveis sao claramente classificadas
- execucao automatica e auditada
- testes cobrem politica de elegibilidade

## Epic 4.2: Analytics macro

### Story 4.2.1 - Consolidar fatos para analytics

- Prioridade: `P3`
- Branch sugerida: `codex/analytics-facts`

Escopo:

- preparar fatos de:
  - compras
  - reativacoes
  - itens correlatos
  - manutencao
  - margem
  - resposta de fornecedor

Criterios de aceite:

- fatos podem ser agregados sem reprocessar tudo
- testes cobrem coerencia minima

### Story 4.2.2 - Criar consultas de insight macro

- Prioridade: `P3`
- Branch sugerida: `codex/analytics-insights`

Escopo:

- suportar perguntas como:
  - itens de maior retorno
  - segmentos com maior conversao
  - clientes com maior potencial de reativacao
  - playbooks mais eficazes

Criterios de aceite:

- ha pelo menos um caminho de consulta por insight principal
- testes cobrem agregacoes essenciais

## Backlog transversal de UI com shadcn

Esses itens acompanham todas as fases.

### Story T.1 - Inicializar e padronizar uso de `shadcn/ui`

- Prioridade: `P0`
- Branch sugerida: `codex/shadcn-foundation`

Escopo:

- garantir setup consistente da biblioteca
- definir composicao base para:
  - dialog
  - sheet
  - table
  - card
  - badge
  - tabs
  - dropdown
  - form controls

Criterios de aceite:

- setup reutilizavel para as telas novas
- documentacao curta no codigo ou no repo

### Story T.2 - Migrar superfícies tocadas pelo expansion track

- Prioridade: `P1`
- Branch sugerida: `codex/shadcn-surface-migrations`

Escopo:

- migrar gradualmente componentes tocados pelas novas telas
- evitar reescrever areas nao relacionadas

Criterios de aceite:

- telas novas nao dependem de componentes antigos improvisados
- mudancas visuais sao localizadas e testadas

## Ordem sugerida dos primeiros 10 PRs

1. `codex/shadcn-foundation`
2. `codex/expansion-feature-flags`
3. `codex/owner-account-boundaries`
4. `codex/crm-domain-foundation`
5. `codex/ai-runs-ledger`
6. `codex/ai-task-planner`
7. `codex/model-router`
8. `codex/whatsapp-webhook-store`
9. `codex/history-backfill-jobs`
10. `codex/contact-review-queue-ui`

## Definicao de pronto por fase

### Fase 0 pronta quando

- dominio novo existe
- IA tem planner e ledger
- webhooks e jobs existem
- regras novas estao protegidas
- nada visivel ao usuario depende de hack

### Fase 1 pronta quando

- review queue funciona
- action inbox funciona
- custo e aprovacao estao visiveis
- contatos pessoais podem ser bloqueados de forma definitiva

### Fase 2 pronta quando

- CRM estruturado funciona
- hardware intelligence esta conectado ao catalogo
- sugestoes respeitam o nicho

### Fase 3 pronta quando

- TXT import funciona
- RFQ assistido funciona
- comparacao de fornecedores existe

### Fase 4 pronta quando

- budgets e autoexecucao limitada funcionam
- analytics macro respondem perguntas operacionais

