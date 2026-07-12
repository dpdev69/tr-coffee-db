# Contributing

## Current Repo State

This is an active repository with `main` as its protected integration branch. Start new work from the latest `main`, keep the branch focused, and use the workflow below for every change.

## Branching Model

- `main` is always the integration branch and should stay releasable.
- Create short-lived branches from `main`.
- Prefer branch names like `feat/<scope>`, `fix/<scope>`, `chore/<scope>`, or `data/<scope>`.
- If an AI-assisted session creates a `codex/<scope>` branch, treat it like any other short-lived feature branch.
- Rebase or merge `main` into your branch before opening or updating a PR if it has drifted.

## Commit Style

Use small, reviewable commits with Conventional Commit prefixes:

- `feat:`
- `fix:`
- `chore:`
- `docs:`
- `refactor:`
- `test:`

Examples:

- `feat: preserve coffee filters in URL state`
- `fix: map quiz budget answers to price filters`
- `docs: add local setup and scraper runbook`

## Pull Request Flow

1. Start from an up-to-date `main`.
2. Keep each branch focused on one concern.
3. Open a draft PR early if the work will take more than a small session.
4. Move the PR out of draft only after `npm test && npm run check` passes locally.
5. Merge with squash merge so `main` stays easy to scan.

## Required Checks

These should be required in GitHub branch protection for `main`:

- `Web CI`
- `Scraper CI`
- `Test Suite`

Repository settings should also enforce:

- pull-request reviews before merge
- no direct pushes to `main`
- dismiss stale approvals after new commits

## Before You Merge

- Run `npm test && npm run check`
- Confirm docs are updated if setup or workflow changed
- Note any required secrets, migrations, or scrape changes in the PR description
- Call out deferred follow-up work instead of hiding it in silent scope creep
