Sample

```
gh issue create --title "Validate Phase 1 Success" --body "- A user can visit the URL, turn off their Wi-Fi, refresh the page, and the OS still boots flawlessly.
- A user can open multiple windows, drag them around, minimize them to the taskbar, and close them without memory leaks.
- The repository is fully structured to accept Phase 2 (the everyday apps) as isolated plugins." --label "jules"
```

Template


```
gh issue create \
  --title "Production Readiness inspection_2026-04-28 update (branch: feat/prod-audit)" \
  --body "Branch: wip_v1

Please check the recommendation and take initiative to fix the issue specified in replybase-development/doc/inspection_2026-04-28.md" \
  --label "jules"
```