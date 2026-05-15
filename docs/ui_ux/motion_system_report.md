# Motion & Feedback System Report - ReplyBase SaaS (August 2026)

## 1. Current Motion Landscape
- **Engine**: Framer Motion.
- **Patterns**:
    - Page transitions: Subtle opacity fades.
    - Modals: Scale-in / Slide-up.
    - Sidebar: Smooth width transitions.

## 2. Perceived Performance
- **Loading States**: Skeletons are effective on the dashboard.
- **Real-time Feedback**: "Bot is drafting..." and streaming AI responses are excellent examples of proactive UI feedback.

## 3. Identified Gaps
- **Success States**: Completing an integration or milestone is visually identical to a normal navigation event.
- **Navigation Feedback**: Clicking a dashboard metric card provides no visual "Active" feedback since they are currently non-interactive.

## 4. Motion Strategy
1. **Dopamine Interactions**: Integrate `canvas-confetti` for "Setup Complete" events.
2. **Setup Transitions**: Add a "Preparing Workspace" interstitial animation between plan selection and the dashboard to build excitement.
3. **Interactive States**: Apply `whileHover={{ scale: 1.01 }}` to dashboard cards once they are made interactive.
