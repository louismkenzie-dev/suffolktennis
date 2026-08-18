import { motion } from "framer-motion";
import { Mail, ArrowRight, Users, Trophy, Newspaper, MessageSquare } from "lucide-react";

import { Link } from "react-router-dom";

const ContactSection = () => {
  return (
    <section id="contact" className="relative py-24 bg-suffolk-navy text-primary-foreground overflow-hidden">
      {/* LTA diagonal stripes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[200%] h-[5px] bg-lta-yellow rotate-[-6deg] bottom-[10%] -left-[25%] opacity-40" />
        <div className="absolute w-[200%] h-[3px] bg-lta-cyan rotate-[-6deg] bottom-[6%] -left-[20%] opacity-30" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left: Contact info */}
          <div>
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-sm font-semibold text-lta-cyan uppercase tracking-widest"
            >
              Get In Touch
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display text-4xl md:text-5xl font-black mt-3 mb-6"
            >
              Ready to <span className="text-gradient-light">Play?</span>
            </motion.h2>
            <p className="text-primary-foreground/70 text-lg mb-10 font-body max-w-md">
              The best way to stay connected is through the Parent Hub — your central place for programme updates,
              events, and your child's progression through the pathway.
            </p>

            <div className="space-y-4 max-w-md">
              <p className="text-primary-foreground/60 font-body">
                Need to speak to someone directly? Visit our Contact page to find the right person for your enquiry.
              </p>
              <Link
                to="/contact"
                className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-primary-foreground/5 border border-primary-foreground/15 hover:bg-primary-foreground/10 transition-all font-body font-semibold text-primary-foreground"
              >
                <MessageSquare size={18} className="text-lta-cyan" />
                Contact Us
                <ArrowRight size={16} className="text-lta-cyan" />
              </Link>
            </div>

          </div>

          {/* Right: Parent Hub CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="bg-primary-foreground/5 backdrop-blur-sm rounded-3xl p-8 border border-primary-foreground/10">
              <div className="w-14 h-14 rounded-2xl bg-lta-cyan/20 flex items-center justify-center mb-6">
                <Users size={28} className="text-lta-cyan" />
              </div>
              <h3 className="font-display text-2xl font-bold mb-3">Parent Hub</h3>
              <p className="text-primary-foreground/60 font-body mb-6 leading-relaxed">
                Create your free account to access the full LTA Player Pathway, receive programme newsletters, 
                track upcoming events, and follow your child's progress through the performance pathway.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  { icon: Trophy, text: "LTA Player Pathway guides (9U–18U)" },
                  { icon: Newspaper, text: "Programme news & newsletter updates" },
                  { icon: Mail, text: "Event notifications & schedules" },
                ].map((feature) => (
                  <div key={feature.text} className="flex items-center gap-3">
                    <feature.icon size={16} className="text-lta-cyan shrink-0" />
                    <span className="text-sm text-primary-foreground/70 font-body">{feature.text}</span>
                  </div>
                ))}
              </div>

              <Link
                to="/auth"
                className="w-full py-4 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-base hover:brightness-110 transition-all shadow-[var(--shadow-glow-blue)] flex items-center justify-center gap-2"
              >
                Join Parent Hub
                <ArrowRight size={18} />
              </Link>

              <p className="text-center text-primary-foreground/30 text-xs font-body mt-4">
                Already have an account?{" "}
                <Link to="/auth" className="text-lta-cyan hover:underline">Sign in</Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
