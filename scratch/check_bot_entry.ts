import { prisma } from "../lib/prisma";
import "dotenv/config";

async function checkBotEntryFlow() {
  const tenantId = "cmox3h0uw000013nwaubo2wm8";
  
  const bot = await prisma.bot.findFirst({
    where: { tenantId },
    select: { id: true, name: true, entryFlow: true }
  });

  console.log(JSON.stringify(bot, null, 2));
}

checkBotEntryFlow();
