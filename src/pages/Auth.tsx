import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Mail, Lock, User, ArrowRight, Trophy, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { roleHomePath } from "@/lib/roleHome";
import logoAsset from "@/assets/suffolk-tennis-logo-landscape-v2.png";
const logo = logoAsset;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerAgeGroup, setPlayerAgeGroup] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Deep-link support: /auth?redirect=/book/<token> sends the user back to
  // where they came from (e.g. an invitation link) after signing in.
  const redirectTarget = (() => {
    const r = new URLSearchParams(window.location.search).get("redirect");
    return r && r.startsWith("/") && !r.startsWith("//") ? r : null;
  })();

  useEffect(() => {
    // Land each user on their role's dashboard (admin/coach/parent), unless
    // they arrived with an explicit destination.
    if (!user) return;
    if (redirectTarget) navigate(redirectTarget);
    else roleHomePath(user.id).then((path) => navigate(path));
  }, [user, navigate, redirectTarget]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Error", description: "Please enter your email address", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: "Check your email", description: "We've sent you a password reset link." });
      setForgotPassword(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotPassword) return handleForgotPassword(e);
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!rememberMe) {
          // Session will naturally expire if not remembered
        }
        navigate(redirectTarget ?? (data.user ? await roleHomePath(data.user.id) : "/parent-hub"));
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: firstName, last_name: lastName, player_name: playerName, player_age_group: playerAgeGroup },
          },
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "We've sent you a verification link. Please check your email to confirm your account.",
        });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const ageGroups = ["8U", "9U", "10U", "11U", "12U", "14U", "16U", "18U"];

  return (
    <div className="min-h-screen bg-suffolk-navy flex relative">
      {/* Back to home */}
      <Link
        to="/"
        className="absolute top-6 left-6 z-20 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-primary-foreground/80 hover:text-primary-foreground text-sm font-body transition-colors"
      >
        <ArrowLeft size={16} />
        Back to home
      </Link>

      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[200%] h-[5px] bg-lta-yellow rotate-[-6deg] bottom-[20%] -left-[25%] opacity-30" />
          <div className="absolute w-[200%] h-[3px] bg-lta-cyan rotate-[-6deg] bottom-[15%] -left-[20%] opacity-20" />
        </div>
        <Link to="/" aria-label="Suffolk Tennis home" className="transition-opacity hover:opacity-80">
          <img src={logo} alt="Suffolk Tennis" className="h-24 mb-8" />
        </Link>
        <h1 className="font-display text-4xl font-black text-primary-foreground text-center mb-4">
          Parent Hub
        </h1>
        <p className="text-primary-foreground/60 text-center max-w-sm font-body text-lg">
          Access the LTA Player Pathway, track your child's progress, and stay updated with the latest programme news.
        </p>
        <div className="flex gap-6 mt-12">
          {["Pathway Guides", "News & Updates", "Progress Tracking"].map((f) => (
            <div key={f} className="flex items-center gap-2 text-lta-cyan text-sm font-medium">
              <Trophy size={16} />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" aria-label="Suffolk Tennis home" className="transition-opacity hover:opacity-80">
              <img src={logo} alt="Suffolk Tennis" className="h-16" />
            </Link>
          </div>

          <h2 className="font-display text-3xl font-black text-primary-foreground mb-2">
            {forgotPassword ? "Reset Password" : isLogin ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-primary-foreground/50 font-body mb-8">
            {forgotPassword ? "Enter your email and we'll send you a reset link" : isLogin ? "Sign in to access your Parent Hub" : "Join the Suffolk Tennis community"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <p className="font-bold uppercase tracking-widest text-lta-cyan text-sm mb-1">
                  Parent Details
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-foreground/30" />
                    <input
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Parent First Name"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 font-body"
                    />
                  </div>
                  <div>
                    <input
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Parent Last Name"
                      className="w-full px-4 py-3 rounded-xl bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 font-body"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-lta-cyan/30 bg-lta-cyan/10 p-3 text-xs font-body text-primary-foreground/80">
                  <p className="font-display font-bold text-lta-cyan mb-1">Important — please complete your profile</p>
                  <p>
                    Once signed in, you'll be asked to add your <strong>contact number, home address</strong> and each child's <strong>date of birth, gender and BTM number</strong>. These details are required so coaches and county staff can invite your child to training, camps and events.
                  </p>
                </div>
              </>
            )}


            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-foreground/30" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 font-body"
              />
            </div>

            {!forgotPassword && (
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-foreground/30" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  minLength={6}
                  className="w-full pl-10 pr-12 py-3 rounded-xl bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 font-body"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-foreground/40 hover:text-lta-cyan transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}

            {isLogin && !forgotPassword && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-primary-foreground/20 bg-primary-foreground/10 text-lta-cyan focus:ring-lta-cyan/50 accent-lta-cyan"
                  />
                  <span className="text-primary-foreground/50 text-sm font-body">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setForgotPassword(true)}
                  className="text-lta-cyan text-sm hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-base hover:brightness-110 transition-all shadow-[var(--shadow-glow-blue)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Please wait..." : forgotPassword ? "Send Reset Link" : isLogin ? "Sign In" : "Create Account"}
              <ArrowRight size={18} />
            </button>
          </form>

          <p className="text-center text-primary-foreground/40 font-body mt-6">
            {forgotPassword ? (
              <button
                onClick={() => setForgotPassword(false)}
                className="text-lta-cyan hover:underline font-medium"
              >
                Back to Sign In
              </button>
            ) : (
              <>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-lta-cyan hover:underline font-medium"
                >
                  {isLogin ? "Sign Up" : "Sign In"}
                </button>
              </>
            )}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
