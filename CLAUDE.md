# Project Tracker

## Nexus Routing

When Nexus commands are available, route lifecycle work through `/discover`, `/frame`, `/plan`, `/handoff`, `/build`, `/review`, `/qa`, `/ship`, and `/closeout`.

Use `/browse` from Nexus for all web browsing. Do not use `mcp__claude-in-chrome__*` tools unless the user explicitly asks.

## Nexus Skill Routing

When the user's request matches a canonical Nexus command, invoke that command first.
This guidance helps command discovery only.
Contracts, transitions, governed artifacts, and lifecycle truth are owned by `lib/nexus/`
and canonical `.planning/` artifacts.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke discover
- Scope definition, requirements framing, non-goals → invoke frame
- Architecture review, execution readiness, implementation planning → invoke plan
- Governed routing and handoff packaging → invoke handoff
- Bounded implementation execution → invoke build
- Code review, check my diff → invoke review
- QA, test the site, find bugs → invoke qa
- Ship, deploy, push, create PR → invoke ship
- Final governed verification and closure → invoke closeout
