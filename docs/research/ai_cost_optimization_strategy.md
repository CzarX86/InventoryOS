# Estratégia de Redução de Custos de IA em Mensagens de Alta Volatilidade

## Contexto
Mensagens de WhatsApp são extremamente volumosas e muitas delas não contêm informações transacionais relevantes para o `InventoryOS` (ex: "Bom dia", emojis, conversas paralelas). Processar cada mensagem individualmente com modelos de IA de alta capacidade (Gemini Pro/1.5) pode gerar custos proibitivos.

---

## 1. Técnicas de Otimização e Controle de Custo

Abaixo estão as estratégias recomendadas para reduzir o processamento de Cloud Functions e chamadas de IA.

### Técnica 1: Filtragem de Relevância Pré-IA (Layer 0)
Não chame a IA para mensagens que claramente não são transações.
- **Filtro de Contatos Monitorados**: Somente processar mensagens de grupos ou contatos marcados como "Em Monitoramento" na Review Queue.
- **Filtro de Ruído (Regex/Tamanho)**: Ignorar mensagens com menos de 10 caracteres ou que contenham apenas emojis, links ou arquivos não suportados.
- **Deduplicação Proativa**: Evitar processar mensagens de status ("digitando...", "visto", etc.).

### Técnica 2: Agrupamento em Lote (Batching & Windowing)
Em vez de disparar uma IA para cada mensagem (`1 msg = 1 prompt`), agrupar mensagens por Janela de Tempo.
- **Buffer de Mensagens**: Salvar mensagens em uma coleção temporária (`message_buffer`).
- **Trigger de Janela**: A cada 10-15 minutos (ou quando o buffer atingir X mensagens do mesmo chat), processar todas de uma vez.
- **Prompt Consolidado**: "Extraia todas as transações deste bloco de mensagens: [Mensagem 1, Mensagem 2, ... Mensagem 10]".
- **Impacto**: Redução drástica do overhead de tokens de sistema (instruções do prompt) e custo de invocação de functions.

### Técnica 3: Classificação por Modelo "Light" (Tiered Processing)
Usar modelos mais baratos para decidir se vale a pena usar o modelo caro.
- **Tier 1 (Gemini 2.0 Flash)**: Modelo 10x mais barato. Usado apenas para classificar: "Esta conversa contém uma transação de inventário? [Sim/Não]".
- **Tier 2 (Gemini 1.5 Pro)**: Usado apenas se Tier 1 retornou **Sim**, para realizar a extração estruturada (JSON).
- **Vantagem**: 90% das mensagens de "Bom dia" ou "Temos em estoque?" serão descartadas pelo custo mínimo do Flash.

### Técnica 4: Compressão e Pré-processamento de Payload
Reduzir a quantidade de tokens enviados ao prompt (Input Tokens).
- **Limpeza de Metadados**: Remover IDs de mensagem, timestamps longos e nomes de push desnecessários do texto passado à IA.
- **Sumarização Gradual**: Manter um "Sumário do Estado do Chat" em vez de enviar todo o histórico. Enviar apenas: `[Sumário Anterior] + [Mensagens Novas]`.
- **Deteção de Intenção**: Identificar se a mensagem é uma pergunta (onde não há transação a extrair) ou uma afirmação de venda/compra.

---

## 2. Implementação Sugerida (Workflow)

Para o `InventoryOS`, o fluxo de ingestão ideal seria:

1. **Webhook chega**: Salvo no Firestore (`whatsapp_messages`).
2. **Relevance Filter (Function)**:
   - Se contato não monitorado -> Parar.
   - Se mensagem curta/ruído -> Parar.
3. **Buffering**:
   - Adicionar mensagem ao campo `pendingText` no documento do chat (`whatsapp_chats/{remoteJid}`).
   - Incrementar `messageCounter`.
4. **Scheduled Task (Pub/Sub)**:
   - Acionada a cada 15 min.
   - Busca chats com `messageCounter > 0`.
   - Lê `pendingText` e envia para o **Gemini Flash** para extração.
   - Limpa `pendingText` e `messageCounter`.
5. **Review Queue**:
   - Os dados extraídos vão para a fila de aprovação humana.

---

## 3. FinOps e Monitoramento
- **Dashboard de Economia**: Medir "Mensagens Recebidas" vs "Mensagens Enviadas para IA".
- **Quota per Chat**: Limitar a quantidade de processamentos de IA por dia para o mesmo chat (evitar loops e ataques de custo).

**Conclusão**: A transição de um modelo de "Invocação por Mensagem" para um modelo de "Invocação por Lote ou Janela" é a maior oportunidade de economia no projeto. Além disso, a simples filtragem por "Contatos Monitorados" reduzirá o volume em até 70% em ambientes reais.
