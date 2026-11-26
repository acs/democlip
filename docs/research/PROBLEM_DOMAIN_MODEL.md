# DemoClip: Exploring the Problem Domain Model

## 1. Context and Motivation

DemoClip is an interesting case study for exploring a new approach to AI-assisted software development.

The project was not initially developed from an explicit semantic model of its Problem Domain. Instead, the understanding of the domain emerged progressively during implementation, as product requirements, architectural decisions, functional flows, and business rules were discovered and refined.

However, a significant part of this knowledge has already been captured through the project's architecture and documentation.

In particular:

- [`docs/GLOSSARY.md`](https://github.com/acs/democlip/blob/main/docs/GLOSSARY.md) defines the project's terminology and ubiquitous language.
- [`docs/FEATURES.md`](https://github.com/acs/democlip/blob/main/docs/FEATURES.md) describes the product's functional capabilities and workflows.
- [`src/domain/`](https://github.com/acs/democlip/tree/main/src/domain) contains the domain model implemented using a clean architectural approach.
- The overall source structure expresses the separation between domain logic, application use cases, infrastructure, and user interface.

This provides a valuable starting point for reconstructing and expanding the Problem Domain Model.

The central question is:

> How much of the Problem Domain does DemoClip already model, what knowledge is still implicit, and how can we make that knowledge accessible to AI agents?

---

## 2. The Relationship Between the Problem Domain and the Solution Domain

An important distinction is needed.

The domain layer in Clean Architecture represents the domain concepts and business rules required by the software. It is a model of the domain expressed from the perspective of the solution.

However, it does not necessarily represent the entire Problem Domain.

For example, DemoClip contains concepts such as:

- Clip
- Take
- Cut
- Annotation
- TimelineMap
- ExportPlan
- Profile

These concepts are essential to the product's implementation. They represent the objects, behaviours, constraints, and rules that the software needs to manage.

But the Problem Domain is broader.

It also includes the context in which people create demonstrations, their objectives, their audiences, their workflows, their communication needs, and the challenges they face.

A user does not necessarily think in terms of `TimelineMap` or `ExportPlan`. They think about explaining a feature, showing a workflow, highlighting an important moment, or producing content for a particular audience.

These are different perspectives on the same underlying reality.

We should therefore distinguish between two related models:

### Problem Domain Model

Represents the reality in which we intend to operate.

It describes:

- Actors and stakeholders.
- Concepts and entities.
- Relationships.
- Processes and behaviours.
- Rules and constraints.
- Problems and opportunities.
- Context and external dependencies.
- Expected changes in that reality.

### Solution Domain Model

Represents how the software materialises our contribution to that reality.

It describes:

- Software domain concepts.
- Application capabilities and use cases.
- Business rules and invariants.
- Components and architectural boundaries.
- Interfaces and integrations.
- Technical constraints.
- Implementation mechanisms.

The Solution Domain Model should be grounded in the Problem Domain Model, but the two should not be confused.

---

## 3. What DemoClip Already Captures

DemoClip already contains a substantial amount of domain knowledge.

| Existing artifact | What it represents | Contribution to domain modelling |
|---|---|---|
| `GLOSSARY.md` | Ubiquitous language and concept definitions | Semantic model and domain terminology |
| `FEATURES.md` | Product capabilities and functional workflows | Behaviours and use cases |
| `src/domain/` | Entities, value objects, domain rules and invariants | Executable solution domain model |
| `src/application/` | Application use cases and coordination | Operations performed on the domain |
| `src/infra/` | Browser APIs, storage, capture, encoding and external mechanisms | Technical mechanisms and constraints |
| `src/ui/` | User interaction and presentation | How capabilities are exposed to users |

### 3.1 The glossary as a semantic foundation

`GLOSSARY.md` is particularly important.

It is not merely a dictionary of terms. It establishes a common language that should be shared by the code, documentation, commits, pull requests, and user interface.

This is a fundamental part of Domain-Driven Design: the ubiquitous language connects the understanding of the domain with its software representation.

The glossary also captures important modelling decisions, including the need to use consistent terminology and represent concepts with domain classes when they require explicit rules.

This makes it an important semantic asset for both developers and AI agents.

### 3.2 Clean Architecture as an executable domain model

The domain layer provides another important contribution.

By keeping domain logic independent of browser APIs and infrastructure, DemoClip makes its domain rules explicit and testable.

The architecture provides a separation between:

- What the product does.
- How application operations are coordinated.
- How external mechanisms are implemented.
- How users interact with the product.

The domain model is therefore not just documentation. It is expressed in executable code and supported by tests.

This is particularly valuable for AI-assisted development because agents can inspect the model, understand its rules, and use tests to verify whether proposed changes preserve existing behaviour.

---

## 4. Reconstructing the Problem Domain of DemoClip

The next step is to make explicit the broader reality that DemoClip operates in.

The following is an initial hypothesis that should be validated and refined.

### 4.1 Current Reality

Creating software demonstrations and other audiovisual content involves several activities:

- Capturing screens, windows, cameras, and audio.
- Organising recordings and media assets.
- Reviewing and selecting relevant moments.
- Editing audiovisual content.
- Adding elements that help explain what is happening.
- Preparing the final presentation.
- Adapting content to different channels and publishing destinations.

These activities can involve multiple tools, manual operations, and editorial decisions.

The production process may therefore become fragmented, repetitive, and difficult to manage consistently.

### 4.2 Ideas: What Changes Can We Imagine?

Some possible changes include:

- Integrating capture, editing, and publishing into a single environment.
- Making content production simpler and more fluid.
- Automating repetitive operations.
- Introducing AI agents that can participate in editing.
- Reusing content and adapting it to different channels.
- Separating production decisions from the particular characteristics of each output.
- Allowing users to focus more on communication and less on technical operations.

These are possibilities, not yet product requirements.

### 4.3 Future Reality: What Do We Believe Can Change?

A possible future-reality hypothesis is:

> Audiovisual content production will become an integrated process in which people can focus on communicating their ideas, while tools and AI agents collaborate on capture, editing, composition, and distribution.

This describes a possible future of the broader domain.

It does not describe DemoClip's architecture or prescribe its features.

### 4.4 Mission: What Role Do We Want to Assume?

A possible mission statement is:

> Provide an audiovisual production environment that enables people to create, edit, and distribute content simply, flexibly, and efficiently, incorporating automation and collaboration with AI agents.

The mission defines the contribution DemoClip intends to make towards the future reality described above.

These statements are hypotheses for discussion, not established product decisions.

---

## 5. A Proposed Semantic Organisation of the Domain

Based on the existing product, we can initially organise its concepts into four broad areas.

### A. Production Domain

**What are we producing?**

Potential concepts:

- Clip
- Take
- Recording
- Session
- Media
- Audio
- Video
- Properties
- Profile

This area describes the content being produced and the context in which production takes place.

### B. Editing and Composition Domain

**How do we construct the content?**

Potential concepts:

- Timeline
- Cut
- Selection
- Span
- Annotation
- Transition
- Crop
- Composition
- Branding

This area describes how media is organised, modified, and composed into a final audiovisual production.

### C. Distribution Domain

**How do we deliver the content to its destination?**

Potential concepts:

- Export
- Format
- Resolution
- Encoding
- Publish
- Channel
- Platform
- Visibility

This area describes how the final content is prepared and delivered.

### D. Interaction and Automation Domain

**Who interacts with the production, and how?**

Potential concepts:

- Creator
- Agent
- Capture Control
- Editing Operations
- Review
- Approval
- Undo

This area describes how people and AI agents interact with the production process.

It is particularly relevant because AI agents should operate on the same domain concepts and rules as the human user, rather than relying on a separate, parallel implementation.

These four areas are a proposed semantic organisation, not necessarily bounded contexts or existing architectural modules.

---

## 6. AI Agents and the Value of an Explicit Domain Model

An explicit Problem Domain Model can substantially improve the ability of AI agents to participate in a project.

Without a sufficiently structured understanding of the domain, agents mainly rely on:

- Task descriptions.
- Source code.
- Documentation fragments.
- Examples.
- Instructions supplied in individual conversations.

They may understand how to modify a particular component without understanding why the component exists or how its behaviour relates to the wider product.

A richer domain model changes this situation.

Agents can use it to:

- Understand the meaning of domain concepts.
- Identify relationships between concepts.
- Explore business rules and constraints.
- Analyse the impact of proposed changes.
- Identify inconsistencies in requirements.
- Propose alternative solutions.
- Generate and update functional specifications.
- Implement changes while preserving domain invariants.
- Derive test scenarios from domain behaviour.
- Explain the consequences of implementation decisions.

The objective is not simply to provide agents with more documentation.

It is to provide them with a structured representation of the reality in which they are working.

### 6.1 Domain knowledge as a shared capability

The domain model should be accessible to both people and agents.

It should not be hidden inside individual prompts, agent configurations, or isolated development sessions.

It should become a shared knowledge asset that can be progressively enriched and reused across the project lifecycle.

This does not require every concept to be represented in a formal ontology or knowledge graph from the beginning.

Structured Markdown, explicit relationships, domain diagrams, executable models, and tests can provide a useful foundation. More formal representations can be introduced when they provide additional value.

---

## 7. An Existing Example: Profiles and Clips

DemoClip already contains an interesting example of the value of explicit domain boundaries.

A Profile defines configuration for a particular production environment or workflow.

A Clip represents an individual production instance.

The distinction is important:

- A Profile controls configuration that should remain fixed within the Clip.
- A Clip contains its own production content and properties.
- Changes to Profile-controlled configuration must be made through the Profile, not directly through the Clip.

This is more than an implementation detail.

It expresses an important domain rule: production-environment configuration and individual-content decisions are different responsibilities.

An AI agent must understand this distinction before attempting to modify a Clip.

Otherwise, it could make technically possible changes that violate the intended product behaviour.

This illustrates why domain rules should be explicit, accessible, and enforced by the application rather than relying exclusively on instructions given to agents.

---

## 8. Current Assessment

The following is an initial qualitative assessment of DemoClip's existing knowledge assets.

| Dimension | Current assessment |
|---|---|
| Ubiquitous language | Well developed |
| Product concepts | Well developed |
| Domain rules and invariants | Well represented |
| Functional workflows | Well developed |
| Executable domain model | Well developed |
| Problem context and stakeholders | Partially explicit |
| User goals and expected outcomes | Need further clarification |
| Solution-independent semantic model | Needs further development |
| Traceability between problem, solution, and features | Needs formalisation |
| Explicit knowledge model for AI agents | Opportunity for further work |

The objective should not be to replace existing documentation or architecture.

Instead, we should build upon the knowledge already captured and make the relationship between the broader Problem Domain and the implemented Solution Domain explicit.

---

## 9. Proposed Next Steps

I suggest approaching this as a progressive reconstruction of the Problem Domain Model.

### Step 1: Understand the Problem Context

Identify:

- Who creates audiovisual content?
- Who are the intended audiences?
- What situations motivate content production?
- What objectives are users trying to achieve?
- What difficulties and constraints do they encounter?
- What other actors, tools, and systems participate in the process?

The objective is to understand the reality independently of DemoClip's current implementation.

### Step 2: Build the Conceptual Model

Identify the main concepts of the Problem Domain.

For each concept, describe:

- Its meaning.
- Its responsibilities.
- Its relationships with other concepts.
- Its relevant properties.
- Its boundaries.

Do not assume that every Problem Domain concept must correspond to a software class.

### Step 3: Model Relationships and Behaviours

Describe:

- How concepts interact.
- Which processes involve them.
- How the different workflows operate.
- What events occur.
- Which state transitions are meaningful.

Use domain diagrams, relationship models, state diagrams, and sequence diagrams where useful.

### Step 4: Identify Rules and Constraints

Make explicit:

- Business rules.
- Domain invariants.
- Dependencies.
- Preconditions and postconditions.
- Operational constraints.
- Exceptions and alternative scenarios.

Distinguish actual domain rules from restrictions introduced by the current implementation.

### Step 5: Connect the Problem Domain to the Solution Domain

Establish traceability between:

- Problem Domain concepts.
- Solution Domain concepts.
- Application use cases.
- Functional capabilities.
- Existing features.
- Tests and implementation components.

This will help identify which parts of the problem are already addressed, which are only partially supported, and which are not represented in the current product.

### Step 6: Make the Model Available to AI Agents

Define how agents can discover and use the domain knowledge.

Potential mechanisms include:

- Structured domain documentation.
- Explicit links between concepts and implementation.
- Domain diagrams and models.
- Machine-readable representations where useful.
- Agent skills describing how to interpret and apply the model.
- Tools or MCP capabilities for querying and navigating domain knowledge.

The model should be progressively maintained as the product evolves.

---

## 10. A Practical Experiment: Can an Agent Understand DemoClip?

A useful way to validate the value of this approach is to run a controlled experiment.

We can compare two scenarios.

### Scenario A: Existing Knowledge

Provide an agent with the current project knowledge:

- `GLOSSARY.md`
- `FEATURES.md`
- Source code.
- Existing architecture and tests.

Ask it to explain the problem DemoClip solves, identify the main domain concepts, and analyse a proposed product change.

### Scenario B: Explicit Problem Domain Model

Provide the same agent with the existing knowledge plus the reconstructed Problem Domain Model.

Repeat the same tasks.

### Evaluation Criteria

Compare the results in terms of:

1. **Domain understanding:** Does the agent correctly explain the problem and its context?
2. **Conceptual accuracy:** Does it distinguish problem concepts from implementation concepts?
3. **Relationship awareness:** Does it understand how concepts and processes relate?
4. **Impact analysis:** Can it identify the consequences of proposed changes across the domain?
5. **Decision quality:** Does it propose solutions consistent with the domain's objectives and constraints?
6. **Autonomy:** Can it complete more complex tasks without repeatedly requiring human clarification?
7. **Consistency:** Does it preserve existing domain rules and product decisions?

The experiment should use the same model, tools, task descriptions, and evaluation criteria in both scenarios.

This would provide practical evidence of whether explicitly modelling the Problem Domain improves the quality of AI participation.

---

## 11. Conclusion

DemoClip already contains a substantial model of its Solution Domain.

That model emerged progressively through the application of Clean Architecture, Domain-Driven Design principles, an extensive ubiquitous language, functional specifications, and executable domain rules.

The next opportunity is to reconstruct the broader Problem Domain that gives meaning to the product.

This introduces a distinction that is particularly important for AI-assisted software development:

> Modelling the software tells an agent how the solution works. Modelling the Problem Domain helps the agent understand why the solution exists, what reality it operates in, and what needs to change.

The more explicit, structured, precise, and accessible this knowledge becomes, the more effectively AI agents can participate in the project.

**The central hypothesis to investigate is:**

> The ability of AI agents to contribute meaningfully to a software project depends significantly on how well the project's Problem Domain is understood, modelled, and made accessible to them.

The construction and maintenance of this model should therefore become a central project activity, rather than an auxiliary documentation task.

It is not necessary to complete the entire model before implementation begins. The model should evolve alongside the project, incorporating new discoveries and reflecting changes in our understanding of the domain.

DemoClip provides an opportunity to investigate this approach using a real, evolving software product rather than starting from a theoretical example.
