---
title: Modular Dashboard Guide
description: Add new dashboard sections safely with error boundaries
---

# Modular Dashboard Guide

Add new dashboard sections safely with error boundaries

The dashboard uses a modular architecture where each section is wrapped with an error boundary. This ensures one broken section doesn't crash the entire dashboard.

## How to Add a New Section
- Create a new component in components/dashboard
- Fetch data in the page and pass it as props
- Wrap the component with DashboardErrorBoundary
- Keep the component presentational (no data fetching)

## Best Practices
- Keep components stateless when possible
- Pass immutable props only
- Avoid fetching data inside error boundaries
- Provide useful fallback UI for errors

[Admin Panel Docs](/docs/admin-panel)
