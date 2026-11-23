"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, Mail, Lock, User, MapPin, Sparkles, ArrowRight, Eye, EyeOff, Facebook, Chrome } from "lucide-react";

interface AuthProps {
    onAuthComplete: (user: any) => void;
}

export default function Auth({ onAuthComplete }: AuthProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        location: "New York",
    });

    const signUp = useMutation((api as any).users.signUp);
    const signIn = useMutation((api as any).users.signIn);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            if (isLogin) {
                const user = await signIn({ email: form.email, password: form.password });
                onAuthComplete(user);
            } else {
                const userId = await signUp({
                    name: form.name,
                    email: form.email,
                    password: form.password,
                    location: form.location,
                });
                onAuthComplete({ _id: userId, ...form });
            }
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const locations = [
        "United States",
        "United Kingdom",
        "Canada",
        "Australia",
        "India",
        "Nigeria",
        "Germany",
        "France",
        "Japan",
        "Brazil",
        "South Africa"
    ];

    return (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-transparent overflow-hidden">
            {/* Left Section - Form */}
            <div className="w-full md:w-1/2 h-full flex items-center justify-center p-8 md:p-16 lg:p-24 overflow-y-auto">
                <div className="w-full max-w-sm">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-4xl font-bold text-slate-900 mb-2">
                            {isLogin ? "Sign In" : "Sign Up"}
                        </h2>
                        <p className="text-slate-500 mb-10">
                            {isLogin ? "Welcome back! Please enter your details." : "Join our community and find friends nearby."}
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            {!isLogin && (
                                <div className="relative border-b border-slate-200 py-3 group focus-within:border-indigo-600 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <User className="w-5 h-5 text-slate-400" />
                                        <input
                                            required
                                            placeholder="Full Name"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="w-full bg-transparent text-sm text-slate-900 focus:outline-none placeholder-slate-400"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="relative border-b border-slate-200 py-3 group focus-within:border-indigo-600 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-slate-400" />
                                    <input
                                        required
                                        type="email"
                                        placeholder="Email Address"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full bg-transparent text-sm text-slate-900 focus:outline-none placeholder-slate-400"
                                    />
                                    {!isLogin && form.email.includes("@") && (
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="text-emerald-500"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        </motion.span>
                                    )}
                                </div>
                            </div>

                            <div className="relative border-b border-slate-200 py-3 group focus-within:border-indigo-600 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Lock className="w-5 h-5 text-slate-400" />
                                    <input
                                        required
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Password"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        className="w-full bg-transparent text-sm text-slate-900 focus:outline-none placeholder-slate-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-slate-400 hover:text-indigo-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {!isLogin && (
                                <div className="relative border-b border-slate-200 py-3 group focus-within:border-indigo-600 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <MapPin className="w-5 h-5 text-slate-400" />
                                        <select
                                            value={form.location}
                                            onChange={(e) => setForm({ ...form, location: e.target.value })}
                                            className="w-full bg-transparent text-sm text-slate-900 focus:outline-none appearance-none"
                                        >
                                            {locations.map(loc => (
                                                <option key={loc} value={loc}>{loc}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <p className="text-red-500 text-xs font-medium py-2">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-br from-indigo-600 to-blue-600 hover:scale-[1.02] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-200 active:scale-[0.98] disabled:opacity-70 group"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <div className="flex items-center justify-center w-full">
                                        <span className="flex-1 text-center font-black uppercase tracking-wider">{isLogin ? "Sign In" : "Sign Up"}</span>
                                        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform border border-white/10">
                                            <ArrowRight className="w-5 h-5 text-white" />
                                        </div>
                                    </div>
                                )}
                            </button>
                        </form>

                        <div className="mt-12">
                            <p className="text-center text-slate-400 text-xs mb-6 uppercase tracking-widest font-bold">Or continue with</p>
                            <div className="flex justify-center gap-4">
                                <button className="w-12 h-12 rounded-full border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm">
                                    <Facebook className="w-5 h-5 text-[#1877F2] fill-[#1877F2]" />
                                </button>
                                <button className="w-12 h-12 rounded-full border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm">
                                    <Chrome className="w-5 h-5 text-slate-600" />
                                </button>
                            </div>
                        </div>

                        <div className="mt-12 text-center">
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Right Section - Illustration */}
            <div className="hidden md:flex w-1/2 h-full bg-slate-50 relative items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-blue-50 opacity-90"></div>

                {/* Decorative Elements */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/30 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-100/30 rounded-full blur-3xl animate-pulse delay-1000"></div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="relative z-10 w-full max-w-sm"
                >
                    {/* Floating UI Elements */}
                    <div className="bg-white/60 backdrop-blur-xl border border-white rounded-3xl p-8 shadow-2xl shadow-indigo-100/50 space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="h-3 w-32 bg-slate-200 rounded-full mb-2"></div>
                                <div className="h-2 w-20 bg-slate-100 rounded-full"></div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="h-2 w-full bg-slate-100 rounded-full"></div>
                            <div className="h-2 w-[80%] bg-slate-100 rounded-full"></div>
                            <div className="h-2 w-[90%] bg-slate-100 rounded-full"></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4">
                            <div className="h-20 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-indigo-400 animate-bounce"></div>
                            </div>
                            <div className="h-20 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-blue-300 animate-pulse"></div>
                            </div>
                        </div>

                        <div className="pt-6 flex justify-center text-slate-400 italic font-medium text-sm text-center px-4">
                            "Connect based on your vibes & location."
                        </div>
                    </div>

                    {/* Smaller Floating Badges */}
                    <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute -top-6 -right-6 bg-emerald-500 text-white text-[10px] font-bold px-4 py-2 rounded-full shadow-lg border border-white/20"
                    >
                        Active Now
                    </motion.div>

                    <motion.div
                        animate={{ y: [0, 10, 0] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        className="absolute -bottom-10 -left-6 bg-amber-500 text-white text-[10px] font-bold px-4 py-2 rounded-full shadow-lg border border-white/20"
                    >
                        New York
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
