# Project Charter: Kürsü, an AI-Powered Parliamentary Debate Game

## 1. Project Purpose and Objectives
Kürsü is a web-based educational game in which players debate an AI opponent on social and political topics over several sessions. The opponent's arguments are based on a public dataset of Turkish parliamentary debates, and a separate AI judge evaluates each debate. The player's choices and debate performance affect the game state and the final score.

## 2. Stakeholders & Roles
* **Product Owner:** Ali Emre Özcan
* **Software Engineering Team:**
    * Ali Emre Özcan : Project Manager & AI and Evaluation Engineer
    * Furkan Kalay : Backend & Database Engineer, Game Logic Designer
    * Ömer Faruk Ekmekçi : Backend & AI Inference Engineer
    * Beyza Kaya : Frontend & DevOps Engineer
* **GH Repo/Project URL:** To be filled after charter approval

## 3. Project Scope
### Project domain
Education and gaming. Possible users are students, teachers and debate clubs.

### In-Scope
* Debate gameplay against an AI opponent
* AI-based evaluation of debates
* Game state, metrics and scoring across sessions
* Use of a public parliamentary debate dataset (ParlaMint-TR)
* User accounts
* Web interface

### Out-of-Scope
* Native mobile applications
* Detailed parliament simulation (voting, party management)
* Predicting real-world political outcomes

## 4. Technology Stack

### Backend Stack
* Python (FastAPI)
* PostgreSQL
* Docker

### Frontend Stack
* React

### AI Stack
* Open-weight LLMs (e.g. Llama or Qwen)
* LangChain / LangGraph for orchestrating the AI pipeline (retrieval, opponent, judge)
* Prompt engineering, with fine-tuning as an option

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
