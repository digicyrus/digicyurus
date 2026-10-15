import { pinoHttp } from "pino-http";

import { logger } from "../lib/logger.js";

export const requestLogger = pinoHttp({
  logger,
  quietReqLogger: true,
  customSuccessMessage: () => "request completed",
  customErrorMessage: () => "request failed",
  serializers: {
    req(request) {
      const path = request.url?.split("?")[0] ?? "";
      return { method: request.method, path };
    },
    res(response) {
      return { statusCode: response.statusCode };
    },
  },
});
