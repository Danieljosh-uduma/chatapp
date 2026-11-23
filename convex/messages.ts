import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const list = query({
    args: { room: v.string() },
    handler: async (ctx, { room }) => {
        return await ctx.db
            .query("messages")
            .filter((q) => q.eq(q.field("room"), room))
            .order("desc")
            .take(100);
    },
});

export const send = mutation({
    args: { body: v.string(), author: v.string(), room: v.string(), imageStorageId: v.optional(v.id("_storage")) },
    handler: async (ctx, { body, author, room, imageStorageId }) => {
        let imageUrl: string | undefined;
        if (imageStorageId) {
            imageUrl = (await ctx.storage.getUrl(imageStorageId)) ?? undefined;
        }
        await ctx.db.insert("messages", { body, author, room, imageUrl });

        // Update metadata for participants to track conversation order
        const participants = room.split('_');
        for (const userId of participants) {
            const user = await ctx.db.get(userId as Id<"users">);
            if (!user) continue;

            const existing = await ctx.db
                .query("userRoomMetadata")
                .withIndex("by_user_room", (q) => q.eq("userId", user._id).eq("room", room))
                .unique();

            const now = Date.now();
            if (existing) {
                await ctx.db.patch(existing._id, { lastMessageTime: now });
            } else {
                await ctx.db.insert("userRoomMetadata", {
                    userId: user._id,
                    room,
                    lastReadTime: 0,
                    lastMessageTime: now,
                });
            }
        }
    },
});

export const generateMessageUploadUrl = mutation(async (ctx) => {
    return await ctx.storage.generateUploadUrl();
});
