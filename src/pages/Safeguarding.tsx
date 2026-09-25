// Safeguarding & Welfare. Written from the Suffolk LTA Safeguarding Policy and
// Procedures (approved 6 Oct 2025), which county training runs under.
//
// The order of this page is the point of it. Someone arriving here worried
// about a child needs to know what to do before they need a policy, so the
// four routes come first and the documents last.
//
// The policy is explicit (pp.4 and 9) that concerns about county activities go
// to the LTA Safeguarding Team through its online form, and that the County
// Safeguarding Officer is NOT part of the reporting pathway — the LTA shares
// concerns with her. So the primary action links to the LTA form, and Beth is
// presented as the person for questions, never as where to report. Keep it
// that way unless the policy changes.
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, FileText, Mail, Phone, ShieldCheck, Siren, Users, MessageCircle, Car, Camera, HandHeart, Megaphone } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const LTA_CONCERN_FORM = "https://safeguardingconcern.lta.org.uk/";
const POLICY_PDF = "/documents/suffolk-lta-safeguarding-policy-2025.pdf";

const tel = (n: string) => `tel:${n.replace(/\s+/g, "")}`;

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <li className="relative rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 md:p-7">
    <div className="flex items-start gap-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lta-cyan/15 font-display text-lg font-black text-lta-cyan">{n}</span>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-xl font-black leading-tight md:text-2xl">{title}</h3>
        <div className="mt-3 space-y-3 font-body text-primary-foreground/75">{children}</div>
      </div>
    </div>
  </li>
);

const PhoneLink = ({ number, label }: { number: string; label?: string }) => (
  <a
    href={tel(number)}
    className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-lta-cyan/30 bg-primary-foreground/5 px-4 py-2.5 font-display font-black text-lta-cyan hover:border-lta-cyan hover:bg-primary-foreground/10"
  >
    <Phone size={16} className="shrink-0" />
    {label ? <span className="font-body text-sm font-semibold text-primary-foreground/70">{label}</span> : null}
    {number}
  </a>
);

const External = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-lta-cyan underline-offset-4 hover:underline">
    {children}
  </a>
);

const Point = ({ icon: Icon, title, children }: { icon: typeof Car; title: string; children: React.ReactNode }) => (
  <div className="rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-6">
    <Icon className="text-lta-cyan" size={26} strokeWidth={1.8} />
    <h3 className="mt-4 font-display text-lg font-black leading-tight">{title}</h3>
    <p className="mt-2 font-body text-sm leading-relaxed text-primary-foreground/70">{children}</p>
  </div>
);

const Safeguarding = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Safeguarding & Welfare — Suffolk Tennis";
  }, []);

  return (
    <div className="min-h-screen bg-suffolk-navy text-primary-foreground">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pb-10 pt-32">
        <div className="container relative z-10 mx-auto px-6">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-lta-cyan transition-colors hover:text-white">
            <ArrowLeft size={16} /> Back to home
          </Link>
          <span className="block text-sm font-semibold uppercase tracking-widest text-lta-cyan">Safeguarding &amp; Welfare</span>
          <h1 className="mb-4 mt-3 font-display text-4xl font-black md:text-6xl">Keeping every player safe</h1>
          <p className="max-w-2xl font-body text-lg text-primary-foreground/75">
            Every child at county training should feel safe, supported and able to enjoy their tennis. Safeguarding is
            everyone's responsibility — so if something doesn't feel right, here is exactly what to do.
          </p>
        </div>
      </section>

      {/* What to do — first, because someone arriving worried needs this before anything else */}
      <section className="pb-16" aria-labelledby="worried">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <h2 id="worried" className="font-display text-3xl font-black md:text-4xl">Worried about a child?</h2>
            <p className="mt-3 font-body text-primary-foreground/70">
              You don't need to be certain, and you don't need to investigate — that isn't anyone's job at a club or
              county. Even a small worry, a nagging doubt, is worth raising.
            </p>
          </div>

          <ol className="mt-8 grid max-w-3xl gap-4">
            <Step n={1} title="Someone is in danger right now, or a crime is happening">
              <p>Call the emergency services straight away.</p>
              <a
                href="tel:999"
                className="inline-flex items-center gap-3 rounded-2xl bg-red-600 px-6 py-3.5 font-display text-2xl font-black text-white hover:bg-red-600/90"
              >
                <Siren size={24} /> Call 999
              </a>
            </Step>

            <Step n={2} title="A concern about county training, a coach, or anyone in tennis">
              <p>
                Report it to the <strong className="text-primary-foreground">LTA Safeguarding Team</strong> using their
                online form — including a worry about a player's life away from tennis. This is the route Suffolk LTA's
                policy sets for county activities. The LTA looks at every concern and involves our County Safeguarding
                Officer where it needs to.
              </p>
              <a
                href={LTA_CONCERN_FORM}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-3 rounded-2xl bg-lta-cyan px-6 py-3.5 font-display text-lg font-black uppercase tracking-wide text-suffolk-navy hover:bg-lta-cyan/90"
              >
                <ShieldCheck size={22} /> Report a safeguarding concern <ArrowUpRight size={20} />
              </a>
            </Step>

            <Step n={3} title="You'd rather speak to children's services directly">
              <p>Suffolk's local authority line, Customer First, takes concerns about any child or adult. The call is free.</p>
              <PhoneLink number="0808 800 4005" />
            </Step>

            <Step n={4} title="Not sure, and want to talk it through">
              <p>The NSPCC will listen and advise on any worry about a child's safety or wellbeing.</p>
              <div className="flex flex-wrap gap-3">
                <PhoneLink number="0808 800 5000" label="NSPCC" />
              </div>
              <p>
                If you are a young person and want to talk to someone yourself, Childline is free, confidential and
                there for anyone under 19.
              </p>
              <div className="flex flex-wrap gap-3">
                <PhoneLink number="0800 1111" label="Childline" />
              </div>
            </Step>
          </ol>
        </div>
      </section>

      {/* Who's who */}
      <section className="border-t border-primary-foreground/10 py-16" aria-labelledby="people">
        <div className="container mx-auto px-6">
          <h2 id="people" className="font-display text-3xl font-black md:text-4xl">Who looks after safeguarding</h2>
          <div className="mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 md:p-7">
              <span className="text-xs font-semibold uppercase tracking-widest text-lta-cyan">County Safeguarding Officer</span>
              <p className="mt-2 font-display text-2xl font-black">Beth Hamilton</p>
              <p className="mt-2 font-body text-sm text-primary-foreground/70">
                Responsible for safeguarding across Suffolk's county activities. Get in touch with questions about how
                we keep players safe. To report a concern, please use the LTA form above — that makes sure it reaches
                everyone who needs to know, Beth included.
              </p>
              <div className="mt-4 flex flex-col gap-2 font-body">
                <a href={tel("07807 230257")} className="inline-flex items-center gap-2 font-semibold text-lta-cyan hover:underline">
                  <Phone size={16} /> 07807 230257
                </a>
                <a href="mailto:safeguarding@suffolklta.uk" className="inline-flex items-center gap-2 font-semibold text-lta-cyan hover:underline">
                  <Mail size={16} /> safeguarding@suffolklta.uk
                </a>
              </div>
            </div>
            <div className="rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 md:p-7">
              <span className="text-xs font-semibold uppercase tracking-widest text-lta-cyan">LTA Safeguarding Team</span>
              <p className="mt-2 font-display text-2xl font-black">David Humphrey</p>
              <p className="mt-1 font-body text-sm text-primary-foreground/60">LTA Lead Safeguarding Officer</p>
              <p className="mt-2 font-body text-sm text-primary-foreground/70">
                The LTA's safeguarding team is responsible for safeguarding in tennis across Britain and handles every
                concern raised about county activities. Contact them through the online concern form.
              </p>
              <a
                href={LTA_CONCERN_FORM}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 font-body font-semibold text-lta-cyan hover:underline"
              >
                safeguardingconcern.lta.org.uk <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* What parents at county training should know */}
      <section className="border-t border-primary-foreground/10 py-16" aria-labelledby="parents">
        <div className="container mx-auto px-6">
          <h2 id="parents" className="font-display text-3xl font-black md:text-4xl">At county training</h2>
          <p className="mt-3 max-w-2xl font-body text-primary-foreground/70">What to expect, and what we ask of parents.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Point icon={HandHeart} title="Hand over and collect from the coach">
              Children under 13 must be handed directly to their coach at the start of a session and collected directly
              from the coach at the end. Dropping off outside or at the venue door isn't enough, and under-13s won't be
              allowed to leave on their own without written permission.
            </Point>
            <Point icon={Car} title="Getting to and from sessions">
              Parents are responsible for arranging transport to and from every county session. Coaches don't transport
              players, other than in an emergency or on a county-organised trip with your written consent.
            </Point>
            <Point icon={Users} title="Coaches and supervision">
              Everyone working with children at county activities is recruited safely and DBS checked where required.
              LTA-accredited coaches complete safeguarding training, sessions follow the LTA's coach-to-player ratios,
              and trips away from a session — including to the toilet — are supervised.
            </Point>
            <Point icon={Camera} title="Photos and video">
              We ask for your consent before your child is photographed or filmed, as part of booking their place.
            </Point>
            <Point icon={MessageCircle} title="How we communicate">
              Day-to-day messages go through your child's age-group WhatsApp group, which you're added to when you
              accept a place, and by email.
            </Point>
            <Point icon={Megaphone} title="Speaking up is always right">
              We want everyone to feel able to raise a concern, confident it will be taken seriously and responded to
              quickly — and anyone who raises one will be supported.
            </Point>
          </div>
        </div>
      </section>

      {/* Documents */}
      <section className="border-t border-primary-foreground/10 py-16" aria-labelledby="documents">
        <div className="container mx-auto px-6">
          <h2 id="documents" className="font-display text-3xl font-black md:text-4xl">Policies and documents</h2>
          <div className="mt-8 grid max-w-4xl gap-4 md:grid-cols-3">
            <a
              href={POLICY_PDF}
              target="_blank"
              rel="noreferrer"
              className="group rounded-3xl border border-lta-cyan/30 bg-primary-foreground/5 p-6 transition-colors hover:border-lta-cyan hover:bg-primary-foreground/10"
            >
              <FileText className="text-lta-cyan" size={26} strokeWidth={1.8} />
              <p className="mt-4 font-display text-lg font-black leading-tight">Suffolk LTA Safeguarding Policy and Procedures</p>
              <p className="mt-2 font-body text-sm text-primary-foreground/60">October 2025 · PDF</p>
            </a>
            <a
              href="https://www.lta.org.uk/about-us/what-we-do/governance-and-structure/rules-regulations/"
              target="_blank"
              rel="noreferrer"
              className="group rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 transition-colors hover:border-lta-cyan hover:bg-primary-foreground/10"
            >
              <Users className="text-lta-cyan" size={26} strokeWidth={1.8} />
              <p className="mt-4 font-display text-lg font-black leading-tight">LTA Code of Conduct</p>
              <p className="mt-2 inline-flex items-center gap-1 font-body text-sm text-primary-foreground/60">The standards everyone in tennis is held to <ArrowUpRight size={14} /></p>
            </a>
            <a
              href="https://www.lta.org.uk/about-us/safeguarding/venue-standards/"
              target="_blank"
              rel="noreferrer"
              className="group rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 transition-colors hover:border-lta-cyan hover:bg-primary-foreground/10"
            >
              <ShieldCheck className="text-lta-cyan" size={26} strokeWidth={1.8} />
              <p className="mt-4 font-display text-lg font-black leading-tight">LTA Safeguarding Standards</p>
              <p className="mt-2 inline-flex items-center gap-1 font-body text-sm text-primary-foreground/60">What the LTA expects of every venue <ArrowUpRight size={14} /></p>
            </a>
          </div>
        </div>
      </section>

      {/* Whistleblowing */}
      <section className="border-t border-primary-foreground/10 py-16" aria-labelledby="whistleblowing">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <h2 id="whistleblowing" className="font-display text-3xl font-black md:text-4xl">If a concern isn't being dealt with</h2>
            <p className="mt-3 font-body text-primary-foreground/70">
              If you think a concern has been ignored or covered up, that safeguarding procedures aren't being followed,
              or you're worried about what might happen if you speak up, please contact the county first. If you'd
              rather speak to someone outside the county and the LTA, you can:
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-6">
                <p className="font-display text-lg font-black">NSPCC Whistleblowing Advice Line</p>
                <div className="mt-3 flex flex-col gap-2 font-body">
                  <a href={tel("0800 028 0285")} className="inline-flex items-center gap-2 font-semibold text-lta-cyan hover:underline">
                    <Phone size={16} /> 0800 028 0285
                  </a>
                  <a href="mailto:help@nspcc.org.uk" className="inline-flex items-center gap-2 font-semibold text-lta-cyan hover:underline">
                    <Mail size={16} /> help@nspcc.org.uk
                  </a>
                </div>
              </div>
              <div className="rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-6">
                <p className="font-display text-lg font-black">Safecall</p>
                <p className="mt-1 font-body text-sm text-primary-foreground/60">Independent and confidential, and anonymous if you want it to be.</p>
                <div className="mt-3 flex flex-col gap-2 font-body">
                  <a href={tel("0800 915 1571")} className="inline-flex items-center gap-2 font-semibold text-lta-cyan hover:underline">
                    <Phone size={16} /> 0800 915 1571
                  </a>
                  <External href="https://www.safecall.co.uk/report">Report online <ArrowUpRight size={14} className="inline" /></External>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-12 max-w-3xl font-body text-xs leading-relaxed text-primary-foreground/45">
            County training is run under the Suffolk Lawn Tennis Association Safeguarding Policy and Procedures, approved
            by the Suffolk LTA Committee on 6 October 2025 and due for review in October 2026.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Safeguarding;
