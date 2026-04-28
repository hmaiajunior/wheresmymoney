# Arquitetura e Stack Tecnológica — WMM

Documento técnico que detalha a arquitetura proposta para o Where's My Money, com foco em **pragmatismo para o MVP** e **caminho claro de evolução** para escala. Nada aqui é acadêmico — cada escolha tem justificativa e tradeoff.

---

## 1. Princípios de Arquitetura

Fundamentos que guiam todas as decisões técnicas do projeto:

1. **Modular monolith primeiro, microserviços só quando doer.** Começar com um único deployável de módulos bem isolados. Extrair serviços apenas quando houver dor real (escala, times diferentes, falhas isoladas).
2. **Event-driven para trabalho assíncrono.** Webhooks do WhatsApp precisam responder em <20s. Tudo que demora (IA, OCR, relatórios, Open Finance) vai para fila.
3. **Privacy-first.** Criptografia de campos sensíveis no banco, RLS (Row-Level Security) ativo por padrão, zero armazenamento de credenciais bancárias, LGPD desde o dia 1.
4. **Idempotência em todos os pontos críticos.** Webhooks do WhatsApp e Open Finance podem chegar duplicados — toda entrada tem chave de deduplicação.
5. **Observabilidade não é opcional.** Logs estruturados, tracing distribuído e métricas desde o MVP. Debugar fluxo de IA sem traces é inviável.
6. **Stack unificada em TypeScript.** Mesma linguagem entre backend (NestJS), frontend (Next.js) e mobile (React Native) reduz fricção de desenvolvimento e compartilha tipos.
7. **Cloud-agnostic até onde for razoável.** Usar tecnologias abertas (Postgres, Redis, S3-compatível) para não ficar refém de um provedor.

---

## 2. Visão Geral da Arquitetura

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CANAIS DE ENTRADA                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────────┐     │
│  │ WhatsApp │   │  Web     │   │  Mobile  │   │ Webhooks Externos│     │
│  │ (Meta)   │   │ Dashboard│   │ (v2.0)   │   │ (OF, Fintechs)   │     │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────────┬─────────┘     │
└───────┼──────────────┼──────────────┼──────────────────┼───────────────┘
        │              │              │                  │
┌───────▼──────────────▼──────────────▼──────────────────▼───────────────┐
│                        API GATEWAY (NestJS)                            │
│  • Auth (JWT)   • Rate Limiting   • Idempotência   • Validação         │
└───────┬────────────────────────────────────────────────────────────────┘
        │
┌───────▼────────────────────────────────────────────────────────────────┐
│                   MODULAR MONOLITH — Core Services                     │
│                                                                        │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ Users & │ │ Txns &   │ │ Budgets │ │ Reports  │ │ AI Agent     │    │
│  │ Auth    │ │ Accounts │ │ & Goals │ │ & Insights│ │ Orchestrator│    │
│  └─────────┘ └──────────┘ └─────────┘ └──────────┘ └──────┬───────┘    │
│                                                           │            │
│  ┌─────────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────▼─────────┐  │
│  │ Open Finance│ │ WhatsApp │ │Subscription│ │ Claude API Client    │  │
│  │ Adapter     │ │ Adapter  │ │ Detective  │ │ (Tool Use + Cache)   │  │
│  └─────────────┘ └──────────┘ └───────────┘ └──────────────────────┘   │
└───────┬────────────────────────────────────────────────────────────────┘
        │
┌───────▼────────────────────────────────────────────────────────────────┐
│                  FILA DE EVENTOS (BullMQ/Redis)                        │
│  • of-sync  • categorize  • whatsapp-reply  • report-gen  • notify     │
└───────┬────────────────────────────────────────────────────────────────┘
        │
┌───────▼────────────────────────────────────────────────────────────────┐
│                    WORKERS (Consumidores)                              │
│  • OF Sync Worker   • AI Categorizer   • Report Generator              │
│  • WhatsApp Sender  • Notification Dispatcher   • OCR Pipeline         │
└───────┬────────────────────────────────────────────────────────────────┘
        │
┌───────▼────────────────────────────────────────────────────────────────┐
│                        CAMADA DE DADOS                                 │
│  ┌────────────┐  ┌──────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │PostgreSQL  │  │  Redis   │  │  S3/R2      │  │ ClickHouse      │    │
│  │(OLTP + RLS)│  │(cache+Q) │  │(recibos/PDF)│  │(analytics, v2)  │    │
│  └────────────┘  └──────────┘  └─────────────┘  └─────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                        SERVIÇOS EXTERNOS                               │
│  Claude API │ Pluggy (OF) │ Google Vision (OCR) │ Twilio (WhatsApp)    │
│  Fintechs (Nubank/Inter/PicPay) │ Firebase (Push) │ Sentry │ PostHog   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Componentes da Arquitetura

### 3.1 API Gateway (NestJS)

Entrada única para todos os clientes. Responsabilidades:

- **Autenticação e autorização:** JWT de curta duração + refresh tokens
- **Rate limiting:** por usuário e por IP (via `@nestjs/throttler` com Redis)
- **Idempotência:** header `Idempotency-Key` obrigatório em POSTs críticos; cache em Redis por 24h
- **Validação de entrada:** `class-validator` + DTOs
- **Roteamento:** REST para clientes próprios, GraphQL opcional para o dashboard (não no MVP)

Webhooks recebidos aqui:
- `/webhooks/whatsapp` — mensagens de entrada do Meta/Twilio
- `/webhooks/open-finance` — notificações de novas transações do Pluggy
- `/webhooks/fintechs/:provider` — callbacks de parceiros de investimento

Cada webhook:
1. Valida assinatura HMAC
2. Responde 200 OK imediatamente
3. Enfileira evento para processamento assíncrono

### 3.2 Módulos Core (Modular Monolith)

Cada módulo tem: `controller/` (HTTP), `service/` (lógica), `repository/` (acesso a dados), `dto/` (contratos), `events/` (publicação de eventos internos). Comunicação entre módulos via **eventos** (EventEmitter2) ou **chamadas de serviço diretas** quando síncrono.

| Módulo | Responsabilidade |
|---|---|
| `auth` | Login, refresh, MFA, recuperação de senha |
| `users` | Perfil, preferências, consentimentos LGPD |
| `accounts` | Contas bancárias, carteiras, cartões |
| `transactions` | Lançamentos, categorização, deduplicação |
| `categories` | Categorias padrão + customizadas |
| `budgets` | Orçamentos por categoria, alertas de estouro |
| `goals` | Metas financeiras, cofrinhos virtuais |
| `reports` | Geração de relatórios semanais/mensais, Wrapped |
| `ai-agent` | Orquestração do Coach WMM (Claude + tool use) |
| `whatsapp` | Adapter WhatsApp (envio/recebimento) |
| `open-finance` | Consentimento, sync, deduplicação |
| `subscriptions` | Detective de assinaturas recorrentes |
| `notifications` | Push, e-mail, WhatsApp (dispatcher unificado) |
| `mei` | Modo MEI/Autônomo (fase 2) |
| `family` | Perfis compartilhados, mesada digital |
| `splits` | Divisão de despesas entre pessoas |

### 3.3 Workers e Filas (BullMQ)

Filas dedicadas por domínio com prioridades distintas:

| Fila | Prioridade | SLA típico | Conteúdo |
|---|---|---|---|
| `whatsapp-inbound` | Alta | <3s | Mensagens recebidas → IA → resposta |
| `whatsapp-outbound` | Alta | <5s | Respostas e notificações para enviar |
| `of-sync` | Média | <60s | Sincronização de transações do Open Finance |
| `categorize` | Média | <10s | Categorização por IA de novas transações |
| `ocr-receipt` | Média | <15s | Processamento de imagens de notas |
| `reports-weekly` | Baixa | <5min | Geração do relatório semanal |
| `reports-monthly` | Baixa | <10min | Relatório mensal + imagens |
| `wrapped-annual` | Baixa | <30min | WMM Wrapped em lote (janeiro) |
| `notifications` | Média | <10s | Push, e-mail, alertas |

Cada worker tem: retry com backoff exponencial, dead-letter queue (DLQ), logs estruturados com `jobId` correlacionado, timeout configurável.

### 3.4 AI Agent Orchestrator

Coração conversacional do WMM. Baseado em **Claude com Tool Use** (function calling).

**Fluxo básico:**
```
Usuário WhatsApp → Webhook → Fila → Agent Orchestrator:
  1. Carrega contexto da conversa (últimas N mensagens do Redis)
  2. Envia para Claude com system prompt + tools disponíveis
  3. Claude decide: responder ou chamar tool
  4. Se tool: executa (ex: registrar_transacao), devolve resultado
  5. Loop até Claude dar resposta final
  6. Envia resposta ao usuário via WhatsApp
  7. Persiste conversa no Postgres (histórico longo) + Redis (contexto ativo)
```

**Tools expostas ao Claude:**
- `registrar_transacao(valor, categoria, descricao, conta, data)`
- `consultar_saldo(conta?, periodo?)`
- `consultar_gastos(categoria?, periodo)`
- `criar_meta(nome, valor_alvo, prazo)`
- `gerar_relatorio(tipo: semanal|mensal|custom)`
- `simular_cenario(cenario)` — simulador "E Se?"
- `cancelar_assinatura_tutorial(nome_servico)`
- `buscar_recibo(criterios)`
- `ativar_modo_crise()` / `desativar_modo_crise()`

**Otimizações de custo:**
- **Prompt caching** do system prompt (persona, regras, exemplos) — reduz ~80% do custo em mensagens recorrentes
- **Roteamento por modelo:** Haiku 4.5 para classificação simples ("isso é uma despesa?"), Sonnet 4.6 para diálogo e análise, Opus 4.7 só para relatórios mensais e análise profunda
- **Cache de respostas comuns** em Redis (ex: "qual o saldo?" cacheado por 60s)

**Persona do Coach (system prompt):**
- Amigável, empático, brasileiro, bem-humorado sem ser infantil
- Zero julgamento de gastos
- Celebra progresso, sugere ao invés de ordenar
- Disclaimer: informação financeira ≠ recomendação de investimento

### 3.5 Open Finance Adapter

Módulo isolado que abstrai o provedor (Pluggy no MVP, Belvo como fallback/expansão).

**Interface interna:**
```typescript
interface OpenFinanceProvider {
  createConsent(userId, institutionId, scopes): ConsentUrl
  handleConsentCallback(token): UserConsent
  syncTransactions(consentId, since): Transaction[]
  getAccountBalance(consentId, accountId): Balance
  revokeConsent(consentId): void
  onWebhook(payload): Event[]
}
```

**Fluxo de sync:**
1. Cron job dispara a cada hora: para cada consent ativo, enfileira `of-sync` job
2. Worker chama `syncTransactions(consentId, lastSyncAt)`
3. Normaliza transações (schema interno padrão)
4. Deduplica contra lançamentos manuais (match por valor + data ± 3 dias)
5. Dispara categorização via IA em batch
6. Notifica usuário no WhatsApp se valor > threshold configurável

**Gestão de consentimento:**
- Expiração de 12 meses (regra Bacen)
- Worker diário verifica consents próximos do vencimento (< 15 dias) e dispara mensagem de renovação no WhatsApp
- Log de auditoria de todas as operações com consentimento

### 3.6 WhatsApp Adapter

**Opções avaliadas:**
- **Twilio API for WhatsApp** — oficial, estável, ~US$0.005/mensagem + fee do Meta. Escolha para produção.
- **Evolution API** — self-hosted, sem custo por mensagem, mas mais frágil e risco de banimento. Útil para testes/dev.
- **Meta Cloud API direto** — sem intermediário, mais barato, mais trabalho de implementação. Migração futura quando volume justificar.

**Decisão:** Evolution API em dev, Twilio em staging/prod no MVP, migrar para Meta direto na v2.0.

**Features específicas:**
- **Templates aprovados** pela Meta para mensagens proativas (relatórios semanais, alertas)
- **Conversa livre** de 24h após última mensagem do usuário (aí pode-se mandar qualquer coisa)
- **Media handling:** download de imagens/áudios recebidos, upload para S3, pipeline de OCR/transcrição
- **Retry e rate limiting:** Meta limita 1000 msgs/dia por número no começo, escala conforme reputação

### 3.7 Dashboard Web (Next.js)

**Stack:**
- Next.js 15 (App Router) + React Server Components
- Tailwind CSS + shadcn/ui
- TanStack Query para cache de dados
- Recharts ou Visx para gráficos
- Zod para validação compartilhada com o backend

**Páginas principais:**
- Dashboard (saldo, gasto do mês, meta de poupança)
- Extrato com filtros e busca
- Relatórios (semanal, mensal, anual)
- Orçamentos por categoria
- Metas e cofrinhos
- Configurações (contas, Open Finance, consentimentos LGPD)
- Chat com o Coach (interface web do mesmo agente do WhatsApp)

**Server Actions** para mutações, evitando boilerplate de API routes para chamadas internas.

### 3.8 Mobile App (v2.0 — React Native)

- React Native + Expo (EAS Build)
- Compartilha `packages/shared` (tipos, schemas) com web e backend
- Push notifications via Expo Push
- Biometria local (Face ID / fingerprint)
- Offline-first para registros rápidos (sync quando online)

---

## 4. Stack Completa por Camada

### Backend
| Categoria | Tecnologia | Justificativa |
|---|---|---|
| Runtime | Node.js 22 LTS | Performance + TS nativo |
| Framework | NestJS 11 | Modularidade, DI, ecossistema maduro |
| ORM | Prisma 5 | Type-safe, migrations automáticas, DX excelente |
| Validação | Zod + class-validator | Tipos runtime + DTOs |
| Auth | @nestjs/jwt + Argon2 | Padrão, seguro |
| Filas | BullMQ 5 | Redis-based, battle-tested |
| Testes | Vitest + Supertest | Rápido, compatível com NestJS |
| HTTP client | undici (nativo) | Performance |

### Frontend
| Categoria | Tecnologia | Justificativa |
|---|---|---|
| Framework | Next.js 15 | SSR + RSC + ecossistema |
| UI | Tailwind + shadcn/ui | Customizável, sem lock-in |
| State | TanStack Query + Zustand | Server state + client state separados |
| Gráficos | Recharts | Boa DX, cobre 95% dos casos |
| Forms | React Hook Form + Zod | Performance + validação compartilhada |
| i18n | next-intl | Suporte a PT-BR com fallbacks |

### Dados
| Categoria | Tecnologia | Justificativa |
|---|---|---|
| OLTP | PostgreSQL 16 | Confiável, RLS nativo, JSON, extensões |
| Cache/Queue | Redis 7 | Padrão de mercado |
| Object storage | Cloudflare R2 | S3-compatível, sem egress fee |
| Analytics (v2) | ClickHouse | Queries analíticas em bilhões de linhas |
| Search | Postgres FTS (MVP) → Meilisearch (v2) | Evita complexidade no início |

### IA e Integrações
| Categoria | Tecnologia | Justificativa |
|---|---|---|
| LLM principal | Claude Sonnet 4.6 | Melhor tradeoff custo/qualidade para diálogo |
| LLM barato | Claude Haiku 4.5 | Classificação e rotulagem em volume |
| LLM profundo | Claude Opus 4.7 | Relatórios mensais, análises complexas |
| WhatsApp | Twilio (prod) / Evolution (dev) | Explicado em 3.6 |
| Open Finance | Pluggy | Melhor cobertura BR + SDK TS |
| OCR | Google Vision API | Qualidade em notas fiscais brasileiras |
| Transcrição de áudio | Whisper API (OpenAI) | Estado-da-arte em PT-BR |
| Geração de vídeo Wrapped | Remotion | React-based, programático |

### Observabilidade
| Categoria | Tecnologia | Justificativa |
|---|---|---|
| Logs | Pino + Loki | Estruturado, barato |
| Métricas | Prometheus + Grafana | Padrão open-source |
| Tracing | OpenTelemetry + Tempo | Vendor-neutral |
| Erros | Sentry | DX imbatível |
| Product analytics | PostHog self-hosted | Coerente com marca privacy-first |
| Uptime | BetterStack ou Uptime Kuma | Alertas em múltiplos canais |

### Infraestrutura
| Categoria | Tecnologia | Justificativa |
|---|---|---|
| Cloud (MVP) | Railway ou Fly.io | Deploy simples, baixo custo inicial |
| Cloud (escala) | AWS (ECS Fargate + RDS + ElastiCache) | Controle total, elasticidade |
| IaC | Terraform + Terragrunt | Reprodutibilidade |
| CI/CD | GitHub Actions | Integrado ao repositório |
| Container | Docker multi-stage | Build otimizado |
| Secrets | AWS Secrets Manager / Doppler | Nunca em variáveis de ambiente puras |
| CDN | Cloudflare | Grátis + WAF incluso |

### Repositório
| Categoria | Tecnologia | Justificativa |
|---|---|---|
| Monorepo | Turborepo + pnpm | Cache de builds, workspaces |
| Linter | Biome | Mais rápido que ESLint+Prettier |
| Commits | Changesets + Conventional Commits | Changelog automático |
| Docs | Starlight (Astro) | Docs técnicas + públicas |

---

## 5. Modelo de Dados (Principais Entidades)

Diagrama simplificado — apenas entidades centrais:

```
User ─┬─< Account ──────< Transaction >── Category
      │                           │
      ├─< Consent (OpenFinance)   ├──> Subscription (detectada)
      │                           └──> Receipt (anexo S3)
      ├─< Budget >── Category
      ├─< Goal
      ├─< FamilyMember (self-ref)
      └─< ConversationThread ──< Message (histórico do Coach)

SplitGroup >── SplitGroupMember (User)
           └─< SplitExpense ──< SplitShare (User, valor)
```

**Observações importantes:**
- Todas as tabelas com dados de usuário têm coluna `user_id` e **RLS habilitado** via Postgres policies. Cada request define `SET LOCAL app.user_id = ?` na transação.
- Campos sensíveis (descrição de transação, token OF, nome da instituição) criptografados com `pgcrypto` usando chave por tenant derivada de master key no AWS KMS.
- Tabelas de eventos (`domain_events`) para event sourcing básico — permite reprocessar categorização, recalcular relatórios, auditoria.
- `conversation_threads` e `messages` armazenam histórico do Coach com TTL de 90 dias (configurável pelo usuário para privacidade).

---

## 6. Fluxos Críticos (Sequências)

### 6.1 Registro de Despesa via WhatsApp

```
[Usuário] --"gastei 45 no almoço"--> [Meta/Twilio]
[Twilio] --POST /webhooks/whatsapp--> [API Gateway]
[Gateway] valida HMAC, retorna 200, enfileira "whatsapp-inbound"
[Worker] pega job, carrega contexto Redis (últimas 10 msgs)
[Worker] chama Claude com tools disponíveis
[Claude] decide: usar tool `registrar_transacao`
[Worker] executa tool → [TransactionsService.create()]
  → salva no Postgres
  → emite evento "transaction.created"
[Worker] devolve resultado para Claude
[Claude] gera resposta natural: "Registrado! 🍽️ ..."
[Worker] enfileira "whatsapp-outbound" com a resposta
[Sender Worker] envia via Twilio → usuário recebe
```

**Total esperado:** 2-5 segundos. Se passar de 10s, mensagem intermediária ("⏳ processando...") é enviada.

### 6.2 Sincronização via Open Finance

```
[Cron /5min] --dispara--> [OF Scheduler]
[Scheduler] busca consents ativos, enfileira 1 job por consent
[Worker of-sync] para cada consent:
  1. chama Pluggy.syncTransactions(consentId, lastSyncAt)
  2. normaliza payload → schema interno
  3. para cada txn:
     a. tenta deduplicar contra manuais (valor ± R$0.01, data ± 3 dias)
     b. se duplicata: pergunta ao usuário via WhatsApp para confirmar
     c. se nova: salva como pending_categorization
  4. enfileira "categorize" para cada txn nova
[Worker categorize] chama Haiku com contexto do usuário
  → categoriza + enriquece nome do estabelecimento
  → salva e emite "transaction.categorized"
[Notification Worker] se txn > threshold ou categoria incomum:
  → envia WhatsApp "Detectei R$X em Y. Correto?"
```

### 6.3 Geração de Relatório Semanal

```
[Cron segunda 8h] --dispara--> [Report Scheduler]
[Scheduler] enfileira 1 job por usuário ativo (em lotes de 1000)
[Worker reports-weekly] para cada usuário:
  1. agrega transações dos últimos 7 dias
  2. compara com semana anterior
  3. identifica top categorias, alertas, wins
  4. chama Sonnet com dados estruturados → gera narrativa empática
  5. renderiza gráfico (Remotion/Sharp) → PNG em S3
  6. enfileira "whatsapp-outbound" com texto + imagem
[Sender Worker] envia
```

**Proteção contra spam:** usuário pode desabilitar/reagendar relatórios. Se 3 relatórios consecutivos forem ignorados, pausa e pergunta se ainda quer receber.

### 6.4 Deduplicação Manual vs. Open Finance

Problema: usuário lança "gastei 45 no almoço" às 12h, Pluggy devolve a mesma transação às 14h. Não pode virar 2 lançamentos.

Algoritmo:
1. Ao chegar txn do OF, buscar lançamentos manuais com:
   - mesmo valor (±R$0.01)
   - mesma data (±3 dias)
   - mesma conta
   - categoria compatível
2. Se **1 match:** marca manual como "confirmado por OF", merge de metadados (adiciona `merchant_name`, `coordinates` se disponível)
3. Se **múltiplos matches:** envia WhatsApp pedindo confirmação ao usuário
4. Se **0 matches:** cria transação nova

---

## 7. Segurança e Compliance LGPD

### Princípios
- **Minimização:** coletar apenas o necessário. Ex: não guardamos CPF se não precisarmos.
- **Criptografia:** TLS 1.3 em trânsito, AES-256 em repouso com chave por tenant.
- **Segregação:** ambientes dev/staging/prod totalmente isolados.
- **Consentimento explícito:** cada uso de dados (analytics, IA, Open Finance) tem consentimento específico e revogável.

### Medidas concretas
- **Row-Level Security (RLS)** ativo em todas as tabelas com `user_id`
- **Field-level encryption** para: tokens OF, descrições de transação, mensagens do Coach
- **Argon2id** para hashing de senhas (parâmetros seguros)
- **MFA obrigatório** para operações críticas (adicionar conta, exportar dados, apagar conta)
- **Audit log imutável** de todas as operações sensíveis (Append-only em tabela separada + export para S3)
- **Data retention policies:**
  - Transações: guardadas pelo tempo da conta ativa + 5 anos (compliance fiscal)
  - Mensagens do Coach: 90 dias padrão (configurável)
  - Logs de acesso: 6 meses
- **Right to erasure (LGPD art. 18):** endpoint `DELETE /me` apaga tudo em até 30 dias, gera certificado de exclusão

### Segurança específica de Open Finance
- Tokens OF guardados criptografados com KMS + envelope encryption
- Rotação automática antes da expiração
- Nunca logar payloads completos (apenas correlation IDs)

### LGPD operacional
- DPO designado (mesmo que seja o fundador inicialmente)
- RIPD (Relatório de Impacto à Proteção de Dados) feito antes de qualquer nova integração
- Política de privacidade clara e em PT-BR simples

---

## 8. Observabilidade

### Logs
- **Formato:** JSON estruturado (Pino)
- **Campos obrigatórios:** `traceId`, `userId` (hasheado em prod), `module`, `severity`, `event`
- **Correlação:** `X-Request-ID` propagado em todos os lugares
- **Destino:** stdout → Fluent Bit → Loki

### Métricas
- Métricas por módulo: latência (p50/p95/p99), error rate, throughput
- Métricas de negócio: mensagens WhatsApp recebidas, transações categorizadas, sync OF
- Métricas de custo: tokens Claude consumidos por usuário, chamadas Pluggy
- Grafana com dashboards por persona: operação, produto, finanças

### Tracing
- OpenTelemetry auto-instrumenta NestJS, Prisma, HTTP out
- Traces de ponta a ponta: webhook → fila → worker → Claude → resposta
- Sampling: 100% em dev, 10% em prod, 100% para erros

### Alertas
- **P1 (página alguém):** webhook WhatsApp com falha > 5%, OF sync parado > 30min, Postgres CPU > 90%
- **P2 (Slack):** latência p95 > 5s no agente, erro em relatório semanal
- **P3 (dashboard):** custo Claude fora do orçamento diário, taxa de deduplicação anormal

---

## 9. Deploy e Infraestrutura

### MVP (primeiros 6 meses, até ~10k usuários)
- **Plataforma:** Railway ou Fly.io
- **Estimativa de infra:** ~US$200-400/mês
- Postgres gerenciado (Railway ou Neon)
- Redis gerenciado (Upstash)
- Cloudflare R2 para storage
- GitHub Actions para CI/CD
- 1 ambiente de staging + prod

### Escala (após product-market fit)
- **AWS** (ou GCP equivalente):
  - ECS Fargate para API e workers (auto-scaling)
  - RDS Postgres Multi-AZ (read replicas conforme necessário)
  - ElastiCache Redis em cluster mode
  - S3 + CloudFront para assets
  - Secrets Manager
- **Kubernetes apenas se justificado** (múltiplos times, regiões, alta complexidade)

### CI/CD (GitHub Actions)
```
PR → lint + typecheck + testes unitários + build → preview deploy (Railway)
Merge main → testes integração + e2e → deploy staging
Tag release → deploy prod (com approval manual)
```

### Estratégias de deploy
- Zero-downtime via rolling update
- Migrations de banco aplicadas antes do deploy do código (ambas backward-compatible)
- Feature flags (GrowthBook) para rollout gradual
- Blue/green para mudanças críticas

---

## 10. Evolução da Arquitetura (Roadmap Técnico)

### Fase 1 — MVP (mês 1-3)
- Monolith NestJS + Postgres + Redis
- WhatsApp via Evolution (dev) e Twilio (prod)
- Claude Sonnet para tudo
- Deploy em Railway
- Observabilidade básica (Sentry + logs Railway)

### Fase 2 — v1.0 (mês 4-6)
- Adicionar Pluggy/Open Finance
- Haiku para categorização em massa
- BullMQ para workers dedicados
- OpenTelemetry + Grafana
- Primeiro teste de carga (1k usuários simulados)

### Fase 3 — v2.0 (mês 7-12)
- Migração para AWS se escala justificar (>10k MAU)
- ClickHouse para analytics
- Meilisearch para busca
- Multi-região (SP + NE) se houver concentração geográfica
- Separar WhatsApp como serviço dedicado (primeiro "microserviço")

### Fase 4 — Escala (1 ano+)
- Extrair AI Agent como serviço dedicado (pode ter stack Python se justificar)
- Sharding de Postgres por tenant se necessário
- CDN de respostas do Coach para queries frequentes
- Edge functions (Cloudflare Workers) para webhooks críticos

---

## 11. Estimativa de Custos (MVP vs. Escala)

### MVP (100-1000 usuários ativos)
| Item | Custo mensal |
|---|---|
| Railway (API + workers + Postgres + Redis) | US$50-150 |
| Cloudflare R2 (storage) | US$5 |
| Twilio WhatsApp (100k msgs) | US$500 |
| Claude API (Sonnet + Haiku) | US$200-500 |
| Pluggy (Open Finance) | US$100-300 |
| Google Vision (OCR) | US$20 |
| Sentry + PostHog | US$30 |
| **Total** | **US$900-1500/mês** |

### Escala (100k usuários ativos)
| Item | Custo mensal |
|---|---|
| AWS (compute + RDS + Redis + S3) | US$3-5k |
| Twilio WhatsApp | US$15-25k |
| Claude API (com cache) | US$8-15k |
| Pluggy | US$5-10k |
| Observabilidade | US$500-1k |
| **Total** | **US$32-56k/mês** |

**Receita necessária para breakeven em escala (100k MAU):**
- Freemium conversion ~5% → 5.000 pagantes
- Ticket médio ~R$22 (mix Plus + Família + Pro MEI) → R$110k/mês = ~US$22k
- **Margem só fica saudável com conversion >8% ou aumento de ticket** — daí a importância do posicionamento de "economia real" (app se paga)

---

## 12. Decisões em Aberto

Pontos que ainda precisam de discussão/prototipagem:

1. **Banco primário PostgreSQL vs. híbrido com MongoDB** para histórico de conversas do Coach (conversas são documentos, encaixam bem em Mongo). Tendência: ficar em Postgres com JSONB para reduzir operacional.
2. **Twilio vs. Meta Cloud API direto** — migrar quando volume justificar (~50k msgs/dia).
3. **Claude API vs. AWS Bedrock** para Claude — Bedrock pode reduzir latência se ficarmos em AWS, mas perde alguns recursos (prompt caching no Bedrock ainda é limitado).
4. **Self-hosting de LLM aberto** (Llama, Qwen) para tarefas de classificação simples — potencial redução de custo ~40% em escala, mas aumenta operacional. Reavaliar em ~50k usuários.
5. **Estratégia offline no mobile** — sincronização conflict-free (CRDTs?) vs. last-write-wins simples.
