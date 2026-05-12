export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  initialVariables: Record<string, unknown>;
  steps: Array<{
    message: string;
    expectedNodes?: string[];
    expectedVariables?: Record<string, unknown>;
  }>;
}

export const SIMULATION_SCENARIOS: SimulationScenario[] = [
  {
    id: "new-lead-discovery",
    name: "New Lead Discovery",
    description: "Simulate a dentist clinic owner inquiring about WhatsApp automation.",
    initialVariables: {},
    steps: [
      {
        message: "Hi, I run a dental clinic and want to automate WhatsApp.",
      },
      {
        message: "We have about 500 patients a month.",
      }
    ]
  },
  {
    id: "pricing-prospect",
    name: "Pricing Prospect",
    description: "Simulate a user asking about high-volume message costs.",
    initialVariables: {},
    steps: [
      {
        message: "How much does it cost for 5,000 messages?",
      }
    ]
  },
  {
    id: "angry-customer",
    name: "Angry Customer",
    description: "Test AI professionalism and escalation logic with an upset user.",
    initialVariables: {},
    steps: [
      {
        message: "My bot is broken and I'm losing money! Fix it now!",
      }
    ]
  },
  {
    id: "demo-request",
    name: "Demo Request",
    description: "Test the walkthrough booking flow and calendar logic.",
    initialVariables: {},
    steps: [
      {
        message: "Can I book a walkthrough?",
      }
    ]
  },
  {
    id: "competitor-comparison",
    name: "Competitor Comparison",
    description: "Test objection handling against platforms like ManyChat.",
    initialVariables: {},
    steps: [
      {
        message: "Why should I switch from ManyChat?",
      }
    ]
  },
  {
    id: "omnichannel-continuity",
    name: "Omnichannel Continuity",
    description: "Verify context is preserved across simulated channels.",
    initialVariables: {
      sync_hash: "sim-session-123"
    },
    steps: [
      {
        message: "I started this on web, continuing here.",
      }
    ]
  },
  {
    id: "ai-fallback-stress",
    name: "AI Fallback Stress Test",
    description: "Test hallucination resistance with random unexpected questions.",
    initialVariables: {},
    steps: [
      {
        message: "What is the capital of Mars?",
      }
    ]
  },
  {
    id: "enterprise-prospect",
    name: "Enterprise Prospect",
    description: "Simulate high-volume lead for enterprise routing validation.",
    initialVariables: {},
    steps: [
      {
        message: "I represent a company with 1M+ monthly users.",
      }
    ]
  },
  {
    id: "lead-abandonment",
    name: "Lead Abandonment Recovery",
    description: "Test follow-up logic when user stops responding.",
    initialVariables: {
      last_interaction_at: new Date(Date.now() - 3600000).toISOString()
    },
    steps: [
      {
        message: "[SYSTEM_WAIT_SIMULATION]",
      }
    ]
  },
  {
    id: "human-handoff",
    name: "Human Handoff",
    description: "Verify AI pause and handoff state triggering.",
    initialVariables: {},
    steps: [
      {
        message: "I want to speak to a real person.",
      }
    ]
  }
];
