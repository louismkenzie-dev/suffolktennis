import { useEffect, useState } from "react";
import { Newspaper, Globe, MapPin, ExternalLink, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import suffolk9uBoys from "@/assets/suffolk-9u-boys.jpeg";

type NewsMedia = { url: string; type: "image" | "video"; name?: string; focal_x?: number; focal_y?: number };

type SuffolkNews = {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  media: NewsMedia[] | null;
  article_date: string | null;
  created_at: string;
};


type BbcArticle = {
  title: string;
  summary: string;
  imageUrl: string;
  articleUrl: string;
  category: string;
};

const fallbackBbcNews: BbcArticle[] = [
  {
    title: "Sinner matches Federer & Djokovic with Indian Wells win",
    summary: "Jannik Sinner becomes the youngest man to complete the set of hard-court trophies with victory over Daniil Medvedev in the Indian Wells final.",
    articleUrl: "https://www.bbc.com/sport/tennis/articles/cze047z42kgo",
    imageUrl: "https://ichef.bbci.co.uk/ace/standard/480/cpsprodpb/64e0/live/aadcae40-20fd-11f1-9bb2-934d2e709884.jpg",
    category: "BBC Sport",
  },
  {
    title: "Norrie replaces Draper as British number one",
    summary: "Cameron Norrie reclaims the British number one ranking after an impressive run at Indian Wells.",
    articleUrl: "https://www.bbc.com/sport/tennis/articles/c4gqvj7442zo",
    imageUrl: "https://ichef.bbci.co.uk/ace/standard/480/cpsprodpb/b2bc/live/0d637d50-2081-11f1-801d-ed3cff6bf876.jpg",
    category: "BBC Sport",
  },
  {
    title: "Sabalenka triumphs at Indian Wells",
    summary: "Aryna Sabalenka caps off a memorable few weeks with victory at Indian Wells.",
    articleUrl: "https://www.bbc.com/sport/tennis/articles/cp8rgg17g15o",
    imageUrl: "https://ichef.bbci.co.uk/ace/standard/480/cpsprodpb/3a65/live/a3c4b860-20fd-11f1-801d-ed3cff6bf876.jpg",
    category: "BBC Sport",
  },
  {
    title: "Djokovic withdraws from Indian Wells with knee injury",
    summary: "Novak Djokovic pulls out of Indian Wells citing a recurring knee problem.",
    articleUrl: "https://www.bbc.com/sport/tennis",
    imageUrl: "https://ichef.bbci.co.uk/ace/standard/480/cpsprodpb/57e8/live/eed50ec0-1f53-11f1-8083-55e7a0cb2da7.jpg",
    category: "BBC Sport",
  },
  {
    title: "Raducanu targets return to top 50",
    summary: "Emma Raducanu says she is feeling confident as she looks to climb the rankings.",
    articleUrl: "https://www.bbc.com/sport/tennis",
    imageUrl: "https://ichef.bbci.co.uk/ace/standard/480/cpsprodpb/cf93/live/dc03cb70-1e39-11f1-b0bc-bb2103b44078.jpg",
    category: "BBC Sport",
  },
  {
    title: "Alcaraz and Sinner set for epic rivalry in 2026",
    summary: "Carlos Alcaraz and Jannik Sinner continue to push each other to new heights.",
    articleUrl: "https://www.bbc.com/sport/tennis",
    imageUrl: "https://ichef.bbci.co.uk/ace/standard/480/cpsprodpb/b8ad/live/5d6fa800-1ead-11f1-9bb2-934d2e709884.jpg",
    category: "BBC Sport",
  },
];

const getCover = (item: SuffolkNews): { url: string; type: "image" | "video"; focal_x?: number; focal_y?: number } => {
  const list = Array.isArray(item.media) ? item.media : [];
  const first = list[0];
  if (first?.url) return { url: first.url, type: first.type, focal_x: first.focal_x, focal_y: first.focal_y };
  if (item.image_url) return { url: item.image_url, type: "image" };
  return { url: suffolk9uBoys, type: "image" };
};

const CoverMedia = ({ item, className }: { item: SuffolkNews; className: string }) => {
  const cover = getCover(item);
  const extra = (Array.isArray(item.media) ? item.media.length : 0) - 1;
  const fx = typeof cover.focal_x === "number" ? cover.focal_x : 50;
  const fy = typeof cover.focal_y === "number" ? cover.focal_y : 20;
  const objectPosition = `${fx}% ${fy}%`;
  return (
    <div className={`relative ${className}`}>
      {cover.type === "video" ? (
        <video src={cover.url} className="w-full h-full object-cover" style={{ objectPosition }} controls playsInline />
      ) : (
        <img src={cover.url} alt={item.title} className="w-full h-full object-cover" style={{ objectPosition }} />
      )}
      {extra > 0 && (
        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-1 rounded-full">
          +{extra} more
        </span>
      )}
    </div>
  );
};

const SuffolkNewsCard = ({ item }: { item: SuffolkNews }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.content.length > 180;
  const displayDate = item.article_date || item.created_at;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <article className="bg-white/5 rounded-xl overflow-hidden border border-white/5 flex flex-col h-full hover:border-[hsl(var(--suffolk-gold))]/30 transition-colors">
      <CoverMedia item={item} className="w-full aspect-[16/10] overflow-hidden" />
      <div className="p-4 flex flex-col flex-1">
        <div className="inline-flex items-center gap-1.5 self-start mb-2 px-2 py-1 rounded-full bg-[hsl(var(--suffolk-gold))]/15 border border-[hsl(var(--suffolk-gold))]/30">
          <Calendar size={11} className="text-[hsl(var(--suffolk-gold))]" />
          <span className="text-[hsl(var(--suffolk-gold))] text-[11px] font-semibold">{formatDate(displayDate)}</span>
        </div>
        <h4 className="text-white font-bold text-base mb-2 leading-tight line-clamp-2">{item.title}</h4>
        {/* line-clamp only behaves on direct text content — clamping a stack of
            <p> blocks lets the hidden overflow paint over the card below. When
            collapsed, render the content flattened to one clampable paragraph. */}
        <div className="text-white/60 text-xs leading-relaxed flex-1">
          {!expanded && isLong ? (
            <p className="line-clamp-3">{item.content.replace(/\s*\n+\s*/g, ' ')}</p>
          ) : (
            item.content.split('\n\n').map((para, idx) => (
              <p key={idx} className={idx > 0 ? 'mt-2' : ''}>{para}</p>
            ))
          )}
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 mt-3 self-start text-[hsl(var(--suffolk-gold))] text-[11px] font-semibold hover:text-[hsl(var(--suffolk-gold))]/80 transition-colors"
          >
            {expanded ? <>Show less <ChevronUp size={11} /></> : <>Read more <ChevronDown size={11} /></>}
          </button>
        )}
      </div>
    </article>
  );
};

const SUFFOLK_INITIAL = 6;
const SUFFOLK_STEP = 6;

const NewsSection = () => {
  const [suffolkNews, setSuffolkNews] = useState<SuffolkNews[]>([]);
  const [suffolkVisible, setSuffolkVisible] = useState(SUFFOLK_INITIAL);
  const [nationalNews, setNationalNews] = useState<BbcArticle[]>(fallbackBbcNews);
  const [showAllNational, setShowAllNational] = useState(false);

  useEffect(() => {
    const fetchSuffolkNews = async () => {
      const { data } = await supabase
        .from("suffolk_news")
        .select("*")
        .eq("published", true)
        .order("article_date", { ascending: false, nullsFirst: false });
      if (data) setSuffolkNews(((data as unknown) as SuffolkNews[]));

    };

    const fetchNationalNews = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("lta-news");
        if (!error && data?.articles?.length > 0) {
          setNationalNews(data.articles.slice(0, 6));
        }
      } catch {
        // Keep fallback data
      }
    };

    fetchSuffolkNews();
    fetchNationalNews();
  }, []);

  const visibleSuffolk = suffolkNews.slice(0, suffolkVisible);
  const hasMoreSuffolk = suffolkVisible < suffolkNews.length;
  const hasExpandedSuffolk = suffolkVisible > SUFFOLK_INITIAL;

  return (
    <section className="py-20 bg-[hsl(var(--suffolk-navy))]">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
            <Newspaper size={16} className="text-[hsl(var(--suffolk-gold))]" />
            <span className="text-white/80 text-sm font-semibold tracking-wider uppercase">
              Latest Tennis News
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white font-heading">
            Stay Up to Date
          </h2>
        </div>

        {/* Suffolk Local News — Featured grid */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <MapPin size={32} className="text-[hsl(var(--suffolk-gold))]" />
            <h3 className="text-3xl md:text-5xl font-extrabold text-white font-heading tracking-tight">
              Suffolk Tennis News
            </h3>
          </div>

          {suffolkNews.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">
              No Suffolk news available yet.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleSuffolk.map((item) => (
                  <SuffolkNewsCard key={item.id} item={item} />
                ))}
              </div>
              {(hasMoreSuffolk || hasExpandedSuffolk) && (
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  {hasMoreSuffolk && (
                    <button
                      onClick={() => setSuffolkVisible((v) => v + SUFFOLK_STEP)}
                      className="flex-1 py-3 rounded-xl bg-[hsl(var(--suffolk-gold))]/15 hover:bg-[hsl(var(--suffolk-gold))]/25 border border-[hsl(var(--suffolk-gold))]/40 text-[hsl(var(--suffolk-gold))] text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      Load older articles ({suffolkNews.length - suffolkVisible} more) <ChevronDown size={14} />
                    </button>
                  )}
                  {hasExpandedSuffolk && (
                    <button
                      onClick={() => setSuffolkVisible(SUFFOLK_INITIAL)}
                      className="sm:w-48 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      Show less <ChevronUp size={14} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>


        {/* National News — Below */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <Globe size={22} className="text-[hsl(var(--suffolk-gold))]" />
            <h3 className="text-xl font-bold text-white">National News</h3>
            <span className="ml-auto text-xs text-white/40">via LTA</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(showAllNational ? nationalNews : nationalNews.slice(0, 4)).map((item, i) => (
              <a
                key={i}
                href={item.articleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 bg-white/5 hover:bg-white/10 rounded-xl p-3 transition-all duration-300 border border-white/5 hover:border-[hsl(var(--suffolk-gold))]/30"
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-xs leading-tight mb-1 group-hover:text-[hsl(var(--suffolk-gold))] transition-colors line-clamp-2">
                    {item.title}
                  </h4>
                  <p className="text-white/50 text-[11px] leading-relaxed line-clamp-2">
                    {item.summary}
                  </p>
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[hsl(var(--suffolk-gold))]/70 text-[10px] group-hover:text-[hsl(var(--suffolk-gold))] transition-colors">
                    Read more <ExternalLink size={9} />
                  </span>
                </div>
              </a>
            ))}
          </div>
          {!showAllNational && nationalNews.length > 4 && (
            <button
              onClick={() => setShowAllNational(true)}
              className="w-full mt-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[hsl(var(--suffolk-gold))]/30 text-[hsl(var(--suffolk-gold))] text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2"
            >
              Read More News <ChevronDown size={14} />
            </button>
          )}
          {showAllNational && nationalNews.length > 4 && (
            <button
              onClick={() => setShowAllNational(false)}
              className="w-full mt-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[hsl(var(--suffolk-gold))]/30 text-[hsl(var(--suffolk-gold))] text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2"
            >
              Show Less <ChevronUp size={14} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default NewsSection;
