# Convergência Iterativa v3.7

Metodologia de desenvolvimento rigoroso em 8 fases (0-7) com meta-iteração e preservação de escopo. Não avançar de fase sem atingir todos os exit criteria.

---

## REGRAS GLOBAIS

**R1 — Consulte antes de codificar.** Se usuário pediu código/feature: avalie gatilhos → se ativou, comece Phase 0. Nunca pule para implementação.

**R2 — Menus clicáveis.** Toda decisão do usuário usa `AskUserQuestion`. Agrupar até 4 perguntas por chamada. `multiSelect: true` para escolhas não-exclusivas. Opção recomendada primeiro com "(Recomendado)". "Other" é automático. Nunca listar opções A/B/C em texto.

**R3 — Um artefato por resposta.** Máximo 1 arquivo grande por resposta. Indicar progresso "Arquivo X/N". Exceção: arquivos <30 LOC podem ser agrupados se total <50% do limite.

**R4 — Pasta `specs/`.** Conhecimento de domínio e referências depositados ANTES de codificar. Estrutura:
```
specs/
├── references/    # Papers, artigos, normas
├── domain/        # Glossário, regras de negócio
├── technical/     # Specs de algoritmos, APIs, fórmulas
├── examples/      # Código de referência
├── design/        # Wireframes, mockups
├── models/        # Diagramas, fluxos, schemas
├── datasets/      # Ground truth, amostras de teste
├── validation/    # Critérios de aceitação, benchmarks
└── competitors/   # Análise de soluções existentes
```

Quando popular: Phase 0 → refs, domain, competitors | Phase 1 → technical, models, examples | Phase 5 → consultar examples, datasets | Phase 6 → usar datasets/validation | Phase 7 → registrar lições. Nunca implementar algoritmos sem referência em specs/.

---

## PRINCÍPIO FUNDAMENTAL

**Invariância Generativa:** A metodologia NÃO melhora o modelo — ela melhora o PROCESSO. O mesmo LLM opera com ou sem metodologia. A diferença é a verificação externa em cada gate.

**Critério de adoção (assimetria de risco):** Custo de aplicar em projeto simples ≈ 20 min. Custo de NÃO aplicar em projeto complexo ≈ horas/dias de retrabalho. Aplicar quando C_overhead < P(erro) × C_erro.

---

## GATILHOS DE ATIVAÇÃO

Antes de propor implementação, avaliar em sequência:

| # | Condição | Resultado |
|---|----------|-----------|
| 1 | Não envolve criar/modificar código | Responder diretamente |
| 2 | Requisito tem palavras vagas ("fancy", "escalável") | **USAR METODOLOGIA** |
| 3 | Envolve decisão arquitetural | **USAR METODOLOGIA** |
| 4 | Usuário mencionou metodologia | **OBRIGATÓRIO** |
| 5 | Sinais de complexidade oculta (abaixo) | **USAR METODOLOGIA** |

**Sinais de complexidade (basta 1):** múltiplos domínios/contextos, integrações externas, pedido não cabe em 1 frase, IA não visualiza solução completa, incerteza sobre complexidade. Regra de ouro: se não consegue afirmar que é simples, não é simples.

**Ao ativar**, anunciar: gatilhos detectados, sinais observados, fases 0-7 resumidas, declarar que não codificará até passar por Phases 0-4.

---

## VISÃO GERAL DAS FASES

```
Phase 0 — Problem Discovery (loop iterativo, score ≥90/100)
  ↓
Phase 1 — Architecture (módulos + interfaces)
  ↓
┌ Phase 2 — Adversarial Critique ┐
│ Phase 3 — Simplification       │ loop até convergência
└────────────────────────────────┘
  ↓
Phase 4 — Convergence Gate
  ↓
Phase 5 — Code Implementation (1 arquivo/resposta)
  ↓
Phase 6 — Tests (100% passando + teste manual)
  ↓
Phase 7 — Post-Review (lições + meta-iteração)
```

Múltiplas iterações 2-3 são esperadas: pequenos 1-2, médios 2-3, grandes 3-5. Preferir iterar quando em dúvida.

### Tipo de verificação por gate:

| Fase | Gate | AV principal | O que verifica |
|------|------|-------------|----------------|
| 0 | G₀ | AV-humano | Entendimento do problema |
| 1 | G₁ | AV-humano | Adequação, completude |
| 2 | G₂ | AV-humano + AG (lentes) | Zero críticos; decisão p/ importantes |
| 3 | G₃ | AV-humano | Complexidade ≤ versão anterior |
| 4 | G₄ | AV-humano | Critérios de exit rigorosos |
| 5 | G₅ | AV-automático | Sintaxe, tipos, estilo |
| 6 | G₆ | AV-autom. + humano | Correção funcional + UX |
| 7 | G₇ | AV-humano | Lições + evolução do método |

---

## Phase 0 — Problem Discovery Loop

**Entry:** Metodologia ativada.
**Verificação:** AV-humano (operador valida síntese e teach-back).

### Loop: COLETA → SÍNTESE → VALIDAÇÃO → AVALIAÇÃO

**Passo 0:** Ler TODO conteúdo de `specs/` antes de perguntar. Construir sobre o que já existe.

### COLETA — Perguntas obrigatórias (via R2):

| Categoria | Perguntas-chave |
|-----------|----------------|
| A. Problema & Motivação | Por quê precisa? O que acontece sem isso? Quem são os usuários? |
| B. Casos de Uso | 3-5 cenários principais (quem/o quê/por quê). Casos extremos? |
| C. Vocabulário | Termos-chave e definições. Sinônimos a evitar? |
| D. Constraints | Limitações técnicas, de recursos. Premissas assumidas? |
| E. Fora de Escopo (YAGNI) | O que NÃO fazer, com justificativa custo/benefício |
| F. Documentação | Specs, RFCs, código legado, issues. Conteúdo em `specs/`? |
| G. Termos Vagos | Clarificar: "fancy"→concreto, "escalável"→nº usuários, "rápido"→ms |
| H. Viabilidade Tech | Plataforma-alvo VERIFICADA (não assumida). Em porte: paridade de capacidades confirmada |

**F.2 — Pesquisa técnica E científica (obrigatória para domínios especializados):** Se projeto envolve DSP, ML, bioinformática, engenharia, ciências etc., pesquisar ANTES da arquitetura:
- **Científica:** Papers de referência com peer review, fundamentos teóricos do domínio, modelos matemáticos/físicos aplicáveis, constantes e parâmetros validados pela literatura
- **Técnica:** Algoritmos candidatos com trade-offs, implementações de referência, benchmarks publicados, ferramentas e libs maduras
- **Competitiva:** Soluções concorrentes, estado da arte, gaps conhecidos
- Depositar TUDO em specs/ (references, technical, competitors)
- Cada parâmetro numérico DEVE ter fonte citada (paper, norma, especificação)
- Regra: "Não implementar algoritmo sem referência bibliográfica verificável"

**F.3 — Pesquisa web:** Se specs/ tem lacunas críticas, pedir permissão ao usuário (via R2) para pesquisar e depositar. Opções: pesquisar e depositar / pesquisar e apresentar / não pesquisar. Citar fonte/URL em todo material depositado.

**H — Viabilidade Tech (VERIFICAÇÃO OBRIGATÓRIA):**
**LIÇÃO APRENDIDA:** Viabilidade tech da plataforma-alvo deve ser VERIFICADA, não assumida. Em projetos de porte/migração, confirmar ANTES de avançar:
- A plataforma destino suporta os mecanismos fundamentais? (APIs, protocolos, extensibilidade)
- Que capacidades são ESSENCIAIS vs. DESEJÁVEIS? Alguma essencial ausente → BLOCKER.
Não cortar escopo para caber na tecnologia. Comparar alternativas com tabela (requisitos × techs, LOC, libs, plataforma). Perguntar ao usuário via R2.

### SÍNTESE (Teach-Back) — Template:

```markdown
# Meu Entendimento (Iteração N)
## Resumo em 3 Frases (problema, não solução)
## Casos de Uso Principais (ator/objetivo/fluxo/exemplo concreto)
## Vocabulário (termo | entendimento | exemplo)
## Fora de Escopo (item | razão)
## Critérios de Sucesso (mensuráveis e verificáveis)
## Premissas & Constraints
## Ambiguidades Restantes
## Perguntas para Próxima Iteração
```

### VALIDAÇÃO — via R2: correto/quase/incompleto/errado
**CUIDADO AP1:** O humano avalia a SÍNTESE escrita — não perguntar à IA se está certo.

### AVALIAÇÃO DE CONVERGÊNCIA (0-100):

| Critério | Peso |
|----------|------|
| Clareza do Problema | 10 |
| Casos de Uso Completos (top 3-5 com atores/objetivos/fluxos) | 15 |
| Vocabulário Definido | 10 |
| Ambiguidades Resolvidas | 15 |
| Fora de Escopo Explícito | 10 |
| Critérios de Sucesso mensuráveis | 10 |
| Premissas Validadas | 10 |
| Pesquisa (técnica+científica) + specs/ populado | 5 |
| Usuário Confirmou | 10 |
| IA Confiante (pode responder "por quê?" para tudo) | 5 |

≥90 → Phase 1 | 70-89 → mais 1 iteração | <70 → múltiplas iterações.

### Exit Criteria Phase 0:
- Score ≥90/100 + usuário confirmou
- Ambiguidades = 0 (ou aceitas)
- Casos de uso completos, vocabulário acordado, fora de escopo claro
- Viabilidade tech: se inicial não atende 100%, alternativas exploradas
- Viabilidade de implementação: componentes algorítmicos avaliados Tier 1/2/3. Se Tier 3 em domínio complexo → PoC antes de Phase 1
- specs/ populado com referências técnicas E científicas, parâmetros, critérios de validação
- Se domínio especializado: pesquisa técnica E científica completa (F.2)

---

## Phase 1 — Architecture

**Entry:** Phase 0 score ≥90/100.
**Verificação:** AV-humano (operador valida adequação e completude).

### Passo 0: Consultar e popular specs/
Ler specs/technical, examples, models, design. Se falta material técnico/científico crítico, pesquisar e depositar ANTES de definir módulos.

### As 4 questões que a arquitetura DEVE responder:
1. **Decomposição.** Quais são os módulos? Quais suas responsabilidades? Onde estão os limites?
2. **Interfaces.** Como os módulos se comunicam? Quais são os contratos?
3. **Premissas.** O que o sistema assume como verdade? Premissas implícitas são a fonte mais comum de falhas.
4. **Escopo negativo.** O que o sistema deliberadamente NÃO faz?

### Princípio de granularização (E = I₀/C):
Cada módulo deve ser compreensível pela IA em uma ÚNICA interação. Se não cabe no contexto com suas dependências, precisa ser decomposto. Interfaces funcionam como "resumos executáveis".

### Passo 1: Coleta de Padrões e Princípios (via R2)

Agrupar em 2 chamadas AskUserQuestion:

**Chamada 1 (até 4 perguntas):**
1. **Padrão Arquitetural** (single): Clean Architecture / Layered / Hexagonal / Modular Monolith
2. **Princípios Transversais** (multi): SOLID / KISS+YAGNI / DDD / Composition over Inheritance. Adicionais via Other: DRY, LoD, CoC, Separation of Concerns, Fail Fast
3. **Concorrência** (single): Single-threaded / Actor Model / Message Queue / N/A

**Chamada 2 (até 4 perguntas):**
4. **GoF relevantes** (multi): selecionar os mais pertinentes ao projeto + opção "Nenhum específico"
5. **Padrões Fowler** — Domínio (single): Domain Model / Transaction Script / Table Module
6. **Padrões Fowler** — Dados (single): Repository+Data Mapper / Active Record / Table Data Gateway. Outros: Unit of Work, Identity Map, Lazy Load, Service Layer, DTO

Apresentar resumo das escolhas em tabela, confirmar via R2.

### Validação Tecnológica
Se há mais de uma opção tech: tabela comparativa (requisitos × techs, LOC, dependências, consumo contexto LLM). Premissas verificadas com evidência (specs/technical), não assumidas. Se tech forçar redução de escopo → tech errada. Preferir techs que minimizem artefatos.

### Escopo Progressivo
Quando maturidade/risco é desigual entre requisitos: apresentar mapa de maturidade (req | lib madura? | LOC | risco) e oferecer via R2: escopo progressivo (v1.0 maduro, v2.0 resto) / tudo em v1.0 / outro agrupamento. Escopo progressivo ≠ corte: preserva 100%, distribui entre versões.

### Planejamento de sessões (ciclo desacoplado):
- Sessão de Design (Phases 0-4): contexto = domínio + restrições → arquitetura + interfaces
- Sessão de Código (Phase 5): contexto = arquitetura + interface do módulo → 100% dedicado
- Sessão de Testes (Phase 6): contexto = interface + contrato → sem necessidade do código interno
- Sessão de Validação: CI/CD executa testes → IA só invocada se correções

### Exit Criteria Phase 1:
- As 4 questões respondidas (Decomposição, Interfaces, Premissas, Escopo negativo)
- Padrões/princípios definidos e confirmados
- Cada módulo tem responsabilidade clara e única
- Interfaces definidas (assinaturas, tipos I/O)
- Dependências entre módulos explícitas
- Premissas listadas
- Doc de arquitetura cabe em ~2k tokens
- Tech suporta 100% do escopo, premissas tech verificadas
- Módulos aderentes aos padrões escolhidos

---

## Phase 2 — Adversarial Critique

**Propósito:** Atacar arquitetura com lentes especializadas, gerando matriz de cobertura auditável.
**Verificação:** AV-humano + AG (7 lentes como AVs operacionalmente distintos).

### Princípio da assimetria crítica-resposta:
**Phase 2 = MÚLTIPLOS agentes para ATACAR** (diversidade de lentes é valor).
**Phase 3 = agente UNIFICADO para RESPONDER** (correções integradas no todo).
**Operador humano = ARBITRAR trade-offs** (visão sistêmica).

### Lentes Universais (TODAS sempre aplicadas — custo baixo em planejamento, risco alto se omitida):

| Lente | Pergunta Central | Classe de falha exclusiva |
|-------|-----------------|--------------------------|
| Premissas | O que este design assume como verdade sem declarar? | Falhas por premissas ocultas |
| Arquitetural | Cada módulo pode ser substituído, removido ou testado isoladamente? | Acoplamento oculto, SRP |
| Implementabilidade | Consigo codificar este módulo numa única sessão com o contexto disponível? | Specs incompletos, granularização insuficiente |
| Científica | Cada valor/fórmula/algoritmo tem referência bibliográfica verificável? | Parâmetros inventados, lógica baseada em plausibilidade |
| Segurança | Como um atacante exploraria com esforço mínimo? | Superfície de ataque não analisada |
| Performance | Onde estão os gargalos? Comportamento assintótico? | Gargalos ocultos, degradação com escala |
| Regulatória | Cada requisito normativo tem rastreabilidade até um módulo? | Não-conformidade normativa |

Princípio de seleção: se remover esta lente, existe uma classe de falha que NENHUMA outra detecta? Se sim → legítima.

### Protocolo por lente:
1. Aplicar pergunta central a CADA módulo
2. Classificar achados: 🔴 Crítico (bloqueia) | 🟡 Importante (degrada) | 🟢 Sugestão
3. Achado = evidência concreta, não opinião
4. Passadas são independentes (uma lente por vez)

### Matriz de Cobertura:
Tabela módulos × lentes com severidades.

### Análise de concentração (obrigatória após a matriz):
- **Concentração por módulo:** Módulo com achados em TODAS as lentes → mal concebido → requer REDESIGN, não patch.
- **Concentração por lente:** Lente com achados em TODOS os módulos → falha SISTÊMICA.
- Documentar padrões com record_decision().

### Gate de Saída Phase 2:
- Zero 🔴 para avançar → todos endereçados em Phase 3
- Cada 🟡 requer decisão EXPLÍCITA: tratar OU aceitar risco COM JUSTIFICATIVA (record_decision)
- 🟢 podem ser postergados para v2.0

### Regra de Fronteira: Escopo vs Arquitetura

Phase 2-3 **PODE:** mudar libs/padrões/comunicação, simplificar módulos, adicionar mecanismos técnicos.

Phase 2-3 **NÃO PODE:** cortar requisitos, adicionar features, mudar público-alvo/casos de uso.

Teste: "Isso muda O QUE o sistema faz?" ou "PARA QUEM serve?" → ESCOPO → voltar Phase 0 com opções via R2.

---

## Phase 3 — Simplification

**Propósito:** Simplificar V(N) → V(N+1), eliminando complexidade.
**Verificação:** AV-humano (operador valida que complexidade diminuiu e escopo preservado).

### Princípio da assimetria (continuação de Phase 2):
Phase 2 atacou com MÚLTIPLAS lentes. Phase 3 responde com VISÃO UNIFICADA.
Correções individualmente corretas podem ser sistemicamente contraditórias.
Trade-offs resolvidos pelo OPERADOR HUMANO (S2: critério de parada é do usuário).

### Exit Criteria:
- Problemas de Phase 2 endereçados
- Arquitetura mais simples que versão anterior
- **S1:** Nenhum bug introduzido (funcionalidades mantidas)
- **S5:** Escopo de Phase 0 preservado
- Nenhuma feature nova (apenas mudanças arquiteturais)
- Se LOC aumentou >10%, justificativa documentada

**Distinção:** Adicionar Worker/cache/fallback = arquitetura (OK). Adicionar tutorial/botão/animação = feature (proibido).

### Decisão pós-ciclo 2-3 (via R2):

| Mudança estrutural | Críticos | Ação |
|---|---|---|
| <15% | 0 | → Phase 4 |
| 15-25% | 0-1 | Mais 1 iteração |
| >25% | 2+ | Múltiplas iterações |

### Checklist Anti-Scope-Creep (obrigatório antes de avançar):
- TODOS os requisitos de Phase 0 contemplados
- Nenhuma funcionalidade não solicitada adicionada
- O que o sistema FAZ não mudou (apenas COMO)
- Casos de uso de Phase 0 continuam válidos

---

## SALVAGUARDAS

**S0 — Convergência no Problema.** Nunca avançar para Phase 1 sem ≥90/100. Custo relativo: problema errado 100×, arquitetura errada 10×, bug 1×.

**S1 — Anti-Bug.** Simplificação nunca introduz bugs. Funcionalidades mantidas após cada Phase 3.

**S2 — Critério de Parada.** Critério de parada é do USUÁRIO, não da IA.

**S3 — Custo de Convergência Prematura.** Parar cedo ≈ -400% a -600% ROI.

**S4 — Verificação Explícita (AV-humano obrigatório).** O AV-humano é insubstituível em cada gate. Testes automáticos verificam propriedades formalizáveis; adequação semântica, usabilidade e correção de domínio REQUEREM julgamento humano. Aplica-se a: P0 (validar síntese), P2 (arbitrar trade-offs), P4 (confirmar convergência), P6 (teste manual + executar e verificar output).

**S5 — Preservação de Escopo.** Phase 2-3 opera DENTRO do escopo de Phase 0.
- **5.1** Escopo é do usuário. Phase 2-3 sugere, nunca decide mudança de escopo.
- **5.2** Se não foi pedido, não adicione. Se útil, documente como sugestão v2.0.
- **5.3** Detector: "Se o usuário comparar V(N) com Phase 0, diria 'não é o que pedi'?" Se sim → violou escopo.

**S6 — Não reimplemente o que já existe.** Avaliação por módulo:
- **Tier 1:** Existe lib madura? → USAR. Código novo = UI + integração + glue.
- **Tier 2:** Existe algoritmo documentado com implementação de referência? → PORTAR literalmente. Protocolo: encontrar ref → depositar em specs/examples → ler/entender → traduzir linha a linha (mesma estrutura, mesmos nomes) → testar contra mesmos inputs. Tradução fiel primeiro, otimização depois.
- **Tier 3:** Nenhum dos anteriores. Se domínio complexo (solvers, crypto, DSP, ML) → PoC isolado obrigatório (~2h max). Se PoC falhou → reconsiderar escopo. Depositar lógica em specs/technical antes de codar.

**Sinal de alarme (STOP imediato):** Se durante Phase 5-6 a IA está criando heurísticas para problemas com solução conhecida, debugando lógica complexa escrita do zero, fazendo trial-and-error em algo que deveria ser determinístico, ou gastando >2 iterações no mesmo módulo → PARAR, comunicar, buscar implementação de referência (Tier 2).

Checklist por módulo: lib madura? → se não, por quê? → algoritmo documentado? → implementação portável? → decisão (usar lib / portar / implementar do zero + justificativa).

**S7 — Disciplina de Sequência.** Após cada arquivo: marcar completed, identificar próximo, anunciar "X/N concluído, próximo: Y", iniciar imediatamente. Não iniciar discussões tangenciais (→ Phase 7). Se interrompido: consultar todo list → anunciar retomada → continuar.

---

## ANTIPADRÕES A EVITAR

| # | Antipadrão | Descrição | Antídoto |
|---|-----------|-----------|----------|
| AP1 | Teatro de validação | Perguntar à IA "esse design está bom?" — viés de concordância (RLHF) | Nunca pedir validação — pedir REFUTAÇÃO |
| AP2 | Complexidade como falsa solução | Adicionar componentes quando crítica revela fragilidade | Cada iteração deve simplificar |
| AP3 | Sessão monolítica | Design, código e testes numa conversa | Uma sessão por fase, uma fase por módulo |
| AP4 | Premissa implícita | Design funciona se condições não listadas forem verdadeiras | Lente de Premissas P2 + premissas P1 |
| AP5 | Ausência de AV-humano | Confiar só em testes automáticos | S4 + teste manual obrigatório |
| AP6 | Pular Phase 0 | Começar pela arquitetura sem entender o problema (100×) | S0: Score ≥90 |
| AP7 | Codificar sem referência | Implementar sem consultar specs/ ou literatura | S6 + R4 |
| AP8 | Perfeccionismo convergente | Ciclos infinitos buscando perfeição | <15% mudança + 0 críticos → avançar |
| AP9 | Scope creep silencioso | Adicionar funcionalidades sem aprovação | S5: escopo é do usuário |

---

## Phase 4 — Convergence Gate

**Verificação:** AV-humano (operador confirma convergência com critérios rigorosos).

Validar convergência completa:
1. Exit criteria de Phases 2-3 verificados
2. Salvaguardas S1-S5 atingidas
3. As 4 questões de P1 ainda respondidas (Decomposição, Interfaces, Premissas, Escopo negativo)
4. Análise de concentração não revelou falhas sistêmicas não resolvidas
5. specs/ populado com referências técnicas e científicas para Phase 5
6. Só avançar se TUDO OK

---

## Phase 5 — Code Implementation

**Propósito:** Implementar arquitetura final. Um arquivo por resposta (R3).
**Verificação:** AV-automático (compile, lint, type check). Sessão dedicada por módulo.

### Sessão desacoplada:
Cada módulo implementável em sessão independente. Contexto: arquitetura (~2k tokens) + interface + specs/. Se precisa de mais → granularização insuficiente (voltar P1).

Antes de cada módulo, consultar specs/technical (algoritmo, fórmulas, params), specs/examples (código ref), specs/references (paper original), specs/datasets (dados de teste). Se parâmetros numéricos sem valores em specs/ → PARAR e pesquisar. Referenciar fonte no código.

Aplicar S6 (Tier 1/2/3) e S7 (disciplina de sequência) rigorosamente.

---

## Phase 6 — Tests

**Propósito:** 100% testes passando + teste manual.
**Verificação:** AV-automático (testes) + AV-humano (teste manual exploratório).

### Testes baseados em specs/:
- specs/datasets → testar contra ground truth (se vazio, gerar dados sintéticos e depositar)
- specs/validation → cada critério ≥ 1 teste
- specs/technical → outputs dentro dos ranges documentados

**S4 — Verificação Explícita.** NUNCA assumir que testes passaram. Executar e verificar. AV-humano insubstituível para adequação semântica e UX.

### Teste Manual Exploratório (obrigatório antes de Phase 7):
1. Iniciar aplicação
2. Executar cada caso de uso de Phase 0 como usuário final
3. Testar edge cases: cliques rápidos/duplos, inputs vazios, interrupções, timeouts
4. Avaliar feedback: mensagens compreensíveis? Erros não-técnicos? Resultado acionável?
5. Documentar e corrigir problemas

Ambos (automatizados + manual) são gates obrigatórios. Nenhum substitui o outro.

---

## Phase 7 — Post-Review

**Verificação:** AV-humano (operador avalia lições e aprova mudanças).

### Atualizar specs/:
- specs/validation → resultados reais (esperado vs obtido)
- specs/technical → decisões finais, algoritmos descartados e por quê
- specs/references → referências descobertas durante correção

### Double-loop learning:
Single-loop: avaliar o PRODUTO (o software funciona?).
Double-loop: avaliar o PROCESSO (a metodologia funcionou? Onde houve atrito?).

### Auto-Aprimoramento da Metodologia:

**Passo 1 — Coleta humana (obrigatório PRIMEIRO):** Perguntar via R2 se alguma parte causou atrito ou falhou. O humano vivenciou o processo e detecta atrito que a IA não percebe.

**Passo 2 — Auto-avaliação IA (complementar):** Fase que faltou checklist, salvaguarda ausente, template inadequado, regra sem valor, padrão recorrente.

**Passo 3 — Consolidar** em tabela (fonte [humano/IA] | fase | proposta | justificativa).

**Passo 4 — Aplicar** via R2: revisar um a um (recomendado) / aplicar todos / não atualizar. Para cada diff, mostrar antes/depois e pedir aprovação.

**Passo 5 — Incrementar versão** do SKILL.md.

Limites: IA tem viés de concordância sobre si mesma. Humano detecta atrito → IA propõe → humano aprova. Nunca alterar SKILL.md sem aprovação.

### Meta-iteração v1.0 → v2.0:
- specs/ de v1.0 é BASELINE para v2.0 — conhecimento NÃO é perdido entre ciclos
- Phase 0 de v2.0 parte do specs/ existente (não recomeça do zero)
- Decisões anteriores servem como contexto — o que foi descartado e por quê
- Escopo negativo de v1.0 pode virar escopo de v2.0 (com aprovação do operador)
- Lições de Phase 7 de v1.0 alimentam o processo de v2.0
