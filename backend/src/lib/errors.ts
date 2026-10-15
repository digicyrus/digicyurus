export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export class ConfigError extends Error {
  readonly code = "INVALID_CONFIGURATION";

  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export type ErrorBody = {
  data: null;
  error: {
    code: string;
    message: string;
    fields: Record<string, string>;
  };
};

export function errorBody(code: string, message: string, fields: Record<string, string> = {}): ErrorBody {
  return {
    data: null,
    error: { code, message, fields },
  };
}
