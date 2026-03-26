# Pesquisa: Identificação de Grupos no Evolution API v2 e Baileys

## Objetivo
Determinar o método correto e mais eficiente para obter o nome legível de um grupo de WhatsApp a partir de uma mensagem recebida via webhook `MESSAGES_UPSERT` no Evolution API v2 (baseado em Baileys).

---

## 1. Funcionamento dos Webhooks (MESSAGES_UPSERT)
No Evolution API v2, o evento `MESSAGES_UPSERT` é disparado sempre que uma mensagem chega ou é enviada pela instância conectada. O payload típico contém:

- **instance**: O nome da sua instância (ex: `ios_principal`).
- **data.key.remoteJid**: O identificador único do chat (ex: `123456789@g.us` para grupos ou `5511...s.whatsapp.net` para privados).
- **data.pushName**: Nome do remetente individual (não do grupo).

### O Campo `groupContext`
Em algumas subversões da v2 e dependendo da configuração da Evolution API, o payload de mensagem pode incluir um objeto `groupContext`.
```json
// Possível estrutura em v2
"data": {
  "groupContext": {
    "groupId": "123456789@g.us",
    "groupName": "Nome do Grupo Exemplo"
  }
}
```
**Problema**: Este campo não é garantido em todos os tipos de mensagem ou versões menores da v2. Se ele estiver ausente, o sistema verá apenas o `remoteJid`.

---

## 2. Métodos de Resolução de Nomes (Estratégia Recomendada)

Para garantir que o nome do grupo seja identificado corretamente sem falhas, a estratégia deve seguir esta hierarquia de fontes:

### Passo A: Verificação no Payload Direto
Sempre tente ler primeiro do payload de entrada por performance (custo zero de latência/API).
```javascript
const groupName = payload.data?.groupContext?.groupName || null;
```

### Passo B: Cache Local (Firestore)
Se o nome não estiver no payload, consulte uma coleção de cache (`whatsapp_groups`). No nosso projeto, isso já está parcialmente implementado.
- **Vantagem**: Evita chamadas externas para a VPS do Evolution API.
- **Ação**: Se o `remoteJid` termina em `@g.us`, procure o documento correspondente no Firestore.

### Passo C: Consulta à API Evolution (`findGroupInfos`)
Se o cache estiver vazio ou desatualizado, utilize o endpoint oficial da Evolution API v2.
- **Endpoint**: `GET /group/findGroupInfos/:instance?groupJid=:jid`
- **Funcionamento**: A Evolution API solicita ao Baileys (engine) os metadados do grupo. O retorno inclui o `subject` (nome do grupo).
- **Limitação**: Esta chamada tem custo de latência e processamento na VPS. Deve ser usada apenas como fallback.

### Passo D: Sincronização em Massa (`findAll`)
Para grupos legados onde nenhuma mensagem foi recebida recentemente:
- **Endpoint**: `GET /group/findAll/:instance`
- **Ação**: Retorna todos os grupos em que a instância participa. Útil para "popular" o cache inicial.

---

## 3. Implementação Técnica Sugerida

Para resolver a dificuldade atual, o processamento do webhook deve ser enriquecido com o seguinte fluxo:

1. **Recebimento**: Webhook chega.
2. **Identificação**: Se `remoteJid` contém `@g.us`:
   - Checar `payload.data.groupContext.groupName`.
   - Se nulo, checar `Firestore: whatsapp_groups/{remoteJid}`.
   - Se ainda nulo, disparar uma **Task de Resolução Assíncrona** que chama `/group/findGroupInfos` e atualiza o Documento do Firestore.
3. **Escrita**: A mensagem é salva no banco já com o `groupName` resolvido ou "Pendente de Identificação".

---

## 4. Notas sobre o Baileys (Engine)
O Baileys não mantém um estado persistente automático de nomes de grupos que sobrevive a reinicializações sem uma sessão cacheada. Por isso, a Evolution API (e consequentemente o InventoryOS) precisa gerenciar o mapeamento `JID -> Nome` de forma persistente no Firestore.

**Conclusão**: A "dificuldade de identificação" reportada ocorre provavelmente porque o payload da v2 nem sempre envia o `groupName` e o sistema não está disparando a consulta de fallback ao `findGroupInfos` quando o cache está vazio.
