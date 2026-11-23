import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        name: v.string(),
        email: v.string(),
        password: v.string(),
        location: v.string(),
        image: v.optional(v.string()),
        gender: v.optional(v.string()),
        lastSeen: v.optional(v.number()),
    })
        .index("by_email", ["email"])
        .index("by_location", ["location"]),

    messages: defineTable({
        body: v.string(),
        author: v.string(),
        room: v.string(),
        imageUrl: v.optional(v.string()),
    }).index("by_room", ["room"]),

    userRoomMetadata: defineTable({
        userId: v.id("users"),
        room: v.string(),
        lastReadTime: v.number(),
        lastMessageTime: v.optional(v.number()),
    })
        .index("by_user_room", ["userId", "room"])
        .index("by_user_time", ["userId", "lastMessageTime"]),

    updates: defineTable({
        authorId: v.id("users"),
        authorName: v.string(),
        title: v.string(),
        body: v.string(),
        likes: v.array(v.string()), // userIds of people who liked
    }),

    updateComments: defineTable({
        updateId: v.id("updates"),
        authorId: v.id("users"),
        authorName: v.string(),
        body: v.string(),
    }).index("by_update", ["updateId"]),
});
