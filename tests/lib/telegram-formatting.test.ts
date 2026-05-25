import { describe, it, expect } from "vitest";
import { formatTelegramText } from "@/lib/telegram-api";

describe("formatTelegramText", () => {
  it("should escape HTML entities correctly", () => {
    const input = "Check out this & that <script>alert(1)</script>";
    const output = formatTelegramText(input);
    expect(output).toBe("Check out this &amp; that &lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("should format markdown links to Telegram HTML links", () => {
    const input = "Click [here](https://example.com/a&b)";
    const output = formatTelegramText(input);
    expect(output).toBe('Click <a href="https://example.com/a&amp;b">here</a>');
  });

  it("should format bold markers to Telegram HTML bold tags", () => {
    const input = "This is **bold** and this is also **bold**";
    const output = formatTelegramText(input);
    expect(output).toBe("This is <b>bold</b> and this is also <b>bold</b>");
  });

  it("should handle mixed formatting correctly", () => {
    const input = "Visit **[Google](https://google.com)** & search!";
    const output = formatTelegramText(input);
    expect(output).toBe('Visit <b><a href="https://google.com">Google</a></b> &amp; search!');
  });

  it("should handle complex pricing text", () => {
    const input = "🚀 **Launch (£29/mo):** 1,000 AI responses/mo & more!";
    const output = formatTelegramText(input);
    expect(output).toBe("🚀 <b>Launch (£29/mo):</b> 1,000 AI responses/mo &amp; more!");
  });
});
