---
title: Client Onboarding System
description: Current onboarding flows in ReplyBase for new workspaces and Messenger-led qualification
---

# Client Onboarding System

ReplyBase currently has two different onboarding concepts in the codebase, and it helps to keep them separate:

1. **Workspace onboarding**: account creation and first login into the SaaS app.
2. **Messenger onboarding sessions**: a structured conversation flow captured through Facebook interactions and surfaced in the admin area.

## Workspace Onboarding

For normal SaaS users, onboarding starts when they register an account:

- first name, last name, email, and password are collected
- a tenant workspace is created automatically
- the user is signed in and redirected into the dashboard

After that, the expected setup path is:

- connect Facebook Pages, Telegram, or Webchat
- launch the bot builder if needed
- configure flows and AI behavior

## Messenger-Based Onboarding Sessions

ReplyBase also tracks onboarding sessions that originate from Facebook conversations. These sessions are visible in the admin area and are designed to capture sales and qualification context during guided conversations.

## Onboarding Flow Stages

Typical data captured in the current onboarding session model includes:

- contact name
- business name
- business type
- email or contact details
- selected plan
- stage and completion status

## Admin Visibility

Internal operators can review onboarding sessions in the admin dashboard, including:

- total sessions
- completed sessions
- abandoned sessions
- stage distribution
- drop-off by stage
- recent session details and linked plan data

## Practical Guidance

- Treat workspace signup as the primary product onboarding path for customers.
- Treat Messenger onboarding as an operational or sales-assist flow tied to Facebook activity.
- If your rollout is webchat- or Telegram-first, document your own customer onboarding around those channel setup pages, because the older onboarding flow is Facebook-centric.

[Onboarding Implementation](/docs/onboarding-implementation)
