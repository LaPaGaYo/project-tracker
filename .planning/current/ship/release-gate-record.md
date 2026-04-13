# Release Gate Record

## Overview

Nexus-owned ship guidance for governed release gating and explicit merge readiness.

## Gate Checklist

- require completed review artifacts
- require ready QA when QA was run
- keep merge and release readiness explicit in canonical gate artifacts

## Canonical Artifact Contract

Writes `.planning/current/ship/release-gate-record.md`, `.planning/current/ship/checklist.json`, and `.planning/current/ship/status.json`.

## Routing and Governance

Ship content starts only after completed review and optional ready QA. It must not imply any bypass of review, audit persistence, or closeout. Superpowers ship discipline informs the release gate, but Nexus-owned ship artifacts remain the only release authority.

Result: merge ready
