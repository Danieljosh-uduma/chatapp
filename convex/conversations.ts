import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const listMyConversationsPaginated = query({
    args: { userId: v.id("users"), paginationOpts: paginationOptsValidator },
    handler: async (ctx, args) => {
        const metadataPage = await ctx.db
            .query("userRoomMetadata")
            .withIndex("by_user_time", (q) => q.eq("userId", args.userId))
            .order("desc")
            .paginate(args.paginationOpts);

        const page = await Promise.all(
            metadataPage.page.map(async (meta) => {
                const partnerId = meta.room.split('_').find(id => id !== args.userId);
                const partner = await ctx.db.get(partnerId as any);
                if (!partner) return null;

                // Find last message
                const lastMsg = await ctx.db
                    .query("messages")
                    .withIndex("by_room", (q) => q.eq("room", meta.room))
                    .order("desc")
                    .first();

                if (!lastMsg) return null;

                const lastReadTime = meta.lastReadTime ?? 0;

                // Count unread messages
                // Scaling note: Still counting manually, but limited per room
                const unreadMessages = await ctx.db
                    .query("messages")
                    .withIndex("by_room", (q) => q.eq("room", meta.room))
                    .filter((q) => q.gt(q.field("_creationTime"), lastReadTime))
                    .collect();

                const currentUser = await ctx.db.get(args.userId);
                const unreadCount = unreadMessages.filter(m => m.author !== currentUser?.name).length;

                return {
                    partner,
                    lastMessage: lastMsg,
                    unreadCount,
                };
            })
        );

        return {
            ...metadataPage,
            page: page.filter((i): i is NonNullable<typeof i> => i !== null),
        };
    },
});

export const listMyConversations = query({
    // ... existing listMyConversations (keep for compatibility if needed, but we'll probably switch UI)
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        // Find all messages involving this user
        // Scaling note: We scan all messages here which is fine for small apps, 
        // but in production you'd use a dedicated 'conversationMembers' table.
        const allMessages = await ctx.db.query("messages").collect();

        const roomsMap = new Map<string, any>();

        allMessages.forEach(msg => {
            if (msg.room.includes(args.userId)) {
                const existing = roomsMap.get(msg.room);
                if (!existing || msg._creationTime > existing._creationTime) {
                    roomsMap.set(msg.room, msg);
                }
            }
        });

        const conversations: any[] = [];
        for (const [room, lastMsg] of roomsMap.entries()) {
            const partnerId = room.split('_').find(id => id !== args.userId);
            if (!partnerId) continue;

            const partner = await ctx.db.get(partnerId as any);
            if (!partner) continue;

            const metadata = await ctx.db
                .query("userRoomMetadata")
                .withIndex("by_user_room", (q) => q.eq("userId", args.userId).eq("room", room))
                .unique();

            const currentUser = await ctx.db.get(args.userId);
            const lastReadTime = metadata?.lastReadTime ?? 0;

            // Count messages in this room created after lastReadTime
            const unreadCount = allMessages.filter(m =>
                m.room === room &&
                m.author !== currentUser?.name && // Only count others' messages
                m._creationTime > lastReadTime
            ).length;

            conversations.push({
                partner,
                lastMessage: lastMsg,
                unreadCount,
            });
        }

        // Sort by last message time descending
        return conversations.sort((a, b) => b.lastMessage._creationTime - a.lastMessage._creationTime);
    },
});

export const markRead = mutation({
    args: { userId: v.id("users"), room: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("userRoomMetadata")
            .withIndex("by_user_room", (q) => q.eq("userId", args.userId).eq("room", args.room))
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, { lastReadTime: Date.now() });
        } else {
            await ctx.db.insert("userRoomMetadata", {
                userId: args.userId,
                room: args.room,
                lastReadTime: Date.now(),
            });
        }
    },
});
