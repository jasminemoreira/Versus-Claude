# MCP Tools — IACDM Orchestrator

## Catálogo de Ferramentas (~12 tools)

### Consulta de Estado

#### `get_phase_state()`
- **Parâmetros:** nenhum
- **Retorna:** `{ phase, iteration, score, decisions_count, safeguards_status, summary }`
- **Propósito:** Claude consulta estado atual antes de agir. Fonte de verdade.

#### `get_decisions(phase?)`
- **Parâmetros:** `phase` (opcional, 0-7) — se omitido, retorna todas
- **Retorna:** `[{ phase, category, content, timestamp }...]`
- **Propósito:** consultar decisões tomadas em qualquer fase

#### `get_exit_criteria(phase)`
- **Parâmetros:** `phase` (0-7)
- **Retorna:** `[{ criterion, met, details }...]`
- **Propósito:** saber o que falta para avançar

### Transições

#### `advance_phase(target_phase)`
- **Parâmetros:** `target_phase` (0-7)
- **Retorna:** OK ou ERRO com lista de critérios não atendidos
- **Validação:** verifica exit criteria da fase atual, specs/ status (alerta sem bloquear)
- **Propósito:** transição controlada entre fases

#### `start_iteration(phase)`
- **Parâmetros:** `phase` (0, 2, 3)
- **Retorna:** `{ iteration_number, previous_summary }`
- **Propósito:** iniciar nova iteração em fases cíclicas (Phase 0 discovery, Phases 2-3 loop)

### Registro

#### `record_decision(phase, category, content)`
- **Parâmetros:** `phase` (0-7), `category` (ex: "architecture", "pattern", "constraint"), `content` (texto livre)
- **Retorna:** `{ id, timestamp }`
- **Propósito:** persistir decisão fora do contexto do Claude

#### `update_score(score, breakdown)`
- **Parâmetros:** `score` (0-100), `breakdown` (objeto com pesos)
- **Retorna:** OK + histórico de scores
- **Propósito:** registrar score de convergência Phase 0

#### `mark_exit_criterion(phase, criterion, met)`
- **Parâmetros:** `phase` (0-7), `criterion` (string), `met` (boolean)
- **Retorna:** OK + exit criteria atualizado
- **Propósito:** marcar critério individual como atendido

### Salvaguardas

#### `check_safeguard(id)`
- **Parâmetros:** `id` ("S0" a "S7")
- **Retorna:** `{ status, details, recommendation }`
- **Propósito:** verificar salvaguarda específica

#### `check_all_safeguards()`
- **Parâmetros:** nenhum
- **Retorna:** `[{ id, status, details }...]`
- **Propósito:** panorama de todas as salvaguardas

### Specs

#### `check_specs_status()`
- **Parâmetros:** nenhum
- **Retorna:** `{ directory: "populated"|"empty", file_count }...` para cada subdiretório
- **Propósito:** verificar estado do specs/ (alerta, não bloqueia)

### Projeto

#### `init_project(name, description)`
- **Parâmetros:** `name`, `description`
- **Retorna:** state.json inicial criado
- **Propósito:** inicializar novo projeto com estado Phase 0
