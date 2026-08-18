import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logoAsset from "@/assets/suffolk-tennis-logo-landscape-v2.png";
const logo = logoAsset;

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get("type") === "recovery") {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Password updated", description: "Your password has been reset successfully." });
      navigate("/auth");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-suffolk-navy flex items-center justify-center p-8">
        <div className="text-center">
          <img src={logo} alt="Suffolk Tennis" className="h-16 mx-auto mb-6" />
          <h2 className="font-display text-2xl font-black text-primary-foreground mb-4">Invalid Reset Link</h2>
          <p className="text-primary-foreground/50 mb-6">This link is invalid or has expired.</p>
          <button onClick={() => navigate("/auth")} className="text-lta-cyan hover:underline font-medium">
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-suffolk-navy flex items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src={logo} alt="Suffolk Tennis" className="h-16" />
        </div>
        <h2 className="font-display text-3xl font-black text-primary-foreground mb-2">Set New Password</h2>
        <p className="text-primary-foreground/50 font-body mb-8">Enter your new password below</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-foreground/30" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              minLength={6}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 font-body"
            />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-foreground/30" />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              minLength={6}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 font-body"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-base hover:brightness-110 transition-all shadow-[var(--shadow-glow-blue)] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Please wait..." : "Update Password"}
            <ArrowRight size={18} />
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
