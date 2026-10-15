const SECRET_KEY = /password|passwd|token|cookie|secret|hash|authorization|credential|cvv|pan|card/i;

export function redact(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) continue;
    output[key] = redactValue(item);
  }
  return output;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) continue;
    output[key] = redactValue(item);
  }
  return output;
}
