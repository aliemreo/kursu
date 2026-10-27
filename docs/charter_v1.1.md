# Project Charter: Kürsü, an AI-Powered Parliamentary Debate Game

## 1. Project Purpose and Objectives
Kürsü is a web-based educational strategy game in which players debate an AI opponent over a configurable number of sessions on predefined social and policy topics. Topic content is inspired by ParlaMint-TR, a public dataset of Turkish parliamentary debates. An independent AI judge evaluates each completed debate in two stages: a qualitative verdict (winner, victory strength, outcome narrative) followed by bounded changes to the game's metrics. The game engine validates these outputs, updates the persistent game state and calculates a final score, which players can compare on a public leaderboard. Kürsü is a fictional simulation; its outcomes are not predictions of real-world policy effects.


## 2. Stakeholders & Roles
* *Product Owner:* Giray Yıldırım
* *Software Engineering Team:*
    * Ali Emre Özcan : Project Manager & AI and Evaluation Engineer
    * Furkan Kalay : Backend & Database Engineer, Game Logic Designer
    * Ömer Faruk Ekmekçi : Backend & AI Inference Engineer
    * Beyza Kaya : Frontend & DevOps Engineer
* *GH Repo/Project URL:* https://github.com/aliemreo/kursu

## 3. Project Scope
### Project domain
Education and gaming. Possible users are students, teachers and debate clubs.

### In-Scope
* User registration, login and account-based access to one's own games
* Turn-based debates against an AI opponent over a configurable number of sessions, using a predefined topic catalog (at least five topics)
* Two-stage AI judge: qualitative verdict and bounded quantitative metric changes, with schema and range validation
* Persistent game state, metric history and final scoring
* Global score leaderboard
* Curated ParlaMint-TR subset for topic content, with attribution
* Judge evaluation set (repeatability, side-swap and prompt-injection tests)
* Web interface, automated tests, CI and cloud staging deployment
* API, design and test documentation

### Optional Scope
* Retrieval-augmented opponent responses with citations to ParlaMint-TR speeches
* Fine-tuning the opponent model
* Teacher and classroom features
* Additional topics and richer outcome categories

### Out-of-Scope
* Social features: friend requests, following, messaging, user profiles or feeds
* Native mobile applications
* Detailed parliament simulation (voting, party management, elections)
* Real-world policy effectiveness claims or political forecasting
* AI agents speaking for current political parties on current events
* Production-scale concurrent-user infrastructure

## 4. Technology Stack

### Backend Stack
* Python, FastAPI, Pydantic
* SQLAlchemy and Alembic (ORM and migrations)
* PostgreSQL
* pytest

### Frontend Stack
* React, TypeScript, Vite
* React Router
* TanStack Query (API client and caching)
* Recharts (metric visualizations)

### AI Stack
* Open-weight LLMs (e.g. Llama or Qwen; final model to be selected)
* LangChain for the opponent and judge pipeline
* Hugging Face Transformers; Ollama or vLLM for model serving
* Optional: PEFT / QLoRA for fine-tuning
* Coding Agents: Claude Code & Codex

### DevOps
* Docker and Docker Compose
* GitHub Actions (CI)
* Cloud staging environment

## 5. Project Milestones
| Deliverable                       | Deadline          |
|---                                |---                |
| Project Charter                   | 05.10.2026 23:59  |
| Project Plan                      | 19.10.2026 23:59  |
| Requirement Specification Report  | 02.11.2026 23:59  |
| Requirement Analysis Report       | 23.11.2026 23:59  |
| Software Design Report            | 07.12.2026 23:59  |
| Software Test Report              | 21.12.2026 23:59  |
| Codebase                          | 25.12.2026 23:59  |
| Demo                              | 26.12.2026 23:59  |
| Presentation                      | 28.12.2026 23:59  |

