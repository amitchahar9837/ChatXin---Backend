import { z } from "zod";

export const sendMessageSchema = z
  .object({
    text: z.string().trim().max(2000).optional(),
    image: z.string().optional(),
  })
  .refine((data) => data.text || data.image, {
    message: "Message must have either text or an image.",
    path: ["text"],
  });
