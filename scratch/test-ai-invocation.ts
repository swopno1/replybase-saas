import { getAiModel } from "../lib/ai-service";
import { generateText } from "ai";
import * as dotenv from "dotenv";
import { join } from "path";

// Load environment variables from .env
dotenv.config({ path: join(__dirname, "../.env") });

async function testAiInvocation() {
  console.log("--- Starting AI Invocation Test (DigitalOcean) ---");
  
  try {
    const model = getAiModel({
      provider: "digitalocean",
      task: "chat",
    });

    console.log("Invoking model with prompt: 'Hello, are you online?'...");
    
    const result = await generateText({
      model,
      prompt: "Hello, are you online? Respond with 'YES' if you can hear me.",
      max_tokens: 20,
    } as any);

    console.log("--- SUCCESS ---");
    console.log("Model:", result.response.modelId);
    console.log("Response:", result.text);
    console.log("Usage:", result.usage);

  } catch (error: any) {
    console.error("--- FAILURE ---");
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    if (error.cause) console.error("Cause:", error.cause);
    if (error.url) console.error("Failed URL:", error.url);
  }
}

testAiInvocation();
