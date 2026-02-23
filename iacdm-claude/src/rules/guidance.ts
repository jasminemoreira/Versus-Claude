// Instruções comportamentais detalhadas por fase da Convergência Iterativa v3.6
// Consumido pelo inject-context.ts (resumo) e get_phase_guidance MCP tool (completo)

export interface PhaseGuidance {
  phase: number;
  summary: string;       // ~100 chars para inject-context
  rules: string[];       // regras globais aplicáveis
  instructions: string;  // instruções completas da fase
}

// Regras globais que são injetadas conforme a fase
const GLOBAL_RULES = {
  R1: "R1: Avaliar gatilhos antes de codificar. Se ativou → Phase 0. Nunca pular para implementação.",
  R2: "R2: Toda decisão do usuário via AskUserQuestion. Até 4 perguntas/chamada. multiSelect para não-exclusivas. Recomendada primeiro com '(Recomendado)'. Nunca listar opções A/B/C em texto.",
  R3: "R3: Máximo 1 arquivo por resposta. Indicar 'Arquivo X/N'. Exceção: arquivos <30 LOC agrupáveis se total <50% do limite.",
  R4_TIMING: {
    0: "R4: Popular specs/ — refs, domain, competitors.",
    1: "R4: Popular specs/ — technical, models, examples.",
    5: "R4: Consultar specs/technical, examples, references, datasets ANTES de cada módulo.",
    6: "R4: Usar specs/datasets (ground truth), specs/validation (critérios), specs/technical (ranges).",
    7: "R4: Atualizar specs/validation (resultados), specs/technical (decisões finais), specs/references.",
  },
};

// [G9] Propriedade 1 — Invariância Generativa + [G12] Critério de adoção
const ACTIVATION_TRIGGERS = `## GATILHOS DE ATIVAÇÃO

### Princípio fundamental (Invariância Generativa):
A metodologia NÃO melhora o modelo — ela melhora o PROCESSO. O mesmo LLM opera com ou sem metodologia. A diferença é a verificação externa em cada gate.

### Critério de adoção (assimetria de risco):
Custo de aplicar em projeto simples ≈ 20 min de overhead. Custo de NÃO aplicar em projeto complexo ≈ horas/dias de retrabalho.
Regra formal: aplicar quando C_overhead_metodológico < P(erro) × C_erro_não_detectado.

### Avaliar em sequência ANTES de propor implementação:
1. Não envolve criar/modificar código → Responder diretamente
2. Requisito tem palavras vagas ("fancy", "escalável") → USAR METODOLOGIA
3. Envolve decisão arquitetural → USAR METODOLOGIA
4. Usuário mencionou metodologia → OBRIGATÓRIO
5. Sinais de complexidade oculta → USAR METODOLOGIA

Sinais de complexidade (basta 1): múltiplos domínios, integrações externas, pedido não cabe em 1 frase, IA não visualiza solução completa, incerteza sobre complexidade.
Regra de ouro: se não consegue afirmar que é simples, não é simples.

Ao ativar: anunciar gatilhos detectados, sinais observados, fases 0-7 resumidas, declarar que não codificará até passar por Phases 0-4.`;

// [G1] Antipadrões — referenciados nas fases relevantes
const ANTIPATTERNS = `## ANTIPADRÕES A EVITAR

| # | Antipadrão | Descrição | Antídoto |
|---|-----------|-----------|----------|
| AP1 | Teatro de validação | Perguntar à IA "esse design está bom?" e aceitar resposta afirmativa. A IA tem viés de concordância (RLHF). | Nunca pedir validação — pedir REFUTAÇÃO. |
| AP2 | Complexidade como falsa solução | Quando crítica revela fragilidade, adicionar componentes em vez de simplificar. "Second-system effect" (Brooks). | Cada iteração deve simplificar, não complexificar. |
| AP3 | Sessão monolítica | Design, código e testes em uma única conversa. O contexto satura e a qualidade degrada. | Uma sessão por fase, uma fase por módulo. |
| AP4 | Premissa implícita | O design funciona — desde que condições não listadas sejam verdadeiras. | Lente de Premissas em Phase 2 + premissas em Phase 1. |
| AP5 | Ausência de AV-humano | Confiar exclusivamente em testes automáticos. Adequação semântica e correção de domínio requerem julgamento humano. | S4 ampliado + teste manual obrigatório. |
| AP6 | Pular Phase 0 | Começar pela arquitetura sem entender o problema. Complexidade errada se propaga por todas as fases. Custo: 100×. | S0: Score ≥90 obrigatório. |
| AP7 | Codificar sem referência | Implementar algoritmos sem consultar specs/ ou literatura. A IA gerará código plausível com parâmetros inventados. | S6: Tier 1/2/3 + specs/technical populado. |
| AP8 | Perfeccionismo convergente | Ciclos infinitos buscando design "perfeito". | Critério de parada: <15% mudança + 0 críticos → avançar. S2: parada é do usuário. |
| AP9 | Scope creep silencioso | Adicionar funcionalidades durante Phases 2-3 sem aprovação do operador. | S5: Escopo é do usuário. Phase 2-3 sugere, nunca decide. |`;

const PHASE_0_GUIDANCE = `## Phase 0 — Problem Discovery Loop
### Verificação: AV-humano (operador valida síntese e teach-back)

### Passo 0: Ler TODO conteúdo de specs/ antes de perguntar. Construir sobre o que já existe.

### COLETA — Perguntas obrigatórias (via AskUserQuestion / R2):

| Categoria | Perguntas-chave |
|-----------|----------------|
| A. Problema & Motivação | Por quê precisa? O que acontece sem isso? Quem são os usuários? |
| B. Casos de Uso | 3-5 cenários principais (quem/o quê/por quê). Casos extremos? |
| C. Vocabulário | Termos-chave e definições. Sinônimos a evitar? |
| D. Constraints | Limitações técnicas, de recursos. Premissas assumidas? |
| E. Fora de Escopo (YAGNI) | O que NÃO fazer, com justificativa custo/benefício |
| F. Documentação | Specs, RFCs, código legado, issues. Conteúdo em specs/? |
| G. Termos Vagos | Clarificar: "fancy"→concreto, "escalável"→nº usuários, "rápido"→ms |
| H. Viabilidade Tech | Se tech inicial não atende 100%, explorar alternativas |

### F.2 — Pesquisa técnica E científica (OBRIGATÓRIA para domínios especializados):
Se projeto envolve DSP, ML, bioinformática, engenharia, ciências etc.: pesquisar ANTES da arquitetura:
- **Científica:** Papers de referência com peer review, fundamentos teóricos do domínio, modelos matemáticos/físicos aplicáveis, constantes e parâmetros validados pela literatura
- **Técnica:** Algoritmos candidatos com trade-offs, implementações de referência, benchmarks publicados, ferramentas e libs maduras
- **Competitiva:** Soluções concorrentes, estado da arte, gaps conhecidos
- Depositar TUDO em specs/ (references, technical, competitors)
- Cada parâmetro numérico DEVE ter fonte citada (paper, norma, especificação)
- Regra: "Não implementar algoritmo sem referência bibliográfica verificável"

### F.3 — Pesquisa web:
Se specs/ tem lacunas críticas, pedir permissão ao usuário (via AskUserQuestion) para pesquisar.
Opções: pesquisar e depositar / pesquisar e apresentar / não pesquisar.
Citar fonte/URL em todo material depositado.

### H — Viabilidade Tech (VERIFICAÇÃO OBRIGATÓRIA):
**LIÇÃO APRENDIDA:** Viabilidade tech da plataforma-alvo deve ser VERIFICADA, não assumida.
Antes de avançar, responder EXPLICITAMENTE:
- A plataforma-alvo suporta os mecanismos fundamentais necessários? (APIs, protocolos, extensibilidade)
- Em projetos de porte/migração: a plataforma destino tem paridade de capacidades com a origem?
- Que capacidades são ESSENCIAIS vs. DESEJÁVEIS? Alguma essencial está ausente?

Se qualquer capacidade essencial estiver ausente → BLOCKER. Não avançar sem resolução.
Não cortar escopo para caber na tecnologia. Comparar alternativas com tabela (requisitos × techs, LOC, libs, plataforma). Perguntar ao usuário via AskUserQuestion.

### SÍNTESE (Teach-Back) — Template obrigatório:
\`\`\`markdown
# Meu Entendimento (Iteração N)
## Resumo em 3 Frases (problema, não solução)
## Casos de Uso Principais (ator/objetivo/fluxo/exemplo concreto)
## Vocabulário (termo | entendimento | exemplo)
## Fora de Escopo (item | razão)
## Critérios de Sucesso (mensuráveis e verificáveis)
## Premissas & Constraints
## Ambiguidades Restantes
## Perguntas para Próxima Iteração
\`\`\`

### VALIDAÇÃO — via AskUserQuestion: correto / quase / incompleto / errado
**CUIDADO AP1 (Teatro de validação):** O humano avalia a SÍNTESE escrita, não pergunta à IA se está certo.

### AVALIAÇÃO DE CONVERGÊNCIA (0-100) — use update_score():
| Critério | Peso |
|----------|------|
| Clareza do Problema | 10 |
| Casos de Uso Completos | 15 |
| Vocabulário Definido | 10 |
| Ambiguidades Resolvidas | 15 |
| Fora de Escopo Explícito | 10 |
| Critérios de Sucesso | 10 |
| Premissas Validadas | 10 |
| Documentação/Pesquisa (técnica+científica) + specs/ | 5 |
| Usuário Confirmou | 10 |
| IA Confiante | 5 |

≥90 → Phase 1 | 70-89 → +1 iteração | <70 → múltiplas iterações
**CUIDADO AP8 (Perfeccionismo):** Score ≥90 é suficiente. Não buscar 100.

### Viabilidade de Implementação — avaliar por componente:
- Tier 1: Existe lib madura? → USAR
- Tier 2: Existe algoritmo documentado com implementação de referência? → PORTAR
- Tier 3: Nenhum dos anteriores. Se domínio complexo → PoC obrigatório antes de Phase 1`;

// [G4] 4 questões da arquitetura + [G6] sessões desacopladas
const PHASE_1_GUIDANCE = `## Phase 1 — Architecture
### Verificação: AV-humano (operador valida adequação e completude)

### Passo 0: Consultar e popular specs/
Ler specs/technical, examples, models, design. Se falta material técnico/científico crítico, pesquisar e depositar ANTES de definir módulos.

### As 4 questões que a arquitetura DEVE responder:
1. **Decomposição.** Quais são os módulos? Quais suas responsabilidades? Onde estão os limites? (SRP, Separação de Interesses)
2. **Interfaces.** Como os módulos se comunicam? Quais são os contratos? (Design by Contract)
3. **Premissas.** O que o sistema assume como verdade? Premissas implícitas são a fonte mais comum de falhas. (Leveson)
4. **Escopo negativo.** O que o sistema deliberadamente NÃO faz? Limitações conscientes evitam scope creep.

### Princípio de granularização (E = I₀/C):
Cada módulo deve ser compreensível pela IA em uma ÚNICA interação. Se não cabe no contexto com suas dependências, precisa ser decomposto. Interfaces funcionam como "resumos executáveis" — a IA não precisa do código do módulo B, apenas da interface de B.

### Passo 1: Coleta de Padrões e Princípios (2 chamadas AskUserQuestion):

**Chamada 1 (até 4 perguntas):**
1. Padrão Arquitetural (single): Clean Architecture / Layered / Hexagonal / Modular Monolith
2. Princípios Transversais (multi): SOLID / KISS+YAGNI / DDD / Composition over Inheritance
3. Concorrência (single): Single-threaded / Actor Model / Message Queue / N/A

**Chamada 2 (até 4 perguntas):**
4. GoF relevantes (multi): selecionar os mais pertinentes + "Nenhum específico"
5. Padrões Fowler — Domínio (single): Domain Model / Transaction Script / Table Module
6. Padrões Fowler — Dados (single): Repository+Data Mapper / Active Record / Table Data Gateway

Apresentar resumo em tabela, confirmar via AskUserQuestion.

### Validação Tecnológica:
Se >1 opção tech: tabela comparativa (requisitos × techs, LOC, dependências, consumo contexto LLM).
Premissas verificadas com evidência (specs/technical), não assumidas. **CUIDADO AP4 (Premissas implícitas).**
Se tech forçar redução de escopo → tech errada.

### Escopo Progressivo:
Quando maturidade/risco desigual: mapa de maturidade (req | lib madura? | LOC | risco).
Oferecer via AskUserQuestion: escopo progressivo (v1.0 maduro, v2.0 resto) / tudo em v1.0 / outro.
Escopo progressivo ≠ corte: preserva 100%, distribui entre versões.

### Planejamento de sessões (ciclo desacoplado):
O trabalho futuro seguirá sessões independentes:
- Sessão de Design (Phases 0-4): contexto = domínio + restrições → arquitetura + interfaces
- Sessão de Código (Phase 5): contexto = arquitetura + interface do módulo → 100% dedicado
- Sessão de Testes (Phase 6): contexto = interface + contrato → sem necessidade do código interno
- Sessão de Validação: CI/CD executa testes → IA só invocada se correções
**CUIDADO AP3 (Sessão monolítica):** Separar fases em sessões distintas preserva eficiência de contexto.`;

// [G2] Assimetria crítica-resposta + [G3] Análise de concentração + [G8] AV types + [G10] Gate criteria
const PHASE_2_GUIDANCE = `## Phase 2 — Adversarial Critique
### Verificação: AV-humano + AG (7 lentes especializadas como AVs operacionalmente distintos)

### Princípio da assimetria crítica-resposta:
**Phase 2 = MÚLTIPLOS agentes para ATACAR** (diversidade de lentes é valor).
**Phase 3 = agente UNIFICADO para RESPONDER** (correções devem ser integradas no todo).
**Operador humano = ARBITRAR trade-offs** (visão sistêmica).
Lentes diferentes veem falhas diferentes. Respostas isoladas podem ser individualmente corretas mas sistemicamente contraditórias.

### Lentes Universais (TODAS sempre aplicadas — custo baixo em planejamento, risco alto se omitida):
| Lente | Pergunta Central | Classe de falha exclusiva |
|-------|-----------------|--------------------------|
| Premissas | O que este design assume como verdade sem declarar? | Falhas por premissas ocultas |
| Arquitetural | Cada módulo pode ser substituído, removido ou testado isoladamente? | Acoplamento oculto, dependências circulares, violação SRP |
| Implementabilidade | Consigo codificar este módulo numa única sessão com o contexto disponível? | Specs incompletos, granularização insuficiente |
| Científica | Cada valor/fórmula/algoritmo tem referência bibliográfica verificável? | Parâmetros inventados, lógica baseada em plausibilidade |
| Segurança | Como um atacante exploraria com esforço mínimo? | Superfície de ataque não analisada |
| Performance | Onde estão os gargalos? Comportamento assintótico? | Gargalos ocultos, degradação com escala |
| Regulatória | Cada requisito normativo tem rastreabilidade até um módulo? | Não-conformidade com normas aplicáveis |

Princípio de seleção: se remover esta lente, existe uma classe de falha que NENHUMA outra lente detecta? Se sim → legítima. Se não → redundância.

### Protocolo por lente:
1. Aplicar pergunta central a CADA módulo
2. Classificar achados: 🔴 Crítico (bloqueia) | 🟡 Importante (degrada) | 🟢 Sugestão
3. Achado = evidência concreta, não opinião
4. Passadas são independentes (uma lente por vez)
**CUIDADO AP1 (Teatro de validação):** Nunca perguntar "está bom?". Pedir refutação.

### Matriz de Cobertura (obrigatória):
Tabela módulos × lentes com severidades.

### Análise de concentração (OBRIGATÓRIA após a matriz):
- **Concentração por módulo:** Módulo com achados em TODAS as lentes → provavelmente mal concebido → requer REDESIGN, não patch.
- **Concentração por lente:** Lente com achados em TODOS os módulos → falha SISTÊMICA (ex: nenhum parâmetro tem referência, nenhum módulo testável isoladamente).
- Documentar padrões de concentração com record_decision().

### Gate de Saída:
- Zero 🔴 para avançar → todos devem ser endereçados em Phase 3
- Cada 🟡 requer decisão EXPLÍCITA: tratar OU aceitar risco COM JUSTIFICATIVA documentada (record_decision)
- 🟢 podem ser postergados para v2.0 (registrar em record_decision)

### REGRA DE FRONTEIRA (Escopo vs Arquitetura):
Phase 2-3 PODE: mudar libs/padrões/comunicação, simplificar módulos, adicionar mecanismos técnicos.
Phase 2-3 NÃO PODE: cortar requisitos, adicionar features, mudar público-alvo/casos de uso.
TESTE: "Isso muda O QUE o sistema faz?" ou "PARA QUEM serve?" → Se sim = ESCOPO → voltar Phase 0.
**CUIDADO AP9 (Scope creep silencioso).**`;

// [G2] Assimetria: agente unificado para responder
const PHASE_3_GUIDANCE = `## Phase 3 — Simplification
### Verificação: AV-humano (operador valida que complexidade diminuiu e escopo preservado)

### Princípio da assimetria (continuação de Phase 2):
Phase 2 atacou com MÚLTIPLAS lentes. Phase 3 responde com VISÃO UNIFICADA.
Correções individualmente corretas podem ser sistemicamente contraditórias.
Integrar todas as respostas no todo — não corrigir módulo a módulo em isolamento.
Trade-offs resolvidos pelo OPERADOR HUMANO (S2: critério de parada é do usuário).

### Propósito: Simplificar V(N) → V(N+1), eliminando complexidade.
**CUIDADO AP2 (Complexidade como falsa solução):** Cada iteração deve SIMPLIFICAR, não complexificar.

### Distinção obrigatória:
- Adicionar Worker/cache/fallback = arquitetura (OK)
- Adicionar tutorial/botão/animação = feature (PROIBIDO)

### Se LOC aumentou >10%: justificativa OBRIGATÓRIA documentada com record_decision().

### Decisão pós-ciclo 2-3 (via AskUserQuestion):
| Mudança estrutural | Críticos | Ação |
|---|---|---|
| <15% | 0 | → Phase 4 |
| 15-25% | 0-1 | Mais 1 iteração |
| >25% | 2+ | Múltiplas iterações |

**CUIDADO AP8 (Perfeccionismo):** O critério de parada é honestidade — sabemos o que funciona, o que assumimos e o que não sabemos.

### Checklist Anti-Scope-Creep (OBRIGATÓRIO antes de avançar):
1. TODOS os requisitos de Phase 0 contemplados
2. Nenhuma funcionalidade não solicitada adicionada
3. O que o sistema FAZ não mudou (apenas COMO)
4. Casos de uso de Phase 0 continuam válidos`;

// [G8] AV types explícitos
const PHASE_4_GUIDANCE = `## Phase 4 — Convergence Gate
### Verificação: AV-humano (operador valida convergência com critérios rigorosos)

Validar convergência completa — este gate decide se o design está pronto para código:

1. Verificar TODOS exit criteria de Phases 2-3 (use get_exit_criteria para Phase 2 e Phase 3)
2. Verificar TODAS salvaguardas S1-S5 (use check_all_safeguards)
3. Verificar: as 4 questões de P1 ainda estão respondidas? (Decomposição, Interfaces, Premissas, Escopo negativo)
4. Verificar: análise de concentração da matriz não revelou falhas sistêmicas não resolvidas?
5. Verificar: specs/ está populado com referências técnicas e científicas necessárias para Phase 5?
6. Só avançar para Phase 5 se TUDO OK
7. Se algo falhou → voltar para Phase 2 ou 3 conforme necessário

**CUIDADO AP6 (Pular fases):** Não avançar com pendências. O custo de descobrir problemas em Phase 5-6 é 10× maior que resolvê-los aqui.`;

// [G6] sessões desacopladas + [G8] AV types
const PHASE_5_GUIDANCE = `## Phase 5 — Code Implementation
### Verificação: AV-automático (compile, lint, type check) | Sessão dedicada por módulo

### Princípio de sessão desacoplada:
Cada módulo deve ser implementável em sessão independente. Contexto necessário: documento de arquitetura (~2k tokens) + interface do módulo + specs/ relevante. Se precisa de mais → granularização insuficiente (voltar P1).
**CUIDADO AP3 (Sessão monolítica).**

### ANTES de cada módulo, consultar:
- specs/technical (algoritmo, fórmulas, params)
- specs/examples (código de referência)
- specs/references (paper original)
- specs/datasets (dados de teste)
Se parâmetros numéricos sem valores em specs/ → PARAR e pesquisar. Referenciar fonte no código.
**CUIDADO AP7 (Codificar sem referência).**

### Aplicar S6 (Tier 1/2/3) por módulo:
- Tier 1: Existe lib madura? → USAR. Código novo = UI + integração + glue.
- Tier 2: Algoritmo documentado com ref? → PORTAR literalmente (mesma estrutura, mesmos nomes, testar contra mesmos inputs).
- Tier 3: Nenhum dos anteriores. Se domínio complexo → depositar lógica em specs/technical antes de codar.

### Checklist por módulo: lib madura? → se não, por quê? → algoritmo documentado? → implementação portável? → decisão com record_decision().

### Aplicar S7 (Disciplina):
Após cada arquivo: marcar completed, identificar próximo, anunciar "X/N concluído, próximo: Y", iniciar imediatamente. Não iniciar discussões tangenciais.

### Sinal de alarme S6 (STOP imediato):
Se criando heurísticas para problemas com solução conhecida, debugando lógica complexa escrita do zero, fazendo trial-and-error em algo determinístico, ou gastando >2 iterações no mesmo módulo → PARAR, comunicar, buscar implementação de referência (Tier 2).`;

// [G8] AV types
const PHASE_6_GUIDANCE = `## Phase 6 — Tests
### Verificação: AV-automático (testes unitários, integração) + AV-humano (teste manual exploratório)

### Testes baseados em specs/:
- specs/datasets → testar contra ground truth (se vazio, gerar dados sintéticos e depositar)
- specs/validation → cada critério ≥ 1 teste
- specs/technical → outputs dentro dos ranges documentados

### S4 — Verificação Explícita: NUNCA assumir que testes passaram. Sempre executar e verificar output.
**CUIDADO AP5 (Ausência de AV-humano):** Testes automáticos verificam propriedades formalizáveis. Adequação semântica, usabilidade e correção de domínio REQUEREM julgamento humano.

### Teste Manual Exploratório (OBRIGATÓRIO antes de Phase 7):
1. Iniciar aplicação
2. Executar cada caso de uso de Phase 0 como usuário final
3. Testar edge cases: cliques rápidos/duplos, inputs vazios, interrupções, timeouts
4. Avaliar feedback: mensagens compreensíveis? Erros não-técnicos? Resultado acionável?
5. Documentar e corrigir problemas

Ambos (automatizados + manual) são gates obrigatórios. Nenhum substitui o outro.`;

// [G5] Meta-iteração v1→v2 + [G11] double-loop + [G8] AV type
const PHASE_7_GUIDANCE = `## Phase 7 — Post-Review
### Verificação: AV-humano (operador avalia lições e aprova mudanças no método)

### Atualizar specs/:
- specs/validation → resultados reais (esperado vs obtido)
- specs/technical → decisões finais, algoritmos descartados e por quê
- specs/references → referências descobertas durante correção

### Double-loop learning (Argyris):
Single-loop: avaliar o PRODUTO (o software funciona?).
Double-loop: avaliar o PROCESSO (a metodologia funcionou? Onde houve atrito?).
Phase 7 faz AMBOS.

### Auto-Aprimoramento da Metodologia (5 passos):

**Passo 1 — Coleta humana (obrigatório PRIMEIRO):** Perguntar via AskUserQuestion se alguma parte causou atrito ou falhou. O humano vivenciou o processo e detecta atrito que a IA não percebe sobre si mesma.

**Passo 2 — Auto-avaliação IA (complementar):** Fase que faltou checklist, salvaguarda ausente, template inadequado, regra sem valor, padrão recorrente.

**Passo 3 — Consolidar** em tabela (fonte [humano/IA] | fase | proposta | justificativa).

**Passo 4 — Aplicar** via AskUserQuestion: revisar um a um (recomendado) / aplicar todos / não atualizar. Para cada diff, mostrar antes/depois e pedir aprovação. Propostas passam por gate: operador aprova ou rejeita.

**Passo 5 — Incrementar versão** do SKILL.md.

Limites: IA tem viés de concordância sobre si mesma. Humano detecta atrito → IA propõe → humano aprova. Nunca alterar SKILL.md sem aprovação.

### Meta-iteração v1.0 → v2.0:
Se o projeto evolui para uma nova versão:
- specs/ de v1.0 é o BASELINE para v2.0 — conhecimento NÃO é perdido entre ciclos
- Phase 0 de v2.0 parte do specs/ existente (não recomeça do zero)
- Decisões anteriores (get_decisions) servem como contexto — o que foi descartado e por quê
- Escopo negativo de v1.0 pode virar escopo de v2.0 (com aprovação do operador)
- Lições de Phase 7 de v1.0 alimentam o processo de v2.0
Registrar decisão de versão com record_decision(category='scope').`;

const FULL_GUIDANCE: Record<number, string> = {
  0: PHASE_0_GUIDANCE,
  1: PHASE_1_GUIDANCE,
  2: PHASE_2_GUIDANCE,
  3: PHASE_3_GUIDANCE,
  4: PHASE_4_GUIDANCE,
  5: PHASE_5_GUIDANCE,
  6: PHASE_6_GUIDANCE,
  7: PHASE_7_GUIDANCE,
};

/**
 * Retorna o guidance COMPLETO da fase (para MCP tool get_phase_guidance).
 * Inclui: regras globais + gatilhos + antipadrões + instruções da fase.
 */
export function getFullGuidance(phase: number): string {
  const parts: string[] = [];

  // Regras globais sempre aplicáveis
  parts.push("## REGRAS GLOBAIS ATIVAS");
  parts.push(GLOBAL_RULES.R2); // R2 sempre ativo

  if (phase < 5) {
    parts.push(GLOBAL_RULES.R1);
  }
  if (phase === 5) {
    parts.push(GLOBAL_RULES.R3);
  }

  // R4 timing específico
  const r4 = GLOBAL_RULES.R4_TIMING[phase as keyof typeof GLOBAL_RULES.R4_TIMING];
  if (r4) {
    parts.push(r4);
  }

  // Gatilhos de ativação (relevante na Phase 0 ou pré-metodologia)
  if (phase === 0) {
    parts.push("");
    parts.push(ACTIVATION_TRIGGERS);
  }

  // Antipadrões (incluir em todas as fases — são alertas globais)
  parts.push("");
  parts.push(ANTIPATTERNS);

  // Instruções completas da fase
  const phaseGuidance = FULL_GUIDANCE[phase];
  if (phaseGuidance) {
    parts.push("");
    parts.push(phaseGuidance);
  }

  return parts.join("\n");
}

/**
 * Retorna resumo COMPACTO da fase (para inject-context.ts).
 * Máximo ~200 chars para não gastar tokens demais.
 */
export function getCompactGuidance(phase: number): string[] {
  const lines: string[] = [];

  switch (phase) {
    case 0:
      lines.push("INSTRUÇÕES P0: Categorias A-H (AskUserQuestion). Teach-back obrigatório. F.2: pesquisa técnica E CIENTÍFICA se domínio especializado. Viabilidade Tier 1/2/3. Score ≥90.");
      lines.push("R2: Toda decisão via AskUserQuestion. AP1: nunca pedir validação, pedir REFUTAÇÃO.");
      break;
    case 1:
      lines.push("INSTRUÇÕES P1: 4 questões (Decomposição, Interfaces, Premissas, Escopo negativo). 2 chamadas AskUserQuestion (padrões). Granularização: cada módulo cabe em 1 sessão IA.");
      lines.push("R2+R4: specs/technical,models,examples. AP3: planejar sessões desacopladas para P5-P6.");
      break;
    case 2:
      lines.push("INSTRUÇÕES P2: 7 lentes universais a CADA módulo → 🔴🟡🟢. Matriz + análise concentração (módulo×lentes). ASSIMETRIA: múltiplos agentes atacam, unificado responde em P3.");
      lines.push("FRONTEIRA: NÃO cortar/adicionar requisitos. AP1: pedir refutação, não validação.");
      break;
    case 3:
      lines.push("INSTRUÇÕES P3: Simplificar V(N)→V(N+1) com visão UNIFICADA. <15%/0crit→P4, 15-25%→+1iter, >25%→múltiplas. Checklist anti-scope-creep.");
      lines.push("ASSIMETRIA: integrar todas correções no todo. AP2: simplificar, não complexificar. AP8: não buscar perfeição.");
      break;
    case 4:
      lines.push("INSTRUÇÕES P4: Gate de convergência. Exit criteria P2-P3 + salvaguardas S1-S5 + 4 questões P1 + specs/ completo. get_exit_criteria() + check_all_safeguards().");
      break;
    case 5:
      lines.push("INSTRUÇÕES P5: Consultar specs/ ANTES de cada módulo. S6: Tier 1(lib)→2(portar)→3(novo). S7: marcar completed, anunciar X/N, iniciar próximo.");
      lines.push("R3: 1 arquivo/resposta. AP7: nunca codificar sem referência. STOP se trial-and-error ou >2 iter.");
      break;
    case 6:
      lines.push("INSTRUÇÕES P6: Testes specs-based + S4 (executar e verificar). AP5: AV-humano insubstituível para adequação semântica.");
      lines.push("TESTE MANUAL OBRIGATÓRIO: 5 passos. Ambos (automático+manual) são gates. Nenhum substitui o outro.");
      break;
    case 7:
      lines.push("INSTRUÇÕES P7: Double-loop: avaliar PRODUTO e PROCESSO. Atualizar specs/. 5 passos: humano primeiro→IA→consolidar→aplicar→versionar.");
      lines.push("Meta-iteração: specs/ de v1.0 é baseline de v2.0. NUNCA alterar SKILL.md sem aprovação.");
      break;
  }

  return lines;
}
