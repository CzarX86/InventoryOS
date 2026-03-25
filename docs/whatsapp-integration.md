# Integração WhatsApp & Evolution API v2

Este documento descreve a arquitetura, o fluxo de dados e os princípios de design por trás da integração do WhatsApp (via Evolution API) no projeto InventoryOS.

## Visão Geral da Arquitetura

O sistema emprega uma arquitetura baseada em eventos para capturar, validar e processar mensagens recebidas no WhatsApp, isolando a API externa do nosso banco de dados.

O fluxo de integração é dividido em três camadas:
1. **Frontend (Gerenciador de Instâncias):** A UI onde o usuário conecta seu celular pareando o QR Code.
2. **Evolution API (VPS/Serviço Externo):** O Gateway que fornece a ponte nativa com o WhatsApp Web (via Baileys/whatsapp-web.js).
3. **Backend (Firebase Cloud Functions):** A API de ingestão segura de Webhooks e execução da regra de negócios de IA.

---

## 1. Regras de Isolamento (Multi-tenant e Ambientes)

A Evolution API não possui conhecimento nativo do nosso projeto/ambiente (Staging vs. Production, ou UUIDs de usuário). Para manter projetos isolados na mesma VPS da Evolution API, usamos um **Prefixing System**:

- Todas as instâncias criadas no Firebase recebem automaticamente um prefixo contendo o ID do projeto no GCP (ex: `ios_`).
- Assim, se a VPS for compartilhada entre diferentes aplicações, as instâncias do nosso aplicativo se chamarão, por exemplo: `ios_principal` ao invés de apenas `principal`.
- Para o usuário, a UI esconde o prefixo, garantindo uma boa experiência visual.

---

## 2. Autenticação do Webhook (O "Mistério" da Assinatura)

Para evitar que agentes maliciosos enviem requisições falsas para nosso backend dizendo que chegaram mensagens no WhatsApp, usamos Segurança no Webhook.

**A evolução da V1 para V2 do Evolution API:**
- Em versões legadas, a VPS assinava o payload usando criptografia HMAC (`x-hub-signature-256`) através de um secret global, e o nosso Firebase apenas comparava as hashes.
- Na **Evolution API v2**, a segurança baseada em hash genérica é desencorajada em favor de Tokens por requisição. Se um webhook for configurado **sem headers declarados ativamente**, a VPS envia os eventos sem qualquer assinatura (anônimos), causando erro `401 Unauthorized` na nossa Cloud Function (por design preventivo).

**A Solução Implementada:**
1. Quando apertamos o botão "Configurar Webhook" na nossa UI, e disparamos `setWhatsappWebhook`, injetamos explicitamente o payload:
   ```json
   {
     "url": "https://HOST/evolutionWebhook",
     "headers": {
       "Authorization": "Bearer <EVOLUTION_WEBHOOK_SECRET>"
     }
   }
   ```
2. A nossa Cloud Function `evolutionWebhook` então confere todas as vezes se o header de requisição corresponde a esta chave pré-acordada.

---

## 3. Fluxo de Eventos (Activity Monitor)

Qualquer comunicação (mensagem enviada, recebida, status de aparelho conectado ou bateria carregada) gera um Trigger na Evolution API que é disparado para o nosso Webhook:

**Pipeline de Processamento:**
1. A função `evolutionWebhook` recebe a requisição (`POST`) e valida as chaves.
2. Caso válida, o evento é traduzido em um documento minimalista e enxuto (`{ eventType, id, receivedAt, payload }`).
3. Este documento é "despejado" na coleção `whatsapp_webhook_events` passivamente. Isso serve como buffer para desacoplar a ingestão (rápida) do processamento em massa da IA (lento, assíncrono).

> Note que o Firestore salva os timestamps internamente usando o relógio do servidor (`FieldValue.serverTimestamp()`), o que deve ser ativamente tratado ao expor objetos JSON na view (`getWhatsappEvents`) transformando-os em ISO Strings ou millissegundos para manter o Activity Monitor com o relógio correto (evitando o sumiço da data).

## 4. Próxima Fase (Inteligência Artificial)

Com essa base resolvida, a Fase 2 envolverá:
- **Ignorar/Anotar Números:** As mensagens novas que chegam acenderão uma notificação no sistema perguntando se o número recém-descoberto deve ser processado pelas automações de Inventário ou ignorado.
- **Background Function:** Uma Trigger OnCreate no Firebase processará os conteúdos de texto enfileirados em `whatsapp_webhook_events` conectando ao LLM (Gemini) e escrevendo registros passivos no Inventário de acordo com a predefinição do usuário.
