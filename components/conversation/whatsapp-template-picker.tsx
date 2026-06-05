"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ChevronRight, AlertCircle } from "lucide-react";

interface TemplateComponentDef {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text: string }>;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: TemplateComponentDef[];
}

interface Props {
  conversationId: string;
  botId: string;
  onSent: () => void;
  onCancel: () => void;
}

// Extract {{N}} placeholders from a template body text
function extractPlaceholders(text: string): number[] {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)];
  const indices = [...new Set(matches.map((m) => parseInt(m[1], 10)))];
  return indices.sort((a, b) => a - b);
}

// Replace {{N}} in text with actual values
function fillPlaceholders(text: string, values: Record<number, string>): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => values[parseInt(n, 10)] || `{{${n}}}`);
}

function getBodyText(components: TemplateComponentDef[]): string | null {
  return components.find((c) => c.type === "BODY")?.text ?? null;
}

function getHeaderText(components: TemplateComponentDef[]): string | null {
  const header = components.find((c) => c.type === "HEADER");
  if (header?.format === "TEXT") return header.text ?? null;
  return null;
}

function getCategoryColor(category: string) {
  if (category === "MARKETING") return "bg-purple-100 text-purple-700";
  if (category === "UTILITY") return "bg-blue-100 text-blue-700";
  if (category === "AUTHENTICATION") return "bg-orange-100 text-orange-700";
  return "bg-gray-100 text-gray-700";
}

export function WhatsAppTemplatePicker({ conversationId, botId, onSent, onCancel }: Props) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<WhatsAppTemplate | null>(null);
  const [paramValues, setParamValues] = useState<Record<number, string>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bots/${botId}/channels/whatsapp/templates`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setFetchError(data.error);
        } else {
          setTemplates(data.templates ?? []);
        }
      })
      .catch(() => setFetchError("Failed to load templates"))
      .finally(() => setLoading(false));
  }, [botId]);

  const bodyText = selected ? getBodyText(selected.components) : null;
  const headerText = selected ? getHeaderText(selected.components) : null;
  const placeholders = bodyText ? extractPlaceholders(bodyText) : [];

  const handleSelect = (t: WhatsAppTemplate) => {
    setSelected(t);
    setParamValues({});
    setSendError(null);
  };

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    setSendError(null);

    const components = [];

    if (headerText && extractPlaceholders(headerText).length > 0) {
      components.push({
        type: "header" as const,
        parameters: extractPlaceholders(headerText).map((n) => ({
          type: "text" as const,
          text: paramValues[n] ?? "",
        })),
      });
    }

    if (bodyText && placeholders.length > 0) {
      components.push({
        type: "body" as const,
        parameters: placeholders.map((n) => ({
          type: "text" as const,
          text: paramValues[n] ?? "",
        })),
      });
    }

    try {
      const response = await fetch(`/api/conversations/${conversationId}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: selected.name,
          languageCode: selected.language,
          components: components.length > 0 ? components : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to send template");
      }

      onSent();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Failed to send template");
    } finally {
      setSending(false);
    }
  };

  const canSend =
    selected !== null &&
    placeholders.every((n) => (paramValues[n] ?? "").trim().length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading templates…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-4 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 flex gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Could not load templates</p>
          <p className="text-red-600">{fetchError}</p>
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="p-4 rounded-md bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
        <p className="font-medium mb-1">No approved templates found</p>
        <p>Create and submit message templates in your WhatsApp Business Manager. They must be approved by Meta before appearing here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!selected ? (
        <>
          <p className="text-xs text-muted-foreground">
            Select an approved template to send. Templates can reach contacts outside the 24-hour window.
          </p>
          <ScrollArea className="max-h-60 rounded-md border">
            <div className="divide-y">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  className="w-full flex items-start justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium truncate">{t.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCategoryColor(t.category)}`}>
                        {t.category}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t.language}</Badge>
                    </div>
                    {getBodyText(t.components) && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {getBodyText(t.components)}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 ml-2" />
                </button>
              ))}
            </div>
          </ScrollArea>
        </>
      ) : (
        <>
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono font-medium">{selected.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCategoryColor(selected.category)}`}>
                {selected.category}
              </span>
            </div>
            {headerText && (
              <p className="font-medium text-xs text-muted-foreground">
                {fillPlaceholders(headerText, paramValues)}
              </p>
            )}
            {bodyText && (
              <p className="text-xs whitespace-pre-wrap leading-relaxed">
                {fillPlaceholders(bodyText, paramValues)}
              </p>
            )}
          </div>

          {placeholders.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Fill in template variables:</p>
              {placeholders.map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <Label className="text-xs w-10 shrink-0 text-muted-foreground">{`{{${n}}}`}</Label>
                  <Input
                    className="h-7 text-xs"
                    placeholder={`Value for {{${n}}}`}
                    value={paramValues[n] ?? ""}
                    onChange={(e) =>
                      setParamValues((prev) => ({ ...prev, [n]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {sendError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {sendError}
            </p>
          )}

          <div className="flex justify-between items-center">
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              ← Back to templates
            </button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} disabled={sending}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSend} disabled={sending || !canSend}>
                {sending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Sending…
                  </>
                ) : (
                  "Send Template"
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
