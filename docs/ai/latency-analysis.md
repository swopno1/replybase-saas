# Latency Analysis: AI Inference

## Objectives
Minimize the "Time to First Token" (TTFT) for Webchat and WhatsApp users to maintain engagement.

## Benchmarks (Target)
- **DO Llama 3.1 8B**: < 300ms TTFT
- **DO Llama 3.1 70B**: < 600ms TTFT
- **GPT-4o-mini**: < 400ms TTFT

## Latency Reduction Strategies
1. **Regional Proximity**: Deploying ReplyBase App in DO `lon1` (London) and using Inference in the same region where available.
2. **Streaming**: Always use `streamText` from Vercel AI SDK to show immediate progress.
3. **Prompt Caching**: Utilize DigitalOcean's prompt caching features (if supported) for large system prompts in `ai-fallback.ts`.
4. **Small Models for Extraction**: Use 8B models for `generateObject` tasks to ensure rapid JSON extraction.
