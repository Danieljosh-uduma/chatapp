import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const signUp = mutation({
    args: {
        name: v.string(),
        email: v.string(),
        password: v.string(),
        location: v.string(),
        image: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", args.email))
            .unique();
        if (existing) throw new Error("User already exists");

        return await ctx.db.insert("users", {
            name: args.name,
            email: args.email,
            password: args.password, // IMPORTANT: In prod, use password hashing
            location: args.location,
            image: args.image,
        });
    },
});

export const signIn = mutation({
    args: {
        email: v.string(),
        password: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", args.email))
            .unique();

        if (!user || user.password !== args.password) {
            throw new Error("Invalid email or password");
        }

        // Update last seen on login
        await ctx.db.patch(user._id, { lastSeen: Date.now() });
        return { ...user, lastSeen: Date.now() };
    },
});

export const updatePresence = mutation({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.userId, { lastSeen: Date.now() });
    },
});

export const listByLocation = query({
    args: { location: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("users")
            .withIndex("by_location", (q) => q.eq("location", args.location))
            .collect();
    },
});

export const getById = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.userId);
    },
});

export const getMe = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.userId);
    },
});

export const updateProfile = mutation({
    args: {
        userId: v.id("users"),
        name: v.string(),
        gender: v.string(),
        image: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.userId, {
            name: args.name,
            gender: args.gender,
            image: args.image,
        });
        return await ctx.db.get(args.userId);
    },
});

export const generateUploadUrl = mutation(async (ctx) => {
    return await ctx.storage.generateUploadUrl();
});

export const updateProfileImage = mutation({
    args: {
        userId: v.id("users"),
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        const imageUrl = await ctx.storage.getUrl(args.storageId);
        if (!imageUrl) throw new Error("Failed to get image URL");

        await ctx.db.patch(args.userId, {
            image: imageUrl,
        });

        return await ctx.db.get(args.userId);
    },
});

export const listAllPaginated = query({
    args: { paginationOpts: paginationOptsValidator },
    handler: async (ctx, args) => {
        return await ctx.db.query("users").order("desc").paginate(args.paginationOpts);
    },
});

export const listAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("users").collect();
    },
});
