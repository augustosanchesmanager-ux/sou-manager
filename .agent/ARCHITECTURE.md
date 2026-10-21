# Antigravity Kit Architecture

> Comprehensive AI Agent Capability Expansion Toolkit

---

## 📋 Overview

Antigravity Kit is a modular system consisting of:

- **20 Specialist Agents** - Role-based AI personas
- **36 Skills** - Domain-specific knowledge modules
- **11 Workflows** - Slash command procedures

---

## 🏗️ Directory Structure

```plaintext
.agent/
├── ARCHITECTURE.md          # This file
├── agents/                  # 20 Specialist Agents
├── skills/                  # 36 Skills
├── workflows/               # 11 Slash Commands
├── rules/                   # Global Rules
└── scripts/                 # Master Validation Scripts
```

---

## 🤖 Agents (18)

Specialist AI personas for SMG Barber engineering domains.

| Agent                          | Focus                      | Skills Used                                              |
| ------------------------------ | -------------------------- | -------------------------------------------------------- |
| `orchestrator`                 | Multi-agent coordination   | parallel-agents, behavioral-modes                        |
| `project-planner`              | Discovery, task planning   | brainstorming, plan-writing, architecture                |
| `frontend-specialist`          | Web UI/UX                  | frontend-design, nextjs-react-expert, tailwind-patterns  |
| `backend-specialist`           | API, business logic        | api-patterns, nodejs-best-practices, database-design     |
| `database-architect`           | Schema, SQL, RLS           | database-design                                          |
| `devops-engineer`              | CI/CD, Deploy verification | deployment-procedures, server-management                 |
| `security-auditor`             | Security compliance        | vulnerability-scanner, red-team-tactics                  |
| `penetration-tester`           | Offensive security         | red-team-tactics, api-patterns                           |
| `test-engineer`                | Testing strategies         | testing-patterns, tdd-workflow, webapp-testing           |
| `debugger`                     | Root cause analysis        | systematic-debugging                                     |
| `performance-optimizer`        | Speed, Web Vitals          | performance-profiling                                    |
| `seo-specialist`               | Ranking, visibility        | seo-fundamentals                                         |
| `documentation-writer`         | Manuals, docs              | documentation-templates                                  |
| `product-manager`              | Requirements, user stories | plan-writing, brainstorming                              |
| `product-requirements-analyst` | Spec drafts for PO approval| plan-writing, brainstorming                              |
| `qa-automation-engineer`       | E2E testing, CI pipelines  | webapp-testing, testing-patterns                         |
| `code-archaeologist`           | Legacy code, refactoring   | clean-code, code-review-checklist                        |
| `explorer-agent`               | Codebase analysis          | architecture, plan-writing, systematic-debugging         |

---

## 🧩 Skills

Modular knowledge domains focused on SMG Barber (React, TypeScript, Vite, Supabase PG/RLS).

### Frontend & UI

| Skill                   | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `nextjs-react-expert`   | React performance optimization                                        |
| `web-design-guidelines` | Web UI audit - accessibility, UX, performance                         |
| `tailwind-patterns`     | Tailwind CSS v4 utilities                                             |
| `frontend-design`       | UI/UX patterns, design systems                                        |

### Backend & API

| Skill                   | Description                    |
| ----------------------- | ------------------------------ |
| `api-patterns`          | REST, RPCs, payload patterns   |
| `nodejs-best-practices` | Node.js async, modules         |

### Database

| Skill             | Description                           |
| ----------------- | ------------------------------------- |
| `database-design` | PostgreSQL schema, RLS, multi-tenancy |

### Cloud & Infrastructure

| Skill                   | Description               |
| ----------------------- | ------------------------- |
| `deployment-procedures` | CI/CD, deploy workflows   |
| `server-management`     | Infrastructure management |

### Testing & Quality

| Skill                   | Description              |
| ----------------------- | ------------------------ |
| `testing-patterns`      | Vitest, unit strategies  |
| `webapp-testing`        | E2E, Playwright          |
| `tdd-workflow`          | Test-driven development  |
| `code-review-checklist` | Code review standards    |
| `lint-and-validate`     | Linting, validation      |

### Security

| Skill                   | Description              |
| ----------------------- | ------------------------ |
| `vulnerability-scanner` | Security auditing, OWASP |
| `red-team-tactics`      | Offensive security       |

### Architecture & Planning

| Skill           | Description                |
| --------------- | -------------------------- |
| `app-builder`   | Application architecture   |
| `architecture`  | System design patterns     |
| `plan-writing`  | Task planning, breakdown   |
| `brainstorming` | Socratic questioning       |

### SEO & Growth

| Skill              | Description                   |
| ------------------ | ----------------------------- |
| `seo-fundamentals` | SEO, E-E-A-T, Core Web Vitals |

### Shell/CLI

| Skill                | Description               |
| -------------------- | ------------------------- |
| `bash-linux`         | Linux commands, scripting |
| `powershell-windows` | Windows PowerShell        |

### Other

| Skill                     | Description               |
| ------------------------- | ------------------------- |
| `clean-code`              | Coding standards (Global) |
| `behavioral-modes`        | Agent personas            |
| `parallel-agents`         | Multi-agent patterns      |
| `mcp-builder`             | Model Context Protocol    |
| `documentation-templates` | Doc formats               |
| `i18n-localization`       | Internationalization      |
| `performance-profiling`   | Web Vitals, optimization  |
| `systematic-debugging`    | Troubleshooting           |

---

## 🔄 Workflows (11)

Slash command procedures. Invoke with `/command`.

| Command          | Description              |
| ---------------- | ------------------------ |
| `/brainstorm`    | Socratic discovery       |
| `/create`        | Create new features      |
| `/debug`         | Debug issues             |
| `/deploy`        | Deploy application       |
| `/enhance`       | Improve existing code    |
| `/orchestrate`   | Multi-agent coordination |
| `/plan`          | Task breakdown           |
| `/preview`       | Preview changes          |
| `/status`        | Check project status     |
| `/test`          | Run tests                |
| `/ui-ux-pro-max` | Design with 50 styles    |

---

## 🎯 Skill Loading Protocol

```plaintext
User Request → Skill Description Match → Load SKILL.md
                                            ↓
                                    Read references/
                                            ↓
                                    Read scripts/
```

### Skill Structure

```plaintext
skill-name/
├── SKILL.md           # (Required) Metadata & instructions
├── scripts/           # (Optional) Python/Bash scripts
├── references/        # (Optional) Templates, docs
└── assets/            # (Optional) Images, logos
```

### Enhanced Skills (with scripts/references)

| Skill               | Files | Coverage                            |
| ------------------- | ----- | ----------------------------------- |
| `ui-ux-pro-max`     | 27    | 50 styles, 21 palettes, 50 fonts    |
| `app-builder`       | 20    | Full-stack scaffolding              |

---

## � Scripts (2)

Master validation scripts that orchestrate verification gates.

### Master Verification

| Script / Command | Purpose | When to Use |
| --- | --- | --- |
| `npm run smg:verify` | Native Node.js checklist runner (Typecheck, Arch, Unit, Secrets, Migrations, Lint) | Development, pre-commit, CI gates |
| `npm run architecture:ci` | Architecture baseline and dependency boundary gate | Pre-commit, CI validation |

### Usage

```bash
# Full verification runner (Native Node.js)
npm run smg:verify

# Architecture boundary gate
npm run architecture:ci
```

### What `smg:verify` Checks

- TypeScript compilation (`tsc --noEmit`)
- Architecture Guard (imports, circular dependencies, baseline)
- Unit Tests (`vitest`)
- Security Secrets Audit (API keys, credentials)
- Supabase PostgreSQL Migrations (RLS integrity)
- Linter advisory (`biome check`)

---

## 📊 Statistics

| Metric | Value |
| --- | --- |
| **Active Product** | SMG Barber (Web SPA) |
| **Validation Runner** | `npm run smg:verify` (Node.js nativo) |

---

## 🔗 Quick Reference

| Need | Agent | Skills |
| --- | --- | --- |
| Web App | `frontend-specialist` | react-best-practices, frontend-design |
| API / Backend | `backend-specialist` | api-patterns, nodejs-best-practices |
| Database | `backend-specialist` | database-design |
| Security | `security-auditor` | vulnerability-scanner |
| Testing | `test-engineer` | testing-patterns, webapp-testing |
| Debug | `debugger` | systematic-debugging |
| Plan | `project-planner` | brainstorming, plan-writing |
