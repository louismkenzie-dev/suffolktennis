import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import ollieImg from "@/assets/coach-ollie.png.asset.json";
import dannyImg from "@/assets/coach-danny.png.asset.json";
import chrisImg from "@/assets/coach-chris.png.asset.json";
import jamesImg from "@/assets/coach-james.jpeg";
import uniformCourtAsset from "@/assets/suffolk-uniform-court.png.asset.json";
import uniformTrioAsset from "@/assets/suffolk-uniform-trio.jpeg.asset.json";
import davidLloydLogo from "@/assets/david-lloyd-logo.png";
import ipswichSportsWhite from "@/assets/ipswich-sports-white.png";
import culfordWhite from "@/assets/culford-white.png";

const uniformCourt = uniformCourtAsset.url;
const uniformTrio = uniformTrioAsset.url;

const leadCoaches = [
  {
    name: "Ollie Sutton",
    firstName: "Ollie",
    role: "10U Performance Lead",
    ages: "8U/9U/10U",
    ageBand: "8U/9U/10U",
    programs: "Red Ball • Orange Ball • Green Ball",
    email: "ollie@suffolktennis.online",
    photo: ollieImg.url,
    accent: "from-red-500 to-orange-500",
    prompt: "Get in touch with our 10U Performance Manager Ollie Sutton for any questions about 8U, 9U or 10U county training",
    venue: { src: davidLloydLogo, alt: "David Lloyd Ipswich", invert: true, label: "Based at David Lloyd Ipswich" },
  },
  {
    name: "Chris Daynes",
    firstName: "Chris",
    role: "11 - 18 yrs Lead",
    ages: "Ages 11–18",
    ageBand: "11–18",
    programs: "Yellow Ball • Performance Pathway",
    email: "chris@suffolktennis.online",
    photo: chrisImg.url,
    accent: "from-yellow-400 to-amber-500",
    prompt: "Get in touch with our County\nPerformance Manager Chris Daynes for any questions about 11U-18U\ncounty training",
    venue: { src: ipswichSportsWhite, alt: "Ipswich Sports Club", invert: false, label: "Based at Ipswich Sports Club" },
  },
  {
    name: "Danny Wyatt",
    firstName: "Danny",
    role: "RPDC Lead",
    ages: "RPDC",
    ageBand: "RPDC",
    programs: "Regional Performance Development Centre",
    email: "danny@suffolktennis.online",
    photo: dannyImg.url,
    accent: "from-green-500 to-emerald-600",
    prompt: "Interested in our Regional Performance Development Centre? Email Danny directly with any questions.",
    venue: { src: culfordWhite, alt: "Culford Sports & Tennis Centre", invert: false, label: "Based at Culford" },
  },
];

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  topic: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Please share a few more details").max(2000),
});

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", topic: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Contact — Suffolk Tennis";
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setSubmitting(true);
    // Open the user's email client with a prefilled enquiry
    const body = `Name: ${parsed.data.name}%0D%0AEmail: ${parsed.data.email}%0D%0APhone: ${parsed.data.phone || "—"}%0D%0ATopic: ${parsed.data.topic || "General enquiry"}%0D%0A%0D%0A${encodeURIComponent(parsed.data.message)}`;
    const subject = encodeURIComponent(`Suffolk Tennis enquiry — ${parsed.data.topic || "General"}`);
    window.location.href = `mailto:enquiries@suffolktennis.online?subject=${subject}&body=${body}`;
    toast.success("Opening your email client…");
    setTimeout(() => setSubmitting(false), 800);
  };

  return (
    <div className="min-h-screen bg-suffolk-navy text-primary-foreground">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src={uniformCourt} alt="Suffolk Tennis juniors rallying" className="w-full h-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-suffolk-navy/70 via-suffolk-navy/85 to-suffolk-navy" />
        </div>
        <div className="container mx-auto px-6 relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-lta-cyan hover:text-white transition-colors mb-6">
            <ArrowLeft size={16} /> Back to home
          </Link>
          <motion.span
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="block text-sm font-semibold text-lta-cyan uppercase tracking-widest"
          >
            Get In Touch
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="font-display text-5xl md:text-6xl font-black mt-3 mb-4"
          >
            Contact <span className="text-gradient-light">Suffolk Tennis</span>
          </motion.h1>
          <p className="text-primary-foreground/75 text-lg max-w-2xl font-body">
            Speak directly with the lead coach for your child's age group, or send us a message and we'll point you in the right direction.
          </p>
        </div>
      </section>

      {/* Lead Coaches */}
      <section className="py-20 bg-suffolk-navy">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-sm font-semibold text-lta-cyan uppercase tracking-widest">Lead Coaches</span>
            <h2 className="font-display text-4xl md:text-5xl font-black mt-3 mb-4">Who to Contact</h2>
            <p className="text-primary-foreground/70 font-body">
              Each programme is led by an experienced LTA-qualified coach. Reach out to the right one and they'll be happy to help.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {leadCoaches.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative rounded-3xl overflow-hidden bg-primary-foreground/5 border border-primary-foreground/10 hover:border-lta-cyan/40 transition-all"
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img
                    src={c.photo}
                    alt={c.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${c.accent} opacity-20 mix-blend-overlay`} />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-suffolk-navy via-suffolk-navy/70 to-transparent" />
                  <div className="absolute bottom-4 left-5 right-5">
                    <h3 className="font-display text-2xl font-black">{c.name}</h3>
                    <p className="text-sm text-primary-foreground/80 font-body">{c.role}</p>
                  </div>
                </div>
                <div className="p-5 flex flex-col">

                  {c.venue && (
                    <div className="flex items-center gap-3 mb-4 rounded-xl bg-primary-foreground/5 border border-primary-foreground/10 px-3 py-2">
                      <img
                        src={c.venue.src}
                        alt={c.venue.alt}
                        className={`h-8 w-auto shrink-0 ${c.venue.invert ? "brightness-0 invert" : ""}`}
                      />
                      <span className="text-xs font-body text-primary-foreground/70 leading-tight">
                        {c.venue.label}
                      </span>
                    </div>
                  )}

                  <div className="rounded-2xl bg-suffolk-navy/40 border border-primary-foreground/10 p-4 mb-4">
                    <p className="font-bold uppercase tracking-widest text-lta-cyan mb-2 text-center text-2xl">
                      Get in touch
                    </p>
                    <p className="text-sm font-body text-primary-foreground/85 leading-relaxed">
                      {c.prompt}
                    </p>
                  </div>

                  <a
                    href={`mailto:${c.email}?subject=${encodeURIComponent(`Suffolk Tennis enquiry — ${c.role}`)}&body=${encodeURIComponent(`Hi ${c.firstName},\n\nI'd like to ask about ${c.programs} for my child.\n\n`)}`}
                    className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all shadow-[var(--shadow-glow-blue)]"
                  >
                    <Mail size={16} /> Click here
                  </a>
                  <p className="text-xs text-primary-foreground/50 text-center font-body mt-2 break-all">
                    {c.email}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Strategic lead */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 rounded-3xl bg-primary-foreground/5 border border-primary-foreground/10 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6"
          >
            <img src={jamesImg} alt="James Yates" className="w-24 h-24 rounded-2xl object-cover shrink-0" />
            <div className="flex-1 text-center md:text-left">
              <p className="font-bold uppercase tracking-widest text-lta-cyan mb-2 text-lg">Strategic Lead</p>
              <h3 className="font-display text-2xl font-black mt-1">James Yates</h3>
              <p className="text-sm font-body text-primary-foreground/70">LTA Level 5 — Quality assurance & coach development</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Form + Info */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={uniformTrio} alt="Suffolk Tennis players in uniform" className="w-full h-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-b from-suffolk-navy via-suffolk-navy/95 to-suffolk-navy" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-sm font-semibold text-lta-cyan uppercase tracking-widest">General Enquiries</span>
              <h2 className="font-display text-4xl font-black mt-3 mb-4">Drop Us a Line</h2>
              <p className="text-primary-foreground/70 font-body mb-6">
                Not sure who to contact? Send us a message and we'll route your enquiry to the right person.
              </p>
              <a
                href="mailto:enquiries@suffolktennis.online"
                className="inline-flex items-center gap-3 rounded-2xl bg-primary-foreground/5 border border-lta-cyan/30 px-6 py-4 font-display font-black text-lta-cyan text-xl sm:text-3xl tracking-tight hover:bg-primary-foreground/10 hover:border-lta-cyan transition-all break-all"
              >
                <Mail className="shrink-0" size={28} />
                enquiries@suffolktennis.online
              </a>
            </div>


            {/* Form */}
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-3xl bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 p-6 md:p-8 space-y-5"
            >

              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Your name" required>
                  <input
                    type="text" required maxLength={100}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="form-input"
                    placeholder="Jane Smith"
                  />
                </Field>
                <Field label="Email" required>
                  <input
                    type="email" required maxLength={255}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="form-input"
                    placeholder="jane@example.com"
                  />
                </Field>
                <Field label="Phone (optional)">
                  <input
                    type="tel" maxLength={30}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="form-input"
                    placeholder="07…"
                  />
                </Field>
                <Field label="Topic">
                  <select
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    className="form-input"
                  >
                    <option value="">General enquiry</option>
                    <option>Red Ball (8 &amp; Under)</option>
                    <option>Orange Ball (9 &amp; Under)</option>
                    <option>Green Ball (10 &amp; Under)</option>
                    <option>Yellow Ball (11–18)</option>
                    <option>Events</option>
                    <option>Coaching enquiry</option>
                    <option>Other</option>
                  </select>
                </Field>
              </div>

              <Field label="Message" required>
                <textarea
                  required minLength={10} maxLength={2000} rows={6}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="form-input resize-none"
                  placeholder="Tell us a little about your child's age, experience, and what you're looking for…"
                />
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-base hover:brightness-110 transition-all shadow-[var(--shadow-glow-blue)] flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? "Sending…" : (<><Send size={18} /> Send Message</>)}
              </button>
              <p className="text-xs text-primary-foreground/50 text-center font-body">
                We typically respond within 1–2 working days.
              </p>
            </motion.form>
          </div>
        </div>
      </section>

      <Footer />

      <style>{`
        .form-input {
          width: 100%;
          padding: 0.85rem 1rem;
          border-radius: 0.75rem;
          background: hsl(var(--primary-foreground) / 0.06);
          border: 1px solid hsl(var(--primary-foreground) / 0.12);
          color: hsl(var(--primary-foreground));
          font-family: inherit;
          font-size: 0.95rem;
          transition: all 0.2s;
        }
        .form-input:focus {
          outline: none;
          border-color: hsl(var(--lta-cyan));
          background: hsl(var(--primary-foreground) / 0.1);
          box-shadow: 0 0 0 3px hsl(var(--lta-cyan) / 0.2);
        }
        .form-input::placeholder { color: hsl(var(--primary-foreground) / 0.4); }
        select.form-input option { background: hsl(var(--suffolk-navy)); color: hsl(var(--primary-foreground)); }
      `}</style>
    </div>
  );
};

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-xs font-semibold uppercase tracking-wider text-primary-foreground/70 mb-2">
      {label} {required && <span className="text-lta-cyan">*</span>}
    </span>
    {children}
  </label>
);

export default Contact;
