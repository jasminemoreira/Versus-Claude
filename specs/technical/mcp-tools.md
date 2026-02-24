# MCP Tools — Versus for Claude

## Tool Catalog (~12 tools)

### State Query

#### `get_phase_state()`
- **Parameters:** none
- **Returns:** `{ phase, iteration, score, decisions_count, safeguards_status, summary }`
- **Purpose:** Claude queries current state before acting. Source of truth.

#### `get_decisions(phase?)`
- **Parameters:** `phase` (optional, 0-7) — if omitted, returns all
- **Returns:** `[{ phase, category, content, timestamp }...]`
- **Purpose:** query decisions made in any phase

#### `get_exit_criteria(phase)`
- **Parameters:** `phase` (0-7)
- **Returns:** `[{ criterion, met, details }...]`
- **Purpose:** find out what is needed to advance

### Transitions

#### `advance_phase(target_phase)`
- **Parameters:** `target_phase` (0-7)
- **Returns:** OK or ERROR with list of unmet criteria
- **Validation:** checks exit criteria for the current phase, specs/ status (alerts without blocking)
- **Purpose:** controlled transition between phases

#### `start_iteration(phase)`
- **Parameters:** `phase` (0, 2, 3)
- **Returns:** `{ iteration_number, previous_summary }`
- **Purpose:** start a new iteration in cyclic phases (Phase 0 discovery, Phases 2-3 loop)

### Recording

#### `record_decision(phase, category, content)`
- **Parameters:** `phase` (0-7), `category` (e.g., "architecture", "pattern", "constraint"), `content` (free text)
- **Returns:** `{ id, timestamp }`
- **Purpose:** persist a decision outside of Claude's context

#### `update_score(score, breakdown)`
- **Parameters:** `score` (0-100), `breakdown` (object with weights)
- **Returns:** OK + score history
- **Purpose:** record Phase 0 convergence score

#### `mark_exit_criterion(phase, criterion, met)`
- **Parameters:** `phase` (0-7), `criterion` (string), `met` (boolean)
- **Returns:** OK + updated exit criteria
- **Purpose:** mark an individual criterion as met

### Safeguards

#### `check_safeguard(id)`
- **Parameters:** `id` ("S0" to "S7")
- **Returns:** `{ status, details, recommendation }`
- **Purpose:** check a specific safeguard

#### `check_all_safeguards()`
- **Parameters:** none
- **Returns:** `[{ id, status, details }...]`
- **Purpose:** overview of all safeguards

### Specs

#### `check_specs_status()`
- **Parameters:** none
- **Returns:** `{ directory: "populated"|"empty", file_count }...` for each subdirectory
- **Purpose:** check specs/ status (alerts, does not block)

### Project

#### `init_project(name, description)`
- **Parameters:** `name`, `description`
- **Returns:** initial state.json created
- **Purpose:** initialize a new project with Phase 0 state
