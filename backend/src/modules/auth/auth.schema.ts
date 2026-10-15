import { z } from "zod";

export const loginBodySchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(10, "Password must be at least 10 characters"),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
