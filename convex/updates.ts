import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const create = mutation({
    args: {
        authorId: v.id("users"),
        authorName: v.string(),
        title: v.string(),
        body: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("updates", {
            authorId: args.authorId,
            authorName: args.authorName,
            title: args.title,
            body: args.body,
            likes: [],
        });
    },
});

export const listPaginated = query({
    args: {
        paginationOpts: paginationOptsValidator,
        threshold: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const twentyFourHoursAgo = args.threshold ?? (Date.now() - 24 * 60 * 60 * 1000);

        const updatesPage = await ctx.db
            .query("updates")
            .filter((q) => q.gt(q.field("_creationTime"), twentyFourHoursAgo))
            .order("desc")
            .paginate(args.paginationOpts);

        // Enriched updates with comments
        const page = await Promise.all(
            updatesPage.page.map(async (update) => {
                const comments = await ctx.db
                    .query("updateComments")
                    .withIndex("by_update", (q) => q.eq("updateId", update._id))
                    .collect();
                return { ...update, comments };
            })
        );

        return { ...updatesPage, page };
    },
});

export const list = query({
    args: {},
    handler: async (ctx) => {
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

        const updates = await ctx.db
            .query("updates")
            .filter((q) => q.gt(q.field("_creationTime"), twentyFourHoursAgo))
            .order("desc")
            .collect();

        // Enriched updates with comments
        const enrichedUpdates = await Promise.all(
            updates.map(async (update) => {
                const comments = await ctx.db
                    .query("updateComments")
                    .withIndex("by_update", (q) => q.eq("updateId", update._id))
                    .collect();
                return { ...update, comments };
            })
        );

        return enrichedUpdates;
    },
});

export const toggleLike = mutation({
    args: {
        updateId: v.id("updates"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const update = await ctx.db.get(args.updateId);
        if (!update) throw new Error("Update not found");

        const userIdStr = args.userId.toString();
        const likes = [...update.likes];
        const index = likes.indexOf(userIdStr);

        if (index === -1) {
            likes.push(userIdStr);
        } else {
            likes.splice(index, 1);
        }

        await ctx.db.patch(args.updateId, { likes });
    },
});

export const addComment = mutation({
    args: {
        updateId: v.id("updates"),
        authorId: v.id("users"),
        authorName: v.string(),
        body: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("updateComments", {
            updateId: args.updateId,
            authorId: args.authorId,
            authorName: args.authorName,
            body: args.body,
        });
    },
});

export const remove = mutation({
    args: {
        updateId: v.id("updates"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const update = await ctx.db.get(args.updateId);
        if (!update) throw new Error("Update not found");

        // Security check: only author can delete
        if (update.authorId !== args.userId) {
            throw new Error("Unauthorized: Only the author can delete this update");
        }

        // Delete associated comments
        const comments = await ctx.db
            .query("updateComments")
            .withIndex("by_update", (q) => q.eq("updateId", args.updateId))
            .collect();

        for (const comment of comments) {
            await ctx.db.delete(comment._id);
        }

        // Delete the update itself
        await ctx.db.delete(args.updateId);
    },
});
