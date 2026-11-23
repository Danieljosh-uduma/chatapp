"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useConvexConnectionState, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Send, User, Sparkles, LogOut, Search, Video, Phone, MoreVertical, LayoutGrid, MessageSquare, PhoneCall, Flame, Settings, ChevronLeft, Globe, Bell, WifiOff, Trash2, AlertCircle, Camera, Loader2, Paperclip, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Auth from "./Auth";

export default function Chat() {
    const [currentUser, setCurrentUser] = useState<any>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('aura_user');
            if (saved) return JSON.parse(saved);
        }
        return null;
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [activeContactId, setActiveContactId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'chat'>('list');
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [newMessageText, setNewMessageText] = useState("");
    const [activeTab, setActiveTab] = useState<'chats' | 'find' | 'updates'>('chats');
    const connectionState = useConvexConnectionState();
    const isDisconnected = !connectionState.isWebSocketConnected;
    const [showReconnected, setShowReconnected] = useState(false);
    const lastConnectionRef = useRef(connectionState.isWebSocketConnected);

    useEffect(() => {
        if (!lastConnectionRef.current && connectionState.isWebSocketConnected) {
            setShowReconnected(true);
            const timer = setTimeout(() => setShowReconnected(false), 3000);
            return () => clearTimeout(timer);
        }
        lastConnectionRef.current = connectionState.isWebSocketConnected;
    }, [connectionState.isWebSocketConnected]);

    // Helper to generate unique room ID
    const getRoomId = (id1: string, id2: string) => {
        return [id1, id2].sort().join('_');
    };

    // Discovery: Fetch all users system-wide
    const { results: allUsersPage, status: allUsersStatus, loadMore: loadMoreUsers } = usePaginatedQuery(
        (api as any).users.listAllPaginated,
        {},
        { initialNumItems: 20 }
    );

    // Active Chats: Fetch users you have messaged
    const { results: activeChatsPage, status: activeChatsStatus, loadMore: loadMoreChats } = usePaginatedQuery(
        (api as any).conversations.listMyConversationsPaginated,
        currentUser ? { userId: currentUser._id } : "skip",
        { initialNumItems: 20 }
    );

    const getRelativeTime = (time: number) => {
        const diff = Date.now() - time;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'just now';
    };

    const getContacts = () => {
        const source = activeTab === 'chats' ? (activeChatsPage || []) : (allUsersPage || []).map((u: any) => ({ partner: u, lastMessage: null, unreadCount: 0 }));

        const formatStatus = (lastSeen?: number) => {
            if (!lastSeen) return "Offline";
            const diff = Date.now() - lastSeen;
            if (diff < 5 * 60 * 1000) return "Online";
            return `Last seen ${new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        };

        return (source as any[])
            .filter((item: any) => (item.partner?._id || item._id) !== currentUser?._id)
            .map((item: any) => {
                const u = item.partner || item;
                const authorPrefix = item.lastMessage
                    ? (item.lastMessage.author === currentUser.name ? "You: " : `${item.lastMessage.author}: `)
                    : "";

                return {
                    id: u._id,
                    name: u.name,
                    image: u.image || null,
                    status: formatStatus(u.lastSeen),
                    location: u.location || 'Unknown',
                    time: item.lastMessage ? new Date(item.lastMessage._creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "now",
                    msg: item.lastMessage ? `${authorPrefix}${item.lastMessage.body}` : (activeTab === 'chats' ? "Continue chatting..." : `Location: ${u.location || 'Unknown'}`),
                    unreadCount: item.unreadCount || 0,
                };
            });
    };

    const contacts = getContacts();

    const filteredContacts = contacts.filter((c: any) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeContact = contacts.find((c: any) => c.id === activeContactId) || contacts[0];

    const messages = useQuery(
        api.messages.list,
        (currentUser && activeContact) ? { room: getRoomId(currentUser._id, activeContact.id) } : "skip"
    );
    const sendMessage = useMutation(api.messages.send);
    const updatePresence = useMutation(api.users.updatePresence);
    const markRead = useMutation((api as any).conversations.markRead);
    const updateProfile = useMutation((api as any).users.updateProfile);
    const [updatesThreshold] = useState(() => Date.now() - 24 * 60 * 60 * 1000);

    // Updates Feature
    const { results: updatesPage, status: updatesStatus, loadMore: loadMoreUpdates } = usePaginatedQuery(
        (api as any).updates.listPaginated,
        { threshold: updatesThreshold },
        { initialNumItems: 20 }
    );
    const updates = updatesPage; // Alias for backward compatibility in render
    const createUpdate = useMutation((api as any).updates.create);
    const toggleLikeUpdate = useMutation((api as any).updates.toggleLike);
    const addUpdateComment = useMutation((api as any).updates.addComment);
    const removeUpdate = useMutation((api as any).updates.remove);

    const [showCreateUpdate, setShowCreateUpdate] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [editName, setEditName] = useState("");
    const [editGender, setEditGender] = useState("");
    const [editImage, setEditImage] = useState("");
    const [newUpdateTitle, setNewUpdateTitle] = useState("");
    const [newUpdateBody, setNewUpdateBody] = useState("");
    const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
    const [viewingUserId, setViewingUserId] = useState<any>(null);
    const [confirmDialog, setConfirmDialog] = useState<{
        show: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type?: 'danger' | 'info';
        confirmText?: string;
    }>({ show: false, title: '', message: '', onConfirm: () => { } });

    const [uploading, setUploading] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const msgImageInputRef = useRef<HTMLInputElement>(null);
    const generateUploadUrl = useMutation(api.users.generateUploadUrl);
    const updateProfileImage = useMutation(api.users.updateProfileImage);
    const generateMessageUploadUrl = useMutation((api as any).messages.generateMessageUploadUrl);
    const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
    const [sendingImage, setSendingImage] = useState(false);
    const fullViewingUser = useQuery(api.users.getById, viewingUserId ? { userId: viewingUserId } : "skip");

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (scrollRef.current) {
            // In flex-col-reverse, scrollTop: 0 is the bottom
            scrollRef.current.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    }, [messages]);

    // Save session to localStorage
    useEffect(() => {
        if (currentUser) {
            localStorage.setItem('aura_user', JSON.stringify(currentUser));
        } else {
            localStorage.removeItem('aura_user');
        }
    }, [currentUser]);

    // Heartbeat to update presence
    useEffect(() => {
        if (!currentUser) return;

        // Initial update
        updatePresence({ userId: currentUser._id }).catch(console.error);

        // Then every 1 minute
        const interval = setInterval(() => {
            updatePresence({ userId: currentUser._id }).catch(console.error);
        }, 60 * 1000);

        return () => clearInterval(interval);
    }, [currentUser, updatePresence]);

    // Update draft whenever text changes
    const handleTextChange = (text: string) => {
        setNewMessageText(text);
        if (activeContactId) {
            setDrafts(prev => ({ ...prev, [activeContactId]: text }));
        }
    };

    // Load draft when contact changes
    useEffect(() => {
        if (activeContactId) {
            setNewMessageText(drafts[activeContactId] || "");
        }
    }, [activeContactId]);


    const handleSelectContact = (id: string) => {
        setActiveContactId(id);
        setViewMode('chat');
        if (currentUser) {
            markRead({ userId: currentUser._id, room: getRoomId(currentUser._id, id) });
        }
    };

    // Auto-mark as read when messages arrive in active room
    useEffect(() => {
        if (currentUser && activeContactId && messages && messages.length > 0 && viewMode === 'chat') {
            markRead({ userId: currentUser._id, room: getRoomId(currentUser._id, activeContactId) });
        }
    }, [messages, activeContactId, currentUser, markRead, viewMode]);

    // Auto-focus input when entering a chat
    useEffect(() => {
        if (viewMode === 'chat' && activeContactId) {
            // Use a small timeout to ensure the elements are rendered and visible
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [viewMode, activeContactId]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        try {
            const updatedUser = await updateProfile({
                userId: currentUser._id,
                name: editName,
                gender: editGender,
                // Always use currentUser.image so we never overwrite a freshly uploaded photo
                image: currentUser.image || editImage,
            });
            setCurrentUser(updatedUser);
            setShowSettings(false);
        } catch (error) {
            setConfirmDialog({
                show: true,
                title: "Error",
                message: "Failed to save profile changes. Please check your connection and try again.",
                type: 'danger',
                onConfirm: () => setConfirmDialog(prev => ({ ...prev, show: false }))
            });
        }
    };

    const handleOpenSettings = () => {
        if (currentUser) {
            setEditName(currentUser.name);
            setEditGender(currentUser.gender || "Not specified");
            setEditImage(currentUser.image || "");
            setShowSettings(true);
        }
    };

    const handleOpenProfile = (userOrId: any) => {
        const id = typeof userOrId === 'string' ? userOrId : (userOrId.id || userOrId._id);
        setViewingUserId(id);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newMessageText.trim() && !pendingImage) || !currentUser || !activeContact) return;

        const textToSend = newMessageText;
        const imageToSend = pendingImage;
        setNewMessageText("");
        setPendingImage(null);
        if (activeContactId) {
            setDrafts(prev => ({ ...prev, [activeContactId]: "" }));
        }

        if (imageToSend) {
            setSendingImage(true);
            try {
                const postUrl = await generateMessageUploadUrl();
                const result = await fetch(postUrl, {
                    method: "POST",
                    headers: { "Content-Type": imageToSend.file.type },
                    body: imageToSend.file,
                });
                const { storageId } = await result.json();
                const imgUrl = await (api as any).storage?.getUrl?.(storageId) ||
                    `https://api.convex.dev/api/storage/${storageId}`;

                await sendMessage({
                    body: textToSend || "",
                    author: currentUser.name,
                    room: getRoomId(currentUser._id, activeContact.id),
                    imageStorageId: storageId,
                });
            } finally {
                setSendingImage(false);
            }
        } else {
            await sendMessage({
                body: textToSend,
                author: currentUser.name,
                room: getRoomId(currentUser._id, activeContact.id)
            });
        }

        inputRef.current?.focus();
    };

    const handleMsgImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const preview = URL.createObjectURL(file);
        setPendingImage({ file, preview });
        e.target.value = "";
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // 1. Get upload URL
            const postUrl = await generateUploadUrl();

            // 2. Upload file
            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });
            const { storageId } = await result.json();

            // 3. Update profile with storageId
            const updatedUser = await updateProfileImage({
                userId: currentUser._id,
                storageId,
            });
            if (updatedUser) {
                setCurrentUser(updatedUser);
                // Sync editImage so the form submit doesn't overwrite it
                setEditImage(updatedUser.image || "");
            }
        } catch (error) {
            console.error("Upload failed:", error);
            setConfirmDialog({
                show: true,
                title: "Upload Failed",
                message: "There was an error uploading your profile picture. Please try again.",
                onConfirm: () => setConfirmDialog(prev => ({ ...prev, show: false })),
                confirmText: "Close"
            });
        } finally {
            setUploading(false);
        }
    };

    const handleCreateUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUpdateTitle.trim() || !newUpdateBody.trim() || !currentUser) return;

        try {
            await createUpdate({
                authorId: currentUser._id,
                authorName: currentUser.name,
                title: newUpdateTitle,
                body: newUpdateBody,
            });

            setNewUpdateTitle("");
            setNewUpdateBody("");
            setShowCreateUpdate(false);
        } catch (error) {
            console.error("Failed to create update", error);
            setConfirmDialog({
                show: true,
                title: "Error",
                message: "Could not post your update. Please try again.",
                type: 'danger',
                onConfirm: () => setConfirmDialog(prev => ({ ...prev, show: false }))
            });
        }
    };

    const handleAddComment = async (updateId: string) => {
        const text = commentTexts[updateId];
        if (!text?.trim() || !currentUser) return;

        try {
            await addUpdateComment({
                updateId: updateId as any,
                authorId: currentUser._id,
                authorName: currentUser.name,
                body: text.trim(),
            });
            setCommentTexts(prev => ({ ...prev, [updateId]: "" }));
        } catch (error) {
            console.error("Failed to add comment:", error);
            setConfirmDialog({
                show: true,
                title: "Error",
                message: "Could not post your comment. Please try again.",
                type: 'danger',
                onConfirm: () => setConfirmDialog(prev => ({ ...prev, show: false }))
            });
        }
    };

    const handleRemoveUpdate = async (updateId: string) => {
        if (!currentUser) return;

        setConfirmDialog({
            show: true,
            title: "Delete Update",
            message: "Are you sure you want to delete this update? This action cannot be undone and all associated comments will be lost forever.",
            type: 'danger',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, show: false }));
                try {
                    await removeUpdate({
                        updateId: updateId as any,
                        userId: currentUser._id,
                    });
                } catch (error) {
                    console.error("Failed to remove update:", error);
                    setConfirmDialog({
                        show: true,
                        title: "Error",
                        message: "Could not delete update. Please try again.",
                        type: 'danger',
                        onConfirm: () => setConfirmDialog(prev => ({ ...prev, show: false }))
                    });
                }
            }
        });
    };

    if (!currentUser) {
        return <Auth onAuthComplete={(user) => setCurrentUser(user)} />;
    }

    return (
        <div className="flex h-screen bg-white text-slate-900 font-sans overflow-hidden relative md:ml-20">
            <AnimatePresence>
                {(isDisconnected || showReconnected) && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="absolute bottom-24 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none"
                    >
                        <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border backdrop-blur-md pointer-events-auto transition-colors duration-500 ${showReconnected
                            ? "bg-emerald-500 text-white border-emerald-400/20"
                            : "bg-red-500 text-white border-red-400/20"
                            }`}>
                            {showReconnected ? (
                                <>
                                    <div className="w-2 h-2 bg-white rounded-full" />
                                    <Bell className="w-4 h-4" />
                                    <span className="text-sm font-bold tracking-wide">Back Online</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                                    <WifiOff className="w-4 h-4" />
                                    <span className="text-sm font-bold tracking-wide">Disconnected from Aura</span>
                                    <div className="w-px h-4 bg-white/20 mx-1" />
                                    <span className="text-xs opacity-90">Reconnecting...</span>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Update Modal */}
            <AnimatePresence>
                {showCreateUpdate && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-3xl w-full max-w-lg overflow-y-auto max-h-[90vh] shadow-2xl"
                        >
                            <form onSubmit={handleCreateUpdate} className="p-8 space-y-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-2xl font-bold text-slate-900">New Update</h2>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateUpdate(false)}
                                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
                                    >
                                        <ChevronLeft className="w-6 h-6 rotate-180" />
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <input
                                        required
                                        placeholder="Headline (H3)..."
                                        value={newUpdateTitle}
                                        onChange={(e) => setNewUpdateTitle(e.target.value)}
                                        className="w-full text-xl font-bold border-none focus:ring-0 placeholder-slate-300"
                                    />
                                    <textarea
                                        required
                                        rows={6}
                                        placeholder="What's on your mind? (Paragraphs allowed)..."
                                        value={newUpdateBody}
                                        onChange={(e) => setNewUpdateBody(e.target.value)}
                                        className="w-full text-slate-600 border-none focus:ring-0 resize-none placeholder-slate-300"
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateUpdate(false)}
                                        className="flex-1 px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-4 bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100/50 hover:scale-[1.02] transition-all active:scale-95"
                                    >
                                        Share Update
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Profile Settings Modal */}
            <AnimatePresence>
                {showSettings && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-3xl w-full max-w-lg overflow-y-auto max-h-[90vh] shadow-2xl"
                        >
                            <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-2xl font-bold text-slate-900">Profile Settings</h2>
                                    <button
                                        type="button"
                                        onClick={() => setShowSettings(false)}
                                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
                                    >
                                        <ChevronLeft className="w-6 h-6 rotate-180" />
                                    </button>
                                </div>

                                <div className="flex justify-center py-4">
                                    <div className="relative group w-32 h-32">
                                        <div className="w-full h-full rounded-full bg-slate-100 overflow-hidden border-4 border-white shadow-xl flex items-center justify-center">
                                            {currentUser?.image ? (
                                                <img src={currentUser.image} alt={currentUser.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="w-16 h-16 text-slate-300" />
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => imageInputRef.current?.click()}
                                            disabled={uploading}
                                            className="absolute bottom-0 right-0 p-3 bg-indigo-600 rounded-full text-white shadow-lg hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                                        </button>
                                        <input
                                            type="file"
                                            ref={imageInputRef}
                                            onChange={handleImageUpload}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                                        <input
                                            required
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Email (Read-only)</label>
                                        <input
                                            readOnly
                                            value={currentUser?.email}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm opacity-50 cursor-not-allowed"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Gender</label>
                                        <select
                                            value={editGender}
                                            onChange={(e) => setEditGender(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all appearance-none"
                                        >
                                            <option>Not specified</option>
                                            <option>Male</option>
                                            <option>Female</option>
                                            <option>Non-binary</option>
                                            <option>Other</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Avatar Seed</label>
                                        <input
                                            placeholder="DiceBear seed..."
                                            value={editImage}
                                            onChange={(e) => setEditImage(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowSettings(false)}
                                        className="flex-1 px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-4 bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100/50 hover:scale-[1.02] transition-all active:scale-95"
                                    >
                                        Save Changes
                                    </button>
                                </div>

                                <div className="pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setConfirmDialog({
                                                show: true,
                                                title: "Logout",
                                                message: "Are you sure you want to log out of Aura? You will need to sign in again to access your messages.",
                                                onConfirm: () => {
                                                    setCurrentUser(null);
                                                    setShowSettings(false);
                                                    setConfirmDialog(prev => ({ ...prev, show: false }));
                                                }
                                            });
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3 text-red-500 hover:bg-red-50 rounded-xl font-bold transition-all"
                                    >
                                        <LogOut className="w-5 h-5" />
                                        Logout from Aura
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Social Profile Modal */}
            <AnimatePresence>
                {viewingUserId && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-white/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white/80 glass rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl web3-shadow-lg relative"
                        >
                            <button
                                onClick={() => setViewingUserId(null)}
                                className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400 z-10"
                            >
                                <ChevronLeft className="w-6 h-6 rotate-180" />
                            </button>

                            {!fullViewingUser ? (
                                <div className="p-12 text-center space-y-4">
                                    <Sparkles className="w-8 h-8 text-blue-500 animate-pulse mx-auto" />
                                    <p className="text-sm text-slate-400 font-medium">Summoning profile...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="h-32 bg-gradient-to-br from-blue-500 to-blue-700"></div>

                                    <div className="px-8 pb-8 -mt-16 text-center space-y-4">
                                        <div className="inline-block relative">
                                            <div className="w-32 h-32 rounded-full border-4 border-white bg-slate-200 overflow-hidden shadow-xl">
                                                {fullViewingUser.image ? (
                                                    <img src={fullViewingUser.image} alt={fullViewingUser.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-indigo-400 font-bold text-3xl">
                                                        {fullViewingUser.name?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            {Date.now() - (fullViewingUser.lastSeen || 0) < 60000 && (
                                                <div className="absolute bottom-2 right-2 w-5 h-5 bg-emerald-500 border-4 border-white rounded-full"></div>
                                            )}
                                        </div>

                                        <div>
                                            <h2 className="text-2xl font-bold text-slate-900">{fullViewingUser.name}</h2>
                                            <p className="text-sm text-slate-500 font-medium">{fullViewingUser.location}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 py-4">
                                            <div className="bg-slate-50 p-3 rounded-2xl">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gender</p>
                                                <p className="text-sm font-bold text-slate-700">{fullViewingUser.gender || 'Private'}</p>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-2xl">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                                <p className={`text-sm font-bold ${Date.now() - (fullViewingUser.lastSeen || 0) < 60000 ? 'text-emerald-500' : 'text-slate-500'}`}>
                                                    {Date.now() - (fullViewingUser.lastSeen || 0) < 60000 ? 'Online' : 'Offline'}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                handleSelectContact(fullViewingUser._id);
                                                setViewingUserId(null);
                                                setViewMode('chat');
                                            }}
                                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <MessageSquare className="w-5 h-5" />
                                            Message
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Confirmation Dialog */}
            <AnimatePresence>
                {confirmDialog.show && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-white/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-8 text-center space-y-6"
                        >
                            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${confirmDialog.type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                <AlertCircle className="w-8 h-8" />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-slate-900">{confirmDialog.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed font-medium">{confirmDialog.message}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => setConfirmDialog(prev => ({ ...prev, show: false }))}
                                    className="px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                >
                                    {confirmDialog.title === "Error" ? "Close" : "Cancel"}
                                </button>
                                {confirmDialog.title !== "Error" && (
                                    <button
                                        onClick={confirmDialog.onConfirm}
                                        className={`px-6 py-3 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 ${confirmDialog.type === 'danger'
                                            ? 'bg-red-500 shadow-red-100 hover:bg-red-600'
                                            : 'bg-blue-600 shadow-blue-100 hover:bg-blue-700'
                                            }`}
                                    >
                                        Confirm
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


            {/* 2. Middle Contact List - Responsive toggle */}
            <aside className={`${viewMode === 'list' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[380px] border-r border-slate-100/50 bg-white/40 glass z-10 overflow-hidden`}>
                <div className="p-6 pb-4 shrink-0">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-black tracking-tight italic select-none text-indigo-600 px-1">
                            Aura<span className="text-indigo-600 not-italic">.</span>
                        </h1>
                        <button
                            onClick={handleOpenSettings}
                            className="bg-slate-50 p-3 rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
                            <Settings className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            placeholder={activeTab === 'find' ? "find new neighbors..." : activeTab === 'updates' ? "search updates..." : "search chats..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-100 rounded-xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-slate-100 transition-all placeholder:text-slate-400 font-medium"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'updates' ? (
                        <div className="p-4 space-y-4">
                            <button
                                onClick={() => setShowCreateUpdate(true)}
                                className="fixed bottom-24 right-6 md:relative md:bottom-0 md:right-0 w-16 h-16 md:w-full md:h-16 bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-full md:rounded-2xl font-bold shadow-xl shadow-indigo-200 hover:scale-105 hover:shadow-indigo-300 transition-all active:scale-95 flex items-center justify-center gap-3 group shrink-0"
                            >
                                <Sparkles className="w-6 h-6 animate-pulse group-hover:rotate-12 transition-transform" />
                                <span className="hidden md:inline text-lg">New Aura Update</span>
                            </button>

                            {(updates || [])
                                .filter((u: any) =>
                                    u.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    u.body.toLowerCase().includes(searchQuery.toLowerCase())
                                )
                                .map((update: any) => (
                                    <div
                                        key={update._id}
                                        className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm cursor-pointer hover:border-blue-200 transition-all group relative"
                                        onClick={() => {
                                            // Scroll to post in main area if needed or set viewMode
                                            setViewMode('chat');
                                        }}
                                    >
                                        <h3 className="font-bold text-slate-900 truncate pr-6">{update.title}</h3>
                                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">{update.body}</p>
                                        <div className="flex justify-between items-center mt-3 text-[10px] text-slate-400">
                                            <div className="flex items-center gap-1.5 truncate max-w-[100px]">
                                                <span className="font-bold text-slate-600">{update.authorName}</span>
                                                <span>•</span>
                                                <span>{getRelativeTime(update._creationTime)}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleLikeUpdate({ updateId: update._id, userId: currentUser._id });
                                                    }}
                                                    className={`flex items-center gap-1.5 transition-colors ${update.likes.includes(currentUser._id.toString()) ? 'text-red-500' : 'hover:text-red-500'}`}
                                                >
                                                    <Flame className={`w-4 h-4 ${update.likes.includes(currentUser._id.toString()) ? 'fill-current' : ''}`} />
                                                    <span className="text-xs font-bold">{update.likes.length}</span>
                                                </button>
                                                <div className="flex items-center gap-1.5">
                                                    <MessageSquare className="w-4 h-4" />
                                                    <span className="text-xs font-bold">{update.comments.length}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                            {updates?.length === 0 && (
                                <div className="p-8 text-center space-y-4 opacity-50">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                                        <Flame className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-600">No updates yet</h3>
                                    <p className="text-xs text-slate-400">Be the first to share something!</p>
                                </div>
                            )}

                            {updatesStatus !== 'Exhausted' && (
                                <button
                                    onClick={() => loadMoreUpdates(20)}
                                    disabled={updatesStatus === 'LoadingMore'}
                                    className="w-full py-4 text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                                >
                                    {updatesStatus === 'LoadingMore' ? 'Loading more...' : 'Load more updates'}
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {filteredContacts.map((contact) => (
                                <div
                                    key={contact.id}
                                    onClick={() => handleSelectContact(contact.id)}
                                    className={`group px-6 py-5 flex items-center gap-4 cursor-pointer transition-all duration-300 mx-3 my-1 rounded-[2rem] ${activeContactId === contact.id ? 'bg-white web3-shadow ring-1 ring-slate-100' : 'hover:bg-white/50'}`}
                                >
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenProfile(contact.id);
                                        }}
                                        className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0 relative overflow-hidden cursor-pointer ring-0 hover:ring-2 ring-blue-400 ring-offset-2 transition-all"
                                    >
                                        {contact.image ? (
                                            <img src={contact.image} alt={contact.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-indigo-400 font-bold text-lg">
                                                {contact.name?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <h3 className="font-bold text-sm text-slate-900 truncate">{contact.name}</h3>
                                                {contact.unreadCount > 0 && (
                                                    <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                                                        {contact.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-400 whitespace-nowrap">{contact.time}</span>
                                        </div>
                                        <div className="flex justify-between items-center gap-2">
                                            <p className={`text-xs truncate flex-1 ${contact.unreadCount > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                                                {contact.msg}
                                            </p>
                                            <span className="text-[9px] text-slate-400 font-medium px-1.5 py-0.5 bg-slate-100 rounded-md whitespace-nowrap">
                                                {contact.location}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredContacts.length === 0 && (
                                <div className="p-8 text-center opacity-40">
                                    <p className="text-sm italic">Nothing found in {activeTab}</p>
                                </div>
                            )}

                            {activeTab === 'chats' && activeChatsStatus !== 'Exhausted' && (
                                <button
                                    onClick={() => loadMoreChats(20)}
                                    disabled={activeChatsStatus === 'LoadingMore'}
                                    className="w-full py-6 text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                                >
                                    {activeChatsStatus === 'LoadingMore' ? 'Loading more...' : 'Load more chats'}
                                </button>
                            )}

                            {activeTab === 'find' && allUsersStatus !== 'Exhausted' && (
                                <button
                                    onClick={() => loadMoreUsers(20)}
                                    disabled={allUsersStatus === 'LoadingMore'}
                                    className="w-full py-6 text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                                >
                                    {allUsersStatus === 'LoadingMore' ? 'Loading more...' : 'Load more neighbors'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </aside>

            {/* 3. Main Chat Area - Visible on desktop, toggled on mobile */}
            <main className={`${viewMode === 'chat' ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative min-w-0 h-full`}>
                {/* Header */}
                <header className="h-24 border-b border-slate-100/50 flex items-center justify-between px-6 md:px-10 glass z-10 shrink-0">
                    {activeTab === 'updates' ? (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setViewMode('list')}
                                className="md:hidden p-2 hover:bg-slate-50 rounded-lg text-slate-500"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <h2 className="font-bold text-lg">Aura Feed</h2>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 md:gap-3">
                            <button
                                onClick={() => setViewMode('list')}
                                className="md:hidden p-2 hover:bg-slate-50 rounded-lg text-slate-500"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <div
                                onClick={() => handleOpenProfile(activeContact?.id)}
                                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-200 overflow-hidden border border-slate-100 shadow-sm shrink-0 cursor-pointer hover:scale-105 transition-transform"
                            >
                                {activeContact?.image ? (
                                    <img src={activeContact.image} alt={activeContact.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-indigo-400 font-bold text-base">
                                        {activeContact?.name?.[0]?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <h2 className="font-bold text-sm md:text-base leading-tight truncate">{activeContact?.name || "Select a contact"}</h2>
                                <div className="text-[10px] md:text-xs text-slate-500 font-medium truncate flex items-center gap-1 cursor-default">
                                    {activeContact?.status === 'Online' && (
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                    )}
                                    <span className={activeContact?.status === 'Online' ? 'text-emerald-500' : ''}>
                                        {activeContact?.status || "Offline"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-1">
                        {activeTab !== 'updates' && (
                            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 md:p-1 mr-1 md:mr-4">
                                <button className="p-1.5 md:p-2 hover:bg-slate-50 rounded-md transition-colors text-slate-400"><Video className="w-4 h-4 md:w-5 md:h-5" /></button>
                                <div className="w-px h-5 md:h-6 bg-slate-200 mx-0.5 md:mx-1"></div>
                                <button className="p-1.5 md:p-2 hover:bg-slate-50 rounded-md transition-colors text-slate-400"><Phone className="w-4 h-4 md:w-5 md:h-5" /></button>
                            </div>
                        )}
                        <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hidden sm:block"><Search className="w-5 h-5" /></button>
                    </div>
                </header>

                {activeTab === 'updates' ? (
                    <div className="flex-1 overflow-y-auto bg-textured p-4 md:p-8 space-y-8 pb-20">
                        {updates?.filter((u: any) =>
                            u.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            u.body.toLowerCase().includes(searchQuery.toLowerCase())
                        ).map((update: any) => (
                            <motion.article
                                key={update._id}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 md:p-10 border border-slate-100/50 web3-shadow-lg max-w-2xl mx-auto space-y-8 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-500"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50/50 to-transparent -z-10 blur-2xl group-hover:from-indigo-100/50 transition-colors"></div>

                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div
                                            onClick={() => handleOpenProfile(update.authorId)}
                                            className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden cursor-pointer ring-0 hover:ring-2 ring-blue-400 ring-offset-2 transition-all"
                                        >
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${update.authorName}`} alt="" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-900">{update.authorName}</h4>
                                            <p className="text-[10px] text-slate-400">
                                                {getRelativeTime(update._creationTime)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {update.authorId === currentUser?._id && (
                                            <button
                                                onClick={() => handleRemoveUpdate(update._id)}
                                                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                                title="Delete update"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                        <div className="text-[10px] font-black text-indigo-600 bg-indigo-50/80 px-4 py-1.5 rounded-full uppercase tracking-[0.15em] shadow-sm border border-indigo-100/50">
                                            Live <span className="inline-block w-1 h-1 bg-indigo-600 rounded-full ml-1 animate-pulse"></span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-2xl font-bold text-slate-900 leading-tight">{update.title}</h3>
                                    <div className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                        {update.body}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <button
                                            onClick={() => toggleLikeUpdate({ updateId: update._id, userId: currentUser._id })}
                                            className={`flex items-center gap-3 group transition-all ${update.likes.includes(currentUser._id.toString()) ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                                        >
                                            <div className={`p-2.5 rounded-full transition-colors ${update.likes.includes(currentUser._id.toString()) ? 'bg-red-50' : 'group-hover:bg-red-50'}`}>
                                                <Flame className={`w-7 h-7 ${update.likes.includes(currentUser._id.toString()) ? 'fill-current' : ''}`} />
                                            </div>
                                            <span className="text-sm font-bold">{update.likes.length}</span>
                                        </button>
                                        <div className="flex items-center gap-3 text-slate-400">
                                            <div className="p-2.5">
                                                <MessageSquare className="w-7 h-7" />
                                            </div>
                                            <span className="text-sm font-bold">{update.comments.length}</span>
                                        </div>
                                    </div>
                                    <button className="text-slate-400 hover:text-blue-600 transition-colors">
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Comments Section */}
                                <div className="space-y-4 pt-4">
                                    {update.comments.map((comment: any) => (
                                        <div key={comment._id} className="flex gap-3 text-[13px] bg-slate-50 p-3 rounded-2xl">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden shrink-0 mt-0.5">
                                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.authorName}`} alt="" />
                                            </div>
                                            <div className="flex-1">
                                                <span className="font-bold text-slate-800 mr-2">{comment.authorName}</span>
                                                <span className="text-slate-600">{comment.body}</span>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="flex gap-2 pt-2">
                                        <input
                                            placeholder="Add a comment..."
                                            value={commentTexts[update._id] || ""}
                                            onChange={(e) => setCommentTexts(prev => ({ ...prev, [update._id]: e.target.value }))}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment(update._id)}
                                            className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all border-none"
                                        />
                                        <button
                                            disabled={!commentTexts[update._id]?.trim()}
                                            onClick={() => handleAddComment(update._id)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-30"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.article>
                        ))}

                        {updatesStatus !== 'Exhausted' && (
                            <div className="flex justify-center pt-8">
                                <button
                                    onClick={() => loadMoreUpdates(20)}
                                    disabled={updatesStatus === 'LoadingMore'}
                                    className="bg-white border border-slate-200 px-8 py-3 rounded-full text-sm font-bold text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                >
                                    {updatesStatus === 'LoadingMore' ? 'Loading older updates...' : 'Load more updates'}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Messages Thread */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4 bg-textured scroll-smooth flex flex-col-reverse"
                        >
                            <AnimatePresence initial={false}>
                                {messages?.map((msg: any) => (
                                    <motion.div
                                        key={msg._id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`flex ${msg.author === currentUser.name ? "justify-end" : "justify-start"}`}
                                    >
                                        <div className={`relative rounded-2xl text-[13px] max-w-[85%] md:max-w-[70%] transition-all overflow-hidden ${msg.author === currentUser.name
                                            ? "bg-indigo-600 text-white rounded-tr-none"
                                            : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                                            }`}>
                                            {msg.imageUrl && (
                                                <a href={msg.imageUrl} target="_blank" rel="noreferrer" className="block">
                                                    <img
                                                        src={msg.imageUrl}
                                                        alt="image"
                                                        className="w-full max-w-[260px] rounded-t-2xl object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                                                    />
                                                </a>
                                            )}
                                            {msg.body && (
                                                <div className="px-4 py-2.5">
                                                    {msg.body}
                                                    <span className={`text-[9px] ml-2 opacity-60 ${msg.author === currentUser.name ? 'text-white' : 'text-slate-400'}`}>
                                                        {new Date(msg._creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            )}
                                            {!msg.body && msg.imageUrl && (
                                                <div className={`px-2 pb-1 text-right text-[9px] opacity-60 ${msg.author === currentUser.name ? 'text-white' : 'text-slate-400'}`}>
                                                    {new Date(msg._creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {messages?.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300">
                                    <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="text-sm font-medium">No messages yet. Say hi!</p>
                                </div>
                            )}
                            {!messages && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300">
                                    <Sparkles className="w-12 h-12 mb-4 animate-pulse" />
                                    <p className="text-sm font-medium">Connecting to Aura...</p>
                                </div>
                            )}
                        </div>

                        {/* WhatsApp-style Input Area */}
                        <div className="bg-white shrink-0 border-t border-slate-100 z-10 pb-24 md:pb-0">
                            {/* Image preview strip */}
                            {pendingImage && (
                                <div className="px-4 pt-3 flex items-center gap-3">
                                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                                        <img src={pendingImage.preview} alt="preview" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setPendingImage(null)}
                                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <span className="text-xs text-slate-400">1 image selected</span>
                                </div>
                            )}
                            <form
                                onSubmit={handleSubmit}
                                className="px-3 py-2 flex items-end gap-2 max-w-4xl mx-auto"
                            >
                                {/* Attach image button */}
                                <button
                                    type="button"
                                    onClick={() => msgImageInputRef.current?.click()}
                                    className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all shrink-0"
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>
                                <input
                                    type="file"
                                    ref={msgImageInputRef}
                                    onChange={handleMsgImageSelect}
                                    accept="image/*"
                                    className="hidden"
                                />

                                {/* Text input pill */}
                                <div className="flex-1 bg-slate-100 rounded-full px-5 py-2.5 flex items-center min-h-[44px]">
                                    <input
                                        ref={inputRef}
                                        value={newMessageText}
                                        onChange={(e) => handleTextChange(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
                                        placeholder={activeContact ? `Message ${activeContact.name}...` : "Select a contact..."}
                                        className="w-full bg-transparent text-sm focus:outline-none placeholder:text-slate-400"
                                    />
                                </div>

                                {/* Send button */}
                                <button
                                    type="submit"
                                    disabled={!newMessageText.trim() && !pendingImage}
                                    className="w-11 h-11 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full flex items-center justify-center transition-all active:scale-95 shrink-0"
                                >
                                    {sendingImage ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Send className="w-5 h-5" />
                                    )}
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </main>

            {/* Bottom Nav - mobile only */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-100 flex items-center justify-around px-4 z-50">
                <button
                    onClick={() => { setActiveTab('chats'); setViewMode('list'); }}
                    className={`p-3 rounded-2xl transition-all duration-200 ${activeTab === 'chats' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <MessageSquare className="w-7 h-7" />
                </button>
                <button
                    onClick={() => { setActiveTab('find'); setViewMode('list'); }}
                    className={`p-3 rounded-2xl transition-all duration-200 ${activeTab === 'find' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Globe className="w-7 h-7" />
                </button>
                <div className="flex items-center justify-center p-1.5 rounded-full border border-slate-100 shadow-sm bg-slate-50 relative -top-4">
                    <button
                        onClick={() => { setActiveTab('updates'); setViewMode('list'); }}
                        className={`p-3 rounded-2xl transition-all duration-200 ${activeTab === 'updates' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                        <Sparkles className="w-7 h-7" />
                    </button>
                </div>
                <button
                    onClick={handleOpenSettings}
                    className={`p-3 rounded-2xl transition-all duration-200 ${showSettings ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Settings className="w-7 h-7" />
                </button>
            </nav>

            {/* Left Side Nav - desktop only */}
            <aside className="hidden md:flex flex-col items-center w-20 fixed left-0 top-0 bottom-0 bg-white border-r border-slate-100 z-40 py-8 gap-2">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center mb-8 shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <nav className="flex-1 flex flex-col items-center gap-2">
                    <button
                        onClick={() => { setActiveTab('chats'); setViewMode('list'); }}
                        title="Chats"
                        className={`p-3 rounded-2xl transition-all duration-200 w-12 flex justify-center ${activeTab === 'chats' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                        <MessageSquare className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => { setActiveTab('find'); setViewMode('list'); }}
                        title="Find"
                        className={`p-3 rounded-2xl transition-all duration-200 w-12 flex justify-center ${activeTab === 'find' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                        <Globe className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => { setActiveTab('updates'); setViewMode('list'); }}
                        title="Updates"
                        className={`p-3 rounded-2xl transition-all duration-200 w-12 flex justify-center ${activeTab === 'updates' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                        <Bell className="w-6 h-6" />
                    </button>
                </nav>
                <div className="mt-auto flex flex-col items-center gap-3">
                    <button
                        onClick={handleOpenSettings}
                        title="Settings"
                        className={`p-3 rounded-2xl transition-all duration-200 w-12 flex justify-center ${showSettings ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                        <Settings className="w-6 h-6" />
                    </button>
                    <div
                        onClick={handleOpenSettings}
                        className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm cursor-pointer hover:ring-2 ring-indigo-300 transition-all overflow-hidden"
                    >
                        {currentUser?.image ? (
                            <img src={currentUser.image} alt={currentUser.name} className="w-full h-full object-cover" />
                        ) : (
                            currentUser?.name?.[0]?.toUpperCase()
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
}
