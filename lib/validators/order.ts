import { z } from "zod";

export const createOrderSchema = z.object({
  site_id: z.string().uuid(),
  slot_id: z.string().uuid().optional(),
  order_type: z.enum(["exchange", "paid"]),
  buyer_site_id: z.string().uuid().optional(), // required when order_type = exchange
  target_url: z.string().url(),
  anchor_text: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
