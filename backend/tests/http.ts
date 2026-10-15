import { createServer, type Server } from "node:http";

import type { Express } from "express";

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export async function withHttp(app: Express, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    await closeServer(server);
    throw new Error("Test server did not bind to a port");
  }
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await closeServer(server);
  }
}
