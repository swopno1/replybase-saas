# Flow Debugging System

## Debugging Features

### Breakpoints & Inspection
The Simulation Lab allows admins to see exactly WHY a bot took a specific path:
- **Condition Evaluation**: Shows which variable was checked and how it compared against the threshold.
- **AI Fallback Trigger**: Explains why AI was invoked (e.g., "End of flow reached without resolution").

### Error Detection
The system automatically flags:
- **Circular References**: Infinite loops between flows.
- **Dead Ends**: Nodes with no valid next step.
- **Variable Mismatch**: Attempting to use a variable that hasn't been set.
- **AI Hallucination Risk**: When AI confidence is low or response is generic.

### Regression Testing
A suite of "Standard Tests" can be run against any subscriber flow to ensure that new changes haven't broken core functionality like Lead Capture or Human Handoff requests.
