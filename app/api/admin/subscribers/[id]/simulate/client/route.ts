import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSystemModel } from "@/lib/ai-service";
import { generateText } from "ai";
import { SIMULATION_SCENARIOS } from "@/lib/simulation-scenarios";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  // Ensure only admins can run simulations
  if (!session?.user?.id || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "SUPERADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { history, scenarioId } = body;

  const scenario = SIMULATION_SCENARIOS.find((s) => s.id === scenarioId);

  let systemPrompt = "";
  if (scenario) {
    systemPrompt = `You are simulating a customer/client conversing with an automated business chatbot.
Your goal is to stay fully in character based on the following test scenario:

Scenario Name: ${scenario.name}
Description: ${scenario.description}

Rules for your responses:
1. Speak as the customer. Keep your messages concise, natural, and realistic for a chat channel (like WhatsApp or Web Chat).
2. Do not reveal you are an AI. Do not act as the support bot; you are the customer seeking help, information, or complaining.
3. Be reactive to what the bot says. If the bot asks a question (like name, email, or details), answer realistically.
4. Follow the progression of the scenario naturally.
5. If the conversation has completed its goals or reached a natural endpoint, you can ask a follow-up question or conclude naturally.

Here is the conversation history so far:
${(history || []).map((m: any) => `${m.role === 'user' ? 'CUSTOMER' : 'BOT'}: ${m.text}`).join('\n')}

Generate the next single response from the CUSTOMER. Return ONLY the plain text of the message, without prefixing it with 'CUSTOMER:' or anything else.`;
  } else {
    systemPrompt = `You are simulating a customer/client conversing with an automated business chatbot.
Your goal is to act as a normal prospect or customer looking for assistance.

Rules for your responses:
1. Speak as the customer. Keep your messages concise, natural, and realistic for a chat channel (like WhatsApp or Web Chat).
2. Do not reveal you are an AI. Do not act as the support bot; you are the customer.
3. Be reactive to what the bot says.

Here is the conversation history so far:
${(history || []).map((m: any) => `${m.role === 'user' ? 'CUSTOMER' : 'BOT'}: ${m.text}`).join('\n')}

Generate the next single response from the CUSTOMER. Return ONLY the plain text of the message, without prefixing it with 'CUSTOMER:' or anything else.`;
  }

  try {
    const model = getSystemModel({ task: "chat" });
    const { text } = await generateText({
      model,
      prompt: systemPrompt,
    });

    return NextResponse.json({
      success: true,
      message: text.trim(),
    });
  } catch (error: any) {
    console.error("[SimulationClientAPI] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to generate client message",
    }, { status: 500 });
  }
}
