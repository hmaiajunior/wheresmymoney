# Where's My Money (WMM) — Brainstorm

## Visão Geral

Aplicativo de controle financeiro pessoal que une a praticidade de uma planilha com inteligência artificial, integração via WhatsApp e análises automatizadas. O foco é reduzir o atrito no registro de gastos, transformar dados financeiros em insights acionáveis e — acima de tudo — **diminuir a ansiedade financeira** do brasileiro médio, entregando economia real mês a mês.

---

## 1. Funcionalidades Base (Planilha Existente)

Funcionalidades core que replicam o controle já feito na planilha:

- Registro de receitas e despesas com data, valor, categoria e descrição
- Categorias configuráveis (alimentação, transporte, saúde, lazer, moradia, etc.)
- Controle de contas e carteiras (conta corrente, poupança, cartão de crédito, dinheiro)
- Lançamentos recorrentes (aluguel, assinaturas, salário)
- Saldo atual e projeção de saldo futuro
- Controle de parcelas de compras parceladas
- Fechamento mensal com resumo de entradas, saídas e saldo
- Metas de orçamento por categoria (ex: gastar no máximo R$ 800 em alimentação)

---

## 2. Diferenciais — O Que Vai Além do Mercado

### 2.1 Registro via WhatsApp com Agente Conversacional

Este é o principal diferencial de adoção do WMM. A maioria das pessoas abandona apps de finanças porque o atrito de abrir o app, navegar, preencher formulários e salvar é alto demais.

**Como funciona:**
- O usuário envia uma mensagem natural para um número de WhatsApp do WMM
- O agente de IA interpreta a mensagem e registra o lançamento
- Confirmação imediata no próprio WhatsApp com o resumo do lançamento

**Exemplos de interação:**
```
Usuário: "gastei 45 reais no almoço hoje"
WMM:     "Registrado! 🍽️ Alimentação — R$ 45,00 — Almoço (23/04/2026)"

Usuário: "paguei o cartão nubank 1200"
WMM:     "Registrado! 💳 Cartão Nubank — Pagamento R$ 1.200,00 (23/04/2026)"

Usuário: "recebi salário 5500"
WMM:     "Registrado! 💰 Receita — Salário R$ 5.500,00 (23/04/2026)"

Usuário: "quanto gastei essa semana?"
WMM:     [envia resumo semanal na hora]
```

**Capacidades do agente:**
- Identificar categoria automaticamente pelo contexto da mensagem
- Reconhecer valores em diferentes formatos (R$45, 45 reais, quarenta e cinco)
- Processar imagens de notas fiscais e extrair os dados automaticamente (OCR)
- Processar áudio (mensagem de voz) — o usuário fala o gasto e o agente transcreve e registra
- Perguntar por confirmação em casos ambíguos
- Sugerir categorias baseadas no histórico do usuário
- Permitir correção fácil ("não, era jantar, não almoço")

---

### 2.2 Análise Semanal e Mensal Automatizada

Relatórios proativos enviados pelo próprio WhatsApp ou por e-mail, sem que o usuário precise pedir.

**Análise Semanal (toda segunda-feira):**
- Total gasto na semana vs. semana anterior
- Top 3 categorias onde mais gastou
- Alerta se alguma categoria ultrapassou o ritmo esperado para o mês
- Frase motivacional ou dica financeira contextualizada

**Análise Mensal (dia 1 de cada mês):**
- Resumo completo: receitas, despesas, saldo gerado
- Comparativo com o mês anterior (% de variação por categoria)
- Gráfico de pizza das despesas por categoria (imagem enviada no WhatsApp)
- Evolução do patrimônio líquido
- Categorias onde houve melhora vs. categorias que pioraram
- Meta do próximo mês sugerida pela IA com base no histórico

**Alertas em Tempo Real:**
- Alerta ao atingir 80% do orçamento de uma categoria
- Alerta de gasto incomum ("você gastou 3x mais que o normal em lazer essa semana")
- Aviso de contas a vencer (se integrado com calendário ou banco)

---

### 2.3 Inteligência Financeira com IA

Diferenciais de análise que os apps convencionais não oferecem:

- **Detecção de padrões de consumo:** "Você tende a gastar mais nas sextas e sábados. Seus gastos em delivery aumentam 60% quando chove."
- **Projeção de fechamento do mês:** Com base nos gastos até agora e no histórico, projeta quanto vai sobrar ou faltar no fim do mês
- **Score de saúde financeira:** Pontuação de 0 a 100 que combina: taxa de poupança, controle de orçamento, regularidade de registro, evolução patrimonial
- **Sugestão de meta de poupança:** Calcula quanto o usuário poderia poupar de forma realista com base nos seus gastos reais
- **Categorização automática:** Aprende com as correções do usuário para categorizar melhor ao longo do tempo

---

### 2.4 Importação de Extratos (Upload Manual)

Para quem prefere não conectar o banco diretamente:

- Upload de extrato em PDF (bancos tradicionais) com leitura automática por IA
- Importação via OFX/CSV (padrão bancário)
- Leitura de QR Code de NF-e para registrar compras no ato da compra

---

### 2.5 Open Finance — Sincronização Automática com Bancos

O Open Finance (regulamentado pelo Banco Central do Brasil) permite que o WMM acesse, com consentimento do usuário, as transações diretamente das instituições financeiras. Isso elimina o registro manual para a grande maioria dos gastos.

**Como funciona o fluxo:**
1. O usuário acessa o WMM e escolhe "Conectar meu banco"
2. É redirecionado para o aplicativo/internet banking do seu banco para dar consentimento
3. O banco devolve um token de acesso ao WMM
4. O WMM passa a puxar as transações automaticamente a cada hora (ou em tempo real, se o banco suportar webhooks)
5. As transações chegam já categorizadas pela IA e ficam disponíveis no dashboard e no WhatsApp

**O que pode ser sincronizado via Open Finance:**
- Transações de conta corrente e conta poupança
- Faturas e transações de cartão de crédito (parcelamentos incluídos)
- Saldo atualizado de cada conta
- Investimentos (renda fixa, fundos, ações — fase 4 do Open Finance)
- Operações de crédito ativas (empréstimos, financiamentos)

**Bancos e instituições participantes (já obrigados pelo Bacen):**
- Itaú, Bradesco, Banco do Brasil, Caixa, Santander, Nubank, Inter, C6 Bank, XP, BTG e mais de 800 instituições participantes

**Diferenciais na implementação do WMM:**
- **Deduplicação inteligente:** Evita lançamentos duplicados quando o usuário registrou algo manualmente que depois chegou via Open Finance — o sistema faz o match pelo valor e data e pergunta se é o mesmo
- **Enriquecimento de dados:** O Open Finance retorna o nome do estabelecimento no padrão da rede adquirente (ex: "LANCHONETE DO SEU ZE 00123456"). A IA do WMM enriquece esse dado para um nome legível e já categoriza (ex: "Alimentação — Lanchonete do Seu Zé")
- **Notificação em tempo real no WhatsApp:** Quando uma nova transação chega via Open Finance, o WMM pode notificar o usuário no WhatsApp ("Detectei uma nova transação: R$ 89,90 no iFood — categorizado como Delivery. Correto?")
- **Consentimento granular:** O usuário escolhe quais contas e quais tipos de dados quer compartilhar — não é tudo ou nada
- **Renovação automática de consentimento:** O consentimento do Open Finance expira em até 12 meses. O WMM avisa o usuário com antecedência e facilita a renovação via WhatsApp

**Middlewares e agregadores disponíveis para implementação:**
- **Pluggy** — agregador brasileiro especializado em Open Finance, com SDK e normalização dos dados entre bancos
- **Belvo** — cobertura Brasil + LATAM, útil para expansão regional futura
- **API direta do Bacen** — mais complexo, mas sem intermediário e sem custo por transação

**Fluxo de consent e segurança:**
```
Usuário → WMM → Pluggy/Belvo → Banco (OAuth2/FAPI) → Token → Pluggy → WMM
```
- O WMM nunca armazena credenciais bancárias do usuário
- Apenas tokens de acesso com escopo limitado (leitura de transações)
- Revogação de acesso disponível a qualquer momento pelo usuário ou pelo próprio banco
- Todos os dados em trânsito criptografados (TLS 1.3)
- Dados em repouso criptografados com chaves por tenant (AES-256)

---

### 2.6 Controle de Metas e Projetos Financeiros

Vai além do controle mês a mês:

- **Metas de curto/médio/longo prazo:** Viagem, carro, reserva de emergência, imóvel
- **Simulador de tempo para atingir a meta:** "Se poupar R$ 500/mês, você atinge sua meta em 14 meses"
- **Cofrinhos virtuais:** Separar parte da renda para objetivos específicos sem conta bancária separada
- **Controle de dívidas:** Visualização de quanto resta pagar, juros acumulados, data estimada de quitação
- **Estratégia de pagamento de dívidas:** Sugestão de método bola de neve ou avalanche conforme o perfil

---

### 2.7 Perfis Compartilhados (Finanças em Casal ou Família)

Diferencial social ausente na maioria dos apps gratuitos:

- Conta compartilhada entre dois ou mais usuários
- Cada membro registra pelo próprio WhatsApp ou app
- Visão consolidada das finanças da família
- Divisão de responsabilidades por categoria (quem paga o quê)
- Notificação quando o parceiro registra um gasto acima do combinado
- Histórico separado por pessoa + histórico consolidado

---

### 2.8 Dashboard Web/App Moderno

Interface complementar ao WhatsApp para visualização e análise:

- Dashboard com cards: saldo atual, gasto do mês, meta de poupança
- Linha do tempo dos lançamentos com filtros rápidos
- Gráficos interativos: linha de evolução, pizza de categorias, barras de orçamento vs. realizado
- Calendário financeiro: visualizar gastos por dia
- Exportação para Excel/PDF para quem ainda quer planilha
- Modo escuro / acessibilidade

---

## 3. Melhorias que Tornam o WMM Único e Atrativo ao Público Geral

Esta seção reúne funcionalidades pensadas especificamente para o brasileiro médio — um público que convive com ansiedade financeira (76% relatam estresse com dinheiro), alto endividamento (77% dos lares endividados segundo CNC) e baixa literacia financeira. O diferencial do WMM não será apenas técnico, mas **emocional e prático**: um app que acolhe, educa e devolve dinheiro ao bolso do usuário.

### 3.1 WMM Coach — Companheiro Financeiro com IA

Mais do que uma ferramenta, o WMM é um companheiro. O agente de IA no WhatsApp tem uma persona amigável, empática e brasileira. Não julga, não sermoneia, não envergonha.

- **Disponível 24/7** para tirar dúvidas sobre finanças, juros, investimentos, dívidas, impostos
- **Tom empático e não-paternalista:** em vez de "você gastou demais", pergunta "percebi um aumento em delivery esse mês. Isso está alinhado com o que você quer?"
- **Linguagem adaptada ao perfil do usuário:** simples para iniciantes, técnica para avançados
- **Celebra pequenos progressos:** "primeira semana no azul!", "você já economizou R$500 esse mês"
- **Explica conceitos financeiros sob demanda:** "o que é CDI?", "vale a pena antecipar o 13º?"
- **Proatividade com bom senso:** envia conselho antes do pagamento, no fim do mês, próximo ao IPVA/IPTU, antes de datas historicamente caras (Natal, volta às aulas)
- **Nunca faz spam:** se o usuário diz "quieto por 3 dias", respeita

---

### 3.2 Economia Real Automática — O App que Paga Sua Mensalidade

Funcionalidades que garantem que o WMM se paga no primeiro mês de uso. Cada uma delas gera economia real, mensurável e imediata.

**Caçador de Assinaturas Esquecidas**
- Identifica cobranças recorrentes automaticamente (streaming, apps, academias, nuvem, revistas, jornais)
- Alerta sobre assinaturas que não são usadas há X semanas
- Tutorial passo-a-passo para cancelar cada serviço (muitas empresas dificultam propositalmente)
- Brasileiro médio tem R$100-200/mês em assinaturas esquecidas — só isso já paga o WMM Plus

**Negociador Virtual de Dívidas e Contas Fixas**
- IA gera scripts personalizados de negociação
- Sugere canal ideal (telefone, chat, Reclame Aqui, app do Serasa, ouvidoria)
- Calendário de oportunidades (Feirão Limpa Nome, Serasa Limpa Nome, Renegocia Brasil)
- Para contas fixas (internet, celular, plano de saúde), sugere portabilidade e abordagem de negociação
- Mostra quanto o usuário já economizou em renegociações feitas via WMM

**Radar de Cobranças Abusivas e Aumentos Silenciosos**
- Detecta quando um fornecedor aumenta preço sem aviso formal
- Alerta sobre cobranças duplicadas ou em valores incomuns
- Identifica possíveis fraudes em cartão (transação suspeita vs. padrão histórico)
- Modelos prontos de e-mail/ouvidoria para contestação

**Otimizador de Cashback e Benefícios**
- No momento da compra (via WhatsApp), sugere qual cartão usar para maximizar cashback/pontos
- Consolida saldo de cashback de diferentes programas (Livelo, Esfera, Nubank Rewards, Meu Santander, Inter Loop)
- Alerta antes de pontos/milhas expirarem

---

### 3.3 WMM Wrapped e Gamificação Significativa

**WMM Wrapped — Retrospectiva Anual**
- No estilo Spotify Wrapped, enviado em janeiro de cada ano
- Stories/vídeos personalizados: categoria que mais cresceu, total economizado, maior conquista, dia mais caro, dia mais econômico, "seu perfil gastador" (com bom humor)
- Formato compartilhável no Instagram, TikTok, WhatsApp — sem valores absolutos, apenas categorias e conquistas
- **Motor de marketing orgânico:** usuários compartilham espontaneamente em janeiro → pico anual de downloads
- Comparação apenas com o "você" do ano anterior — nunca com outros usuários

**Conquistas com Significado Real (não infantis)**
- "Primeira reserva de emergência de 3 meses"
- "90 dias sem atraso de conta"
- "Dívida do cartão quitada"
- "Primeiro mês com superávit"
- "100 registros consecutivos"

**Streaks Gentis**
- Dias seguidos registrando lançamentos
- Quebrar o streak é perdoado — "tudo bem, recomece quando puder" em vez de "você falhou"
- Evita a ansiedade de apps de fitness que punem qualquer interrupção

---

### 3.4 Calendário Financeiro Preditivo e Simulador "E Se...?"

**Calendário Financeiro Preditivo**
- Visão de calendário com todas as despesas futuras já lançadas (contas fixas, parcelas, recorrentes)
- Semáforo por dia: 🟢 verde (sobra folgada), 🟡 amarelo (atenção), 🔴 vermelho (risco de saldo negativo)
- Projeção de saldo dia a dia até o fim do mês
- Alerta com antecedência sobre dias críticos — antes do problema acontecer, não depois
- Sugestão automática: "para chegar tranquilo ao dia 30, reduza R$200 em lazer até lá"

**Simulador "E Se...?"**
- Cenários tangíveis que transformam decisões abstratas em números concretos:
  - "E se eu parar de pedir delivery por 3 meses?"
  - "E se eu mudar para um apartamento R$400 mais barato?"
  - "E se eu investir R$300/mês em CDB?"
  - "E se eu trocar o carro por transporte público?"
- Mostra impacto em 1 mês, 1 ano, 5 anos e 10 anos
- Gráfico visual do patrimônio nos dois cenários

**Life Goals Timeline**
- Linha do tempo da vida com eventos: casar, ter filho, comprar carro, comprar casa, aposentar
- Custo estimado de cada evento com base em dados reais do Brasil (casamento médio ~R$50k, bebê primeiro ano ~R$25k, etc.)
- Quanto precisa poupar por mês para cada meta
- Simulador "e se eu adiar isso em 2 anos?" mostra impacto financeiro

---

### 3.5 Micro-investimentos Automáticos (Poupar Sem Sentir)

**Arredondamento de Compras**
- A cada compra (via Open Finance), arredonda para cima e move a diferença para um cofrinho virtual
- Exemplo: compra de R$17,30 → arredonda para R$18,00 → R$0,70 vai para poupança
- Limite mensal configurável para não descontrolar o orçamento
- Ao fim do mês, o total acumulado é transferido automaticamente para aplicação rendendo

**Transferência Automática de Sobra**
- Detecta sobra ao fim do mês e oferece transferir para conta remunerada
- Integração com fintechs parceiras (Nubank RDB, Inter, PicPay Cofrinhos, Neon Investe)
- Usuário autoriza uma vez, WMM automatiza dali em diante

**Desafios da Semana**
- Desafios opcionais: "gastar R$0 em delivery por 7 dias" → o valor típico semanal vai direto para poupança
- Pequenos, atingíveis, geram sensação de conquista
- Acompanhamento via WhatsApp com incentivo diário

---

### 3.6 Vida Financeira Coletiva

**Split de Despesas com Amigos e Família**
- Criar grupos: viagem, república, rolê do fim de semana, casa dos pais
- Registro via WhatsApp: "paguei R$200 no jantar, divide com Pedro e Ana"
- Cálculo automático de quem deve quanto
- Lembretes gentis de pagamento via WhatsApp para os devedores (sem constrangimento)
- **Elimina a necessidade de usar Splitwise + WMM separados**

**Mesada Digital e Educação Financeira Infantil**
- Perfis para filhos com interface simplificada por faixa etária (6-10, 11-14, 15-17 anos)
- Mesada lançada automaticamente no dia combinado
- Metas da criança: brinquedo, jogo, viagem com amigos
- Relatórios visuais (gráficos simples, emojis) para a criança acompanhar
- Lições curtas de educação financeira adequadas à idade
- Pais acompanham e podem liberar "bônus" por tarefas/boas notas

**Modo Família Expandido** (evolução do 2.7)
- Perfil compartilhado entre cônjuges + filhos
- Orçamentos por membro
- Gastos "da casa" vs. gastos pessoais claramente separados
- Relatório familiar mensal consolidado

---

### 3.7 Modo MEI e Autônomo

Mercado enorme e historicamente mal atendido por apps de finanças: 15+ milhões de MEIs e 24+ milhões de trabalhadores autônomos no Brasil.

- Dois perfis em uma conta: **Pessoal** e **Profissional**
- Marcador rápido via WhatsApp: "gasto da empresa" ou "gasto pessoal"
- Categorização automática de despesas dedutíveis para IRPF/DASN-SIMEI
- Relatório anual pronto para o contador (PDF + CSV)
- Integração com emissão de NF-e (via parceiros)
- Controle do limite de faturamento do MEI (alerta ao se aproximar do teto anual de R$81k)
- Reserva automática para DAS mensal
- Cálculo de pró-labore recomendado
- Projeção de imposto devido vs. pago

---

### 3.8 Assistente Fiscal Brasileiro

Específico para as obrigações do brasileiro comum (público majoritário):

- **Lembretes de impostos:** IPVA, IPTU, licenciamento, DPVAT, IR
- **Captura de recibos dedutíveis:** saúde, educação, previdência privada são salvos automaticamente ao longo do ano
- **Preparação da declaração do IR:** dados organizados, prontos para copiar para o programa da Receita
- **Projeção de restituição ou imposto a pagar:** atualizada mês a mês
- **13º e férias:** simulador de como usar de forma estratégica (pagar dívidas caras, formar reserva, investir)
- **FGTS:** acompanhamento do saldo, saque-aniversário vs. saque-rescisão
- **INSS:** monitoramento de contribuições e simulação de aposentadoria (especialmente útil para autônomos)

---

### 3.9 Modo Apoio em Crises Financeiras

**Diferencial emocional único — nenhum app atual trata o tema com empatia.**

- **Ativação discreta pelo usuário:** "perdi o emprego", "fiquei doente", "me separei", "imprevisto grande"
- **Replanejamento automático de orçamento:** prioriza moradia, alimentação, saúde, transporte essencial
- **Lista de gastos supérfluos cortáveis** com impacto financeiro calculado
- **Tom de apoio, não de cobrança:** "vamos passar por isso juntos, um mês de cada vez"
- **Conexão com recursos reais:** informações sobre seguro-desemprego, BPC, auxílios municipais, ONGs de apoio financeiro, terapia financeira acessível
- **Modo silêncio temporário:** desliga relatórios negativos, alertas de orçamento, comparações
- **Plano de retomada:** quando a crise passa, ajuda a reconstruir passo a passo, celebrando cada progresso

---

### 3.10 Benchmarks Anônimos Sem Comparação Tóxica

- "Pessoas do seu perfil (renda similar, região, idade, composição familiar) gastam em média R$X em alimentação"
- Dados 100% anônimos e agregados (nunca expõe nenhum usuário)
- Contextualiza seus gastos sem expor ninguém
- Ajuda a identificar quando um gasto está muito fora do padrão razoável
- **Nunca há ranking nem comparação explícita entre usuários**
- Modo "não quero comparar" — desligável com um clique

---

### 3.11 Acessibilidade Universal

Para atingir de verdade o público geral — não apenas nativos digitais urbanos:

- **Modo Simples (padrão):** fontes grandes, alto contraste, linguagem direta
- **Modo Avançado (opcional):** mais dados, gráficos, controles avançados
- **Leitura por voz (TTS)** de relatórios, para pessoas com baixa visão ou que preferem ouvir
- **Comandos de voz** pelo WhatsApp (mensagem de áudio)
- **Modo Idoso:** interface super simplificada, letras enormes, apenas 3 botões principais
- **Linguagem sem jargão:** "juros" em vez de "CDI", explicações em contexto quando aparecer termo técnico
- **Suporte a pessoas com baixa escolaridade financeira:** nunca assume conhecimento prévio

---

## 4. Posicionamento de Marca

A diferenciação do WMM não é apenas técnica — é de tom, empatia e branding. O mercado de apps financeiros é dominado por produtos frios, corporativos ou excessivamente "finfluencer". Há espaço claro para uma marca calorosa, brasileira e sem julgamento.

**Identidade verbal:**
- Amigável, brasileira, empática, bem-humorada, não-julgadora
- Fala como um amigo que entende de finanças, não como um banco
- Celebra pequenos progressos, nunca envergonha

**Slogans possíveis:**
- "Onde está o meu dinheiro? Agora você sabe."
- "O app que não julga seu extrato."
- "Finanças que cabem no WhatsApp."
- "O fim da planilha. O começo da tranquilidade."

**Anti-valores (o que o WMM nunca será):**
- Não é uma planilha fria digitalizada
- Não culpa o usuário por gastos passados
- Não vende dados para terceiros (nunca)
- Não empurra produtos financeiros como os bancos fazem (cartão, empréstimo, seguro)
- Não usa dark patterns para reter usuários (cancelamento em 1 clique via WhatsApp)

**Canais de crescimento orgânico:**
- **WMM Wrapped** como motor viral (janeiro = pico anual de aquisição)
- **Parcerias com educadores financeiros** (Nath Finanças, Me Poupe, EconoMirna, Primo Rico, Thiago Nigro)
- **Comunidade no WhatsApp/Telegram** com dicas diárias curtas
- **Conteúdo educacional de 30-60s** no TikTok e Instagram Reels
- **Cases reais de usuários** (com permissão) — transformação financeira é conteúdo com alto engajamento
- **Programa de indicação:** usuário indica um amigo, ganha desconto ou mês grátis

**Design visual:**
- Paleta calorosa (verde água + laranja suave), não o azul-frio corporativo
- Ilustrações humanas, não ícones genéricos de dinheiro
- Mascote amigável opcional — um porquinho/cofre com personalidade brasileira
- Interface que parece uma conversa, não uma planilha

---

## 5. Proposta de Valor Central

| Problema | Solução WMM |
|---|---|
| Atrito no registro de gastos | WhatsApp + linguagem natural + foto de nota |
| Esquecer de registrar | Agente proativo que pode ser acionado a qualquer momento |
| Não saber como estão os gastos | Relatórios automáticos toda semana |
| Dados sem contexto | IA que detecta padrões e gera insights |
| Planilha manual trabalhosa | Importação automática de extratos |
| Precisar lançar tudo manualmente | Open Finance puxa transações direto do banco |
| Finanças em casal confusas | Perfil compartilhado com visão consolidada |
| Culpa e vergonha por gastos | Tom empático, celebra progresso, zero julgamento |
| Assinaturas esquecidas drenando dinheiro | Caçador automático + tutorial de cancelamento |
| Dívidas sem saber por onde começar | Negociador virtual com scripts personalizados |
| Decisões financeiras abstratas | Simulador "E Se?" com impacto em 1, 5, 10 anos |
| Sentir-se sozinho em crise financeira | Modo Apoio com replanejamento e recursos reais |
| Confusão com impostos e declarações | Assistente Fiscal Brasileiro (IR, IPVA, MEI) |
| Split de contas com amigos em apps separados | Splitwise integrado via WhatsApp |
| Filhos sem educação financeira | Mesada digital e lições por idade |

---

## 6. Monetização

- **Freemium:** Funcionalidades básicas grátis (registro manual, resumo mensal simples, caçador de assinaturas limitado)
- **WMM Plus (assinatura mensal ~R$ 19,90):**
  - Integração WhatsApp ilimitada
  - Relatórios semanais automáticos
  - Análise de IA e insights avançados
  - Importação de extratos PDF/OFX
  - Open Finance (conexão ilimitada com bancos)
  - Caçador de assinaturas completo e Negociador virtual
  - Calendário preditivo e Simulador "E Se?"
  - Modo Apoio em Crises
  - Metas e projetos financeiros
- **WMM Família (~R$ 29,90/mês):** Até 5 membros na mesma conta + Mesada Digital para filhos + Split integrado
- **WMM Pro MEI (~R$ 39,90/mês):** Tudo do Plus + Modo MEI + Assistente Fiscal completo + Relatórios para contador + NF-e
- **Programa de indicação:** 1 mês grátis a cada indicado que vira pagante (cap de 12 meses grátis)
- **Anual com desconto:** 12 meses pagos pelo preço de 10

---

## 7. Stack Tecnológica Sugerida

- **Backend:** Node.js (NestJS) ou Python (FastAPI)
- **Banco de dados:** PostgreSQL (dados financeiros) + Redis (sessões/cache)
- **IA / NLP:** Claude API (Anthropic) para interpretação das mensagens, geração de insights e tom empático do Coach
- **WhatsApp:** Twilio API for WhatsApp ou Evolution API (self-hosted)
- **OCR de notas fiscais:** Google Vision API ou AWS Textract
- **Frontend:** Next.js + Tailwind CSS
- **Mobile (v2.0):** React Native + Expo
- **Agendamento de relatórios:** Cron jobs no backend (relatórios semanais, WMM Wrapped anual)
- **Autenticação:** Auth0 ou Supabase Auth
- **Open Finance:** Pluggy (agregador principal, SDK BR) ou Belvo (LATAM) — ambos abstraem o protocolo FAPI/OAuth2 do Bacen e normalizam os dados entre instituições
- **Investimentos automáticos:** parceria com Nubank (RDB), Inter, PicPay, Neon via API
- **Push notifications:** Firebase Cloud Messaging
- **Analytics de produto:** PostHog (self-hosted, privacy-first) — coerente com o posicionamento de marca
- **Geração de WMM Wrapped:** Remotion (vídeos programáticos em React) ou FFmpeg
- **Feature flags e A/B testing:** GrowthBook ou Unleash

---

## 8. Roadmap Sugerido

### MVP (2–3 meses)
- [ ] Cadastro e autenticação de usuários
- [ ] Registro manual de lançamentos (web)
- [ ] Categorias e contas configuráveis
- [ ] Integração básica com WhatsApp (registro por mensagem de texto)
- [ ] Dashboard simples com saldo e extrato
- [ ] Relatório mensal básico via WhatsApp
- [ ] Caçador de assinaturas (versão básica, sem tutoriais)

### v1.0 (4–6 meses)
- [ ] Análise semanal automática
- [ ] OCR de notas fiscais pelo WhatsApp
- [ ] Orçamento por categoria com alertas
- [ ] Importação de extrato PDF/OFX
- [ ] Score de saúde financeira
- [ ] Registro por áudio (mensagem de voz)
- [ ] Open Finance fase 1: conexão com os 5 maiores bancos via Pluggy
- [ ] Categorização automática de transações vindas do Open Finance
- [ ] Deduplicação de lançamentos manuais vs. Open Finance
- [ ] Notificação no WhatsApp ao receber nova transação via Open Finance
- [ ] **Coach WMM** (persona empática + proatividade em momentos-chave)
- [ ] **Calendário Financeiro Preditivo** com semáforo por dia
- [ ] **Simulador "E Se...?"** com cenários básicos

### v2.0 (6–12 meses)
- [ ] Metas e projetos financeiros
- [ ] Perfil compartilhado (casal/família)
- [ ] Open Finance fase 2: cobertura de 800+ instituições + dados de investimentos
- [ ] Open Finance fase 3: dados de crédito e financiamentos
- [ ] Detecção de padrões de consumo por IA
- [ ] App mobile (React Native)
- [ ] **WMM Wrapped** (primeira edição em janeiro)
- [ ] **Negociador Virtual de Dívidas e Contas**
- [ ] **Radar de Cobranças Abusivas**
- [ ] **Otimizador de Cashback**
- [ ] **Micro-investimentos por arredondamento** (parceria com 1-2 fintechs)
- [ ] **Split de despesas com amigos**
- [ ] **Modo Apoio em Crises**
- [ ] **Benchmarks anônimos**

### v3.0 (12–18 meses)
- [ ] **Modo MEI e Autônomo completo**
- [ ] **Assistente Fiscal Brasileiro** (IR, IPVA, FGTS, INSS)
- [ ] **Mesada Digital e educação financeira infantil**
- [ ] **Life Goals Timeline**
- [ ] Modo Idoso (acessibilidade avançada)
- [ ] Expansão para Telegram como canal alternativo
- [ ] WMM API pública (para integrações de terceiros)

---

## 9. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Privacidade dos dados financeiros | Criptografia end-to-end, compliance LGPD, sem venda de dados (posicionamento de marca) |
| Dependência da API do WhatsApp | Suporte a Telegram como canal alternativo na v3.0 |
| Custo de API de IA em escala | Cache de respostas comuns, modelo menor (Haiku) para classificação simples, Sonnet/Opus só para análises profundas |
| Abandono do usuário após alguns dias | Relatórios proativos, gamificação gentil (streak), Coach empático, WMM Wrapped como reengajamento anual |
| Erro de categorização pela IA | Fluxo de correção fácil no próprio WhatsApp ("corrigir") + aprendizado contínuo |
| Consentimento Open Finance expirando silenciosamente | Aviso proativo no WhatsApp 15 dias antes + renovação com 1 clique |
| Custo por transação nos agregadores (Pluggy/Belvo) | Caching das transações + batch diário em vez de polling frequente |
| Usuário com banco não participante do Open Finance | Fallback para importação de PDF/OFX sempre disponível |
| Tom errado do Coach (muito infantil, muito sério, muito paternalista) | Pesquisa qualitativa com usuários reais + prompts calibrados + feedback loop "me respondeu bem? 👍👎" |
| Dependência de parceiros fintech para micro-investimentos | Iniciar com 2-3 parceiros e manter modo manual (apenas sugerir transferência) sempre disponível |
| Responsabilidade legal em conselhos financeiros do Coach | Disclaimer claro: "informação, não recomendação"; evitar recomendar produtos específicos; foco em educação |
| WMM Wrapped vazar dados sensíveis | Compartilháveis mostram apenas categorias e conquistas, nunca valores absolutos nem dados identificáveis |
| Modo Crise sendo usado de forma inadequada | Ativação com confirmação + contato com suporte humano opcional em casos graves |
