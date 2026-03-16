type JsonRecord = Record<string, unknown>;

type PiiMode = "retain" | "mask" | "drop";

const PII_KEY_PATTERN =
  /(email|phone|mobile|name|first[_-]?name|last[_-]?name|full[_-]?name|address|user[_-]?agent|ip|fingerprint)/i;

function getPiiMode(): PiiMode {
  const raw = process.env.WEBCHAT_PII_RETENTION_MODE?.trim().toLowerCase();
  if (raw === "mask" || raw === "drop" || raw === "retain") {
    return raw;
  }

  return "retain";
}

function maskValue(value: unknown): unknown {
  if (typeof value === "string") {
    return "[redacted]";
  }

  if (typeof value === "number") {
    return 0;
  }

  if (typeof value === "boolean") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.map(maskValue);
  }

  if (value && typeof value === "object") {
    return sanitizeRecord(value as JsonRecord, "mask");
  }

  return null;
}

function sanitizeRecord(input: JsonRecord, mode: PiiMode): JsonRecord {
  const output: JsonRecord = {};

  for (const [key, value] of Object.entries(input)) {
    if (mode === "drop" && PII_KEY_PATTERN.test(key)) {
      continue;
    }

    if (mode === "mask" && PII_KEY_PATTERN.test(key)) {
      output[key] = maskValue(value);
      continue;
    }

    if (Array.isArray(value)) {
      output[key] = value.map((entry) => {
        if (entry && typeof entry === "object") {
          return sanitizeRecord(entry as JsonRecord, mode);
        }

        if (mode === "mask" && PII_KEY_PATTERN.test(key)) {
          return maskValue(entry);
        }

        return entry;
      });
      continue;
    }

    if (value && typeof value === "object") {
      output[key] = sanitizeRecord(value as JsonRecord, mode);
      continue;
    }

    output[key] = value;
  }

  return output;
}

export function sanitizeWebchatMetadataForRetention<T>(value: T): T {
  const mode = getPiiMode();
  if (mode === "retain") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (entry && typeof entry === "object") {
        return sanitizeRecord(entry as JsonRecord, mode);
      }
      return entry;
    }) as T;
  }

  return sanitizeRecord(value as JsonRecord, mode) as T;
}

export function sanitizeWebchatContactForRetention(input?: {
  name?: string;
  email?: string;
  phone?: string;
}):
  | {
      name?: string;
      email?: string;
      phone?: string;
    }
  | undefined {
  if (!input) {
    return undefined;
  }

  const mode = getPiiMode();

  if (mode === "drop") {
    return undefined;
  }

  if (mode === "mask") {
    return {
      name: input.name ? "[redacted]" : undefined,
      email: input.email ? "[redacted]" : undefined,
      phone: input.phone ? "[redacted]" : undefined,
    };
  }

  return input;
}

export function getWebchatPiiRetentionMode() {
  return getPiiMode();
}
