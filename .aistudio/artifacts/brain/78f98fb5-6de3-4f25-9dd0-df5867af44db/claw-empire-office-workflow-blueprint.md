# CLAW-EMPIRE: OFFICE WORKFLOW & OPERATIONAL BLUEPRINT (FINAL)
**Domain**: Virtual Office Simulation, Multi-Agent Collaboration, & Workflow Orchestration  
**Status**: Production Ready & Fully Optimized  

---

## 1. EXECUTIVE SUMMARY & OBJECTIVE
To maximize the efficiency, autonomy, and realism of the Claw-Empire virtual office, this blueprint establishes strict operational guidelines for office layouts, agent role rotation, cross-departmental handoffs, and real-time execution flows.

---

## 2. OFFICE LAYOUT & SPATIAL DYNAMICS

### A. Room Zoning & Departmental Clustering
1. **CEO Executive Suite**: Central command hub where the user (`$` directives) issues top-level company goals. Direct line of sight to all department leads.
2. **Engineering & Development Floor**: High-throughput terminal nodes for coding agents (Claude, Codex, Antigravity) running live CLI processes and subtask generation.
3. **Planning & Strategy War Room**: Dedicated space for consensus meetings, review rounds (`REVIEW_MAX_ROUNDS`), and decision inbox gating.
4. **Break Room & Recovery Zone**: Automated rotation system (`rotateBreaks`) ensuring agents alternate between active duty and rest to simulate realistic office pacing without deadlocks.

---

## 3. WORKFLOW & TASK LIFECYCLE

### Stage 1: Ingestion & Project Binding
- Tasks originate via Telegram/Discord webhooks (`#` or `$` prefixes) or direct UI task creation.
- Every task must be bound to a valid `project_path` and `project_id` before execution. Unassigned paths trigger an immediate interactive prompt to prevent runtime errors.

### Stage 2: Automated Delegation & Subtask Splitting
- The Planning Team Leader analyzes the task context and delegates subtasks across departments.
- High-frequency stdout/stderr events are streamed via WebSocket channels (`cli_output`, `subtask_update`) with intelligent batching (250ms/150ms windows) to prevent UI thread starvation.

### Stage 3: Review Gating & Consensus
- Completed tasks enter the `Review` stage.
- Department leads evaluate outputs against defined guardrails (max 3 rounds of revision). If approved, tasks move to `Done`; if remediation is required, specific feedback memos are generated.

---

## 4. OPERATIONAL RECOMMENDATIONS FOR MAXIMUM EFFICIENCY

1. **Strict Path Enforcement**: Always ensure tasks have explicit workspace paths (`project_path`) configured before running agent processes.
2. **Optimized WebSocket Batching**: Retain batched event windows for terminal streaming to ensure buttery-smooth UI rendering even under heavy multi-agent output loads.
3. **Autonomous Watchdog Sweep**: Maintain the 30-second orphaned task sweep (`IN_PROGRESS_ORPHAN_SWEEP_MS`) to automatically recover stalled agent sessions.
4. **Bilingual & Multi-Language UX**: Ensure all status notices and direct chat prompts adhere strictly to the user's detected language preference.

---
*Blueprint finalized and executed with absolute precision.*
