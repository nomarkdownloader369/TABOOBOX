import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const categories = [
  "action",
  "drama",
  "thriller",
  "horror",
  "documentary",
  "music",
  "sports",
  "classic",
] as const;
const metadataSchema = z.object({
  titleEn: z.string().min(1).max(120),
  titleAr: z.string().min(1).max(120),
  descriptionEn: z.string().min(1).max(1200),
  descriptionAr: z.string().min(1).max(1200),
  category: z.enum(categories),
  tags: z.array(z.string().min(1).max(40)).max(10),
});

function safePublicThumbnail(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "i.ytimg.com" ||
      url.username ||
      url.password ||
      url.port
    )
      return undefined;
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return undefined;
  }
}

export const generateVideoMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ embed: z.string().url().max(500), thumbnail: z.string().max(1000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Only admins can generate video metadata.");

    const embedUrl = new URL(data.embed);
    const publicThumbnail = safePublicThumbnail(data.thumbnail);
    const content = [
      {
        type: "text" as const,
        text: `Video host: ${embedUrl.hostname}\nCreate concise, appealing metadata without claiming visual details that are not evident from the supplied thumbnail. Return clear English and Egyptian Arabic, and choose one allowed category.`,
      },
      ...(publicThumbnail ? [{ type: "image" as const, image: publicThumbnail }] : []),
    ];

    try {
      const { generateText, Output } = await import("ai");
      const result = await generateText({
        model: "google/gemini-3.8-flash",
        instructions:
          "You generate neutral, concise catalog metadata for a private adult-content video archive. Do not produce explicit sexual descriptions, infer age or consent, invent a specific scene, or claim the video was reviewed or published. The admin will review every field before saving.",
        messages: [{ role: "user", content }],
        output: Output.object({ schema: metadataSchema }),
        maxOutputTokens: 500,
        temperature: 0.3,
      });
      return metadataSchema.parse(result.output);
    } catch {
      throw new Error(
        "AI metadata generation failed. Your video is still saved in the review queue.",
      );
    }
  });
