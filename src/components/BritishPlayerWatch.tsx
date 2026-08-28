import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, TrendingUp, Play, X, MapPin, ChevronLeft, ChevronRight, Users, Accessibility, ImageIcon } from "lucide-react";
import draperImg from "@/assets/player-draper.jpg";
import raducanuImg from "@/assets/player-raducanu.jpg";
import norrieImg from "@/assets/player-norrie.jpg";
import boulterImg from "@/assets/player-boulter.jpg";
import murrayImg from "@/assets/player-murray.jpg";
import henmanImg from "@/assets/player-henman.jpg";
import wadeImg from "@/assets/player-wade.jpg";
import rusedskiImg from "@/assets/player-rusedski.jpg";
import salisburyImg from "@/assets/player-salisbury.jpg";
import skupskiImg from "@/assets/player-skupski.jpg";
import hewettImg from "@/assets/player-hewett.jpg";
import reidImg from "@/assets/player-reid.jpg";
import dartImg from "@/assets/player-dart.jpg";
import pattenImg from "@/assets/player-patten.jpg";
import { heroUrl, photosFor, type PlayerPhoto } from "@/data/playerPhotos";

type PlayerCategory = "singles" | "doubles" | "wheelchair" | "legend";

interface Player {
  /** Key into PLAYER_PHOTOS — see src/data/playerPhotos.ts. */
  slug: string;
  name: string;
  age: number | string;
  ranking: number | string;
  hometown: string;
  hand: string;
  coach: string;
  careerHighRanking: number | string;
  titles: number;
  /** Bundled card image, and the fallback if storage is unreachable. */
  image: string;
  /**
   * Index into this player's gallery to use as the card image instead of the
   * bundled one — set where the bundled shot is too distant to read at card
   * size (Murray's was a full-court wide).
   */
  heroPhoto?: number;
  /** Card crop origin, when the default top-weighted crop clips the head. */
  heroPosition?: string;
  highlights: string[];
  youtubeId: string;
  bio: string;
  category: PlayerCategory;
}

const players: Player[] = [
  // Current singles — all stats verified via Wikipedia & LTA (March 2026)
  {
    slug: "jack-draper",
    name: "Jack Draper",
    age: 24,
    ranking: 14,
    hometown: "Sutton, London",
    hand: "Left-handed",
    coach: "James Trotman",
    careerHighRanking: 4,
    titles: 3,
    image: draperImg,
    highlights: [
      "Career-high ATP ranking of No. 4 (June 2025)",
      "2025 Indian Wells Masters 1000 champion",
      "2024 US Open semi-finalist",
      "Former junior Wimbledon finalist",
    ],
    youtubeId: "EDHq5pQBt84",
    bio: "Jack Draper has emerged as Britain's brightest tennis prospect. The powerful left-hander won his maiden Masters 1000 title at Indian Wells in 2025 and reached a career-high of World No. 4. A former junior Wimbledon finalist, Draper combines explosive serving with exceptional athleticism.",
    category: "singles",
  },
  {
    slug: "emma-raducanu",
    heroPhoto: 0,
    name: "Emma Raducanu",
    age: 23,
    ranking: 61,
    hometown: "Bromley, London",
    hand: "Right-handed",
    coach: "Yutaka Nakamura",
    careerHighRanking: 10,
    titles: 1,
    image: raducanuImg,
    highlights: [
      "2021 US Open champion — as a qualifier",
      "First player ever to win a Grand Slam as a qualifier",
      "Career-high WTA ranking of No. 10",
      "Youngest British Grand Slam winner in the Open Era",
    ],
    youtubeId: "t_5fdj8cQlw",
    bio: "Emma Raducanu made history at the 2021 US Open, becoming the first qualifier — male or female — to win a Grand Slam in the Open Era. Born in Canada to Romanian and Chinese parents, she moved to London aged two and is currently the British No. 1 in women's singles.",
    category: "singles",
  },
  {
    slug: "cameron-norrie",
    name: "Cameron Norrie",
    age: 30,
    ranking: 29,
    hometown: "Johannesburg / London",
    hand: "Left-handed",
    coach: "Facundo Lugones",
    careerHighRanking: 8,
    titles: 5,
    image: norrieImg,
    highlights: [
      "Career-high ATP ranking of No. 8 (September 2022)",
      "Wimbledon semi-finalist 2022",
      "2021 Indian Wells Masters champion",
      "5 ATP Tour singles titles",
    ],
    youtubeId: "IAvyl1bysc4",
    bio: "Cameron Norrie has been one of Britain's most consistent performers on the ATP Tour. Born in South Africa to a Welsh mother and Scottish father, he reached a career-high of No. 8 and made the Wimbledon semi-finals in 2022 with his relentless left-handed baseline game.",
    category: "singles",
  },
  {
    slug: "arthur-fery",
    name: "Arthur Fery",
    age: 28,
    ranking: "—",
    hometown: "London",
    hand: "Right-handed",
    coach: "Calvin Betton",
    careerHighRanking: 141,
    titles: 0,
    // The asset that used to sit here was a different GB player in Davis Cup
    // kit, so there is no local fallback for Fery — Commons has exactly one
    // free photo of him and this is it.
    image: heroUrl("arthur-fery"),
    highlights: [
      "Stanford University NCAA standout",
      "2023 Wimbledon second-round appearance",
      "Multiple ITF & ATP Challenger titles",
      "Regular GB Davis Cup squad member",
    ],
    youtubeId: "8YQK0i8B4kM",
    bio: "Arthur Fery is a rising British men's singles player born in London to French parents. A former Stanford University NCAA star, he made his Wimbledon main-draw debut in 2023 and has climbed the rankings on the ATP Challenger Tour with his intelligent all-court game and clean ball-striking.",
    category: "singles",
  },
  {
    slug: "katie-boulter",
    name: "Katie Boulter",
    age: 29,
    ranking: 64,
    hometown: "Leicester",
    hand: "Right-handed",
    coach: "Diego Mayol",
    careerHighRanking: 23,
    titles: 4,
    image: boulterImg,
    highlights: [
      "Career-high WTA ranking of No. 23 (November 2024)",
      "4 WTA Tour singles titles",
      "Key Billie Jean King Cup team member",
      "Former British No. 1 women's player",
    ],
    youtubeId: "3kX5iejBpbw",
    bio: "Katie Boulter from Leicester established herself as Britain's leading female player in 2024, reaching a career-high of No. 23 with four WTA titles. She combines a powerful serve with aggressive baseline play and is a key member of the Billie Jean King Cup team.",
    category: "singles",
  },
  {
    slug: "harriet-dart",
    heroPhoto: 0,
    name: "Harriet Dart",
    age: 29,
    ranking: 78,
    hometown: "Hampstead, London",
    hand: "Right-handed",
    coach: "Wayne Sheridan",
    careerHighRanking: 70,
    titles: 0,
    image: dartImg,
    highlights: [
      "Career-high WTA singles ranking of No. 70 (September 2024)",
      "2021 Wimbledon mixed doubles finalist (with Joe Salisbury)",
      "Regular Grand Slam competitor",
      "Billie Jean King Cup regular",
    ],
    youtubeId: "YfGcFMSwPcw",
    bio: "Harriet Dart is a versatile British player who excels in both singles and doubles. She reached a career-high of No. 70 in 2024 and was a Wimbledon mixed doubles finalist in 2021 alongside Joe Salisbury. A consistent performer on Tour, she regularly represents Great Britain in team events.",
    category: "singles",
  },
  // Doubles specialists
  {
    slug: "joe-salisbury",
    name: "Joe Salisbury",
    age: 33,
    ranking: 8,
    hometown: "London",
    hand: "Right-handed",
    coach: "Self-coached",
    careerHighRanking: 1,
    titles: 17,
    image: salisburyImg,
    highlights: [
      "Former doubles World No. 1",
      "6-time Grand Slam doubles champion",
      "4x US Open doubles champion (2021–2023) with Rajeev Ram",
      "2020 Australian Open doubles champion",
    ],
    youtubeId: "Q5kHhgr-5jY",
    bio: "Joe Salisbury is one of the most accomplished doubles players in British history. A former World No. 1, he won six Grand Slam doubles titles — four US Opens and one Australian Open with Rajeev Ram, plus two mixed doubles majors. He also won the 2025 ATP Finals with Neal Skupski.",
    category: "doubles",
  },
  {
    slug: "neal-skupski",
    name: "Neal Skupski",
    age: 36,
    ranking: 1,
    hometown: "Liverpool",
    hand: "Right-handed",
    coach: "Self-coached",
    careerHighRanking: 1,
    titles: 18,
    image: skupskiImg,
    highlights: [
      "Current doubles World No. 1 (returned to top Feb 2026)",
      "4-time Grand Slam doubles champion",
      "2023 Wimbledon doubles champion with Wesley Koolhof",
      "2026 Australian Open doubles champion",
    ],
    youtubeId: "KzJgYnVqKOg",
    bio: "Neal Skupski from Liverpool is one of Britain's finest doubles specialists and the current World No. 1. A four-time Grand Slam champion, he won the 2023 Wimbledon doubles title with Wesley Koolhof and returned to the top of the rankings in February 2026 after winning the Australian Open doubles.",
    category: "doubles",
  },
  {
    slug: "henry-patten",
    name: "Henry Patten",
    age: 29,
    ranking: 4,
    hometown: "Colchester",
    hand: "Left-handed",
    coach: "Calvin Betton",
    careerHighRanking: 3,
    titles: 10,
    image: pattenImg,
    highlights: [
      "2-time Grand Slam doubles champion",
      "2024 Wimbledon doubles champion with Harri Heliövaara",
      "2025 Australian Open doubles champion",
      "Career-high doubles ranking of No. 3 (January 2025)",
    ],
    youtubeId: "eRiSdy_zOzs",
    bio: "Henry Patten from Colchester burst onto the doubles scene by winning the 2024 Wimbledon doubles title with Harri Heliövaara. Standing at 6'6\", the left-hander went on to win the 2025 Australian Open and has continued his rise with titles in Adelaide and Dubai in 2026. A former college player, he turned pro in 2020.",
    category: "doubles",
  },
  // Wheelchair tennis
  {
    slug: "alfie-hewett",
    name: "Alfie Hewett",
    age: 28,
    ranking: 2,
    hometown: "Norwich, Norfolk",
    hand: "Right-handed",
    coach: "Ben Mayoh",
    careerHighRanking: 1,
    titles: 33,
    image: hewettImg,
    highlights: [
      "33 Grand Slam titles (10 singles, 23 doubles)",
      "2024 Paralympic doubles Gold medallist (with Gordon Reid)",
      "Former wheelchair singles World No. 1",
      "Completed the doubles Grand Slam in 2021 with Reid",
    ],
    youtubeId: "qp0oKFi6oMo",
    bio: "Alfie Hewett from Norwich is one of the greatest wheelchair tennis players of all time. He has won a staggering 33 Grand Slam titles — 10 in singles and 23 in doubles with partner Gordon Reid. The pair completed the Grand Slam in doubles in 2021 and won Paralympic Gold together in Paris 2024. A true local East Anglian hero.",
    category: "wheelchair",
  },
  {
    slug: "gordon-reid",
    name: "Gordon Reid",
    age: 34,
    ranking: 7,
    hometown: "Alexandria, Scotland",
    hand: "Right-handed",
    coach: "Self-coached",
    careerHighRanking: 1,
    titles: 29,
    image: reidImg,
    highlights: [
      "Former singles and doubles World No. 1",
      "2 Grand Slam singles titles + record 27 doubles Grand Slams",
      "2 Paralympic Gold medals, 2 Silver, 1 Bronze",
      "2016 Wimbledon wheelchair singles champion",
    ],
    youtubeId: "GxlPGgbQ_mQ",
    bio: "Gordon Reid is a trailblazer in wheelchair tennis. A former World No. 1 in both singles and doubles, he holds a record 27 Grand Slam doubles titles (all with Alfie Hewett) plus 2 singles majors. He has won two Paralympic Gold medals and was the first British player to win the Wimbledon wheelchair singles title in 2016.",
    category: "wheelchair",
  },
  // Legends
  {
    slug: "andy-murray",
    heroPhoto: 0,
    name: "Andy Murray",
    age: 38,
    ranking: "Retired",
    hometown: "Dunblane, Scotland",
    hand: "Right-handed",
    coach: "Retired",
    careerHighRanking: 1,
    titles: 46,
    image: murrayImg,
    highlights: [
      "3-time Grand Slam champion (2012 US Open, 2013 & 2016 Wimbledon)",
      "2-time Olympic Gold medallist (2012 London, 2016 Rio)",
      "Former World No. 1 (41 weeks)",
      "Knighted for services to tennis and charity",
    ],
    youtubeId: "8AEJqFp1iMs",
    bio: "Sir Andy Murray is one of the greatest British sportspeople of all time. He won three Grand Slams, two Olympic Gold medals, the Davis Cup and the ATP World Tour Finals, spending 41 weeks as World No. 1. He retired after the 2024 Paris Olympics, leaving an extraordinary legacy.",
    category: "legend",
  },
  {
    slug: "tim-henman",
    name: "Tim Henman",
    age: 51,
    ranking: "Retired",
    hometown: "Oxford",
    hand: "Right-handed",
    coach: "Retired",
    careerHighRanking: 4,
    titles: 11,
    image: henmanImg,
    highlights: [
      "Career-high ATP ranking of No. 4",
      "4-time Wimbledon semi-finalist",
      "11 ATP Tour singles titles",
      "Paved the way for a generation of British tennis",
    ],
    youtubeId: "xQVLuh2v7fU",
    bio: "Tim Henman was the face of British tennis for over a decade, inspiring a generation with his graceful serve-and-volley game. He reached four Wimbledon semi-finals (1998, 1999, 2001, 2002) and held a career-high ranking of No. 4, winning 11 ATP titles.",
    category: "legend",
  },
  {
    slug: "virginia-wade",
    name: "Virginia Wade",
    age: 80,
    ranking: "Retired",
    hometown: "Bournemouth",
    hand: "Right-handed",
    coach: "Retired",
    careerHighRanking: 2,
    titles: 55,
    image: wadeImg,
    highlights: [
      "1977 Wimbledon champion (last British woman to win)",
      "3-time Grand Slam singles champion",
      "Career-high WTA ranking of No. 2",
      "International Tennis Hall of Fame inductee",
    ],
    youtubeId: "TbwlCGz-KFc",
    bio: "Virginia Wade remains the last British woman to win Wimbledon, triumphing in 1977 in the tournament's centenary year before Queen Elizabeth II. She won three Grand Slam singles titles in total (also the 1968 US Open and 1972 Australian Open) and was inducted into the International Tennis Hall of Fame.",
    category: "legend",
  },
  {
    slug: "greg-rusedski",
    heroPhoto: 0,
    heroPosition: "50% 0%",
    name: "Greg Rusedski",
    age: 52,
    ranking: "Retired",
    hometown: "Montreal / London",
    hand: "Left-handed",
    coach: "Retired",
    careerHighRanking: 4,
    titles: 15,
    image: rusedskiImg,
    highlights: [
      "1997 US Open finalist",
      "Career-high ATP ranking of No. 4",
      "Once held the fastest serve record (149 mph)",
      "15 ATP Tour singles titles",
    ],
    youtubeId: "_1DpmMucpok",
    bio: "Greg Rusedski thrilled fans with one of the biggest left-handed serves in tennis history — once holding the record for the fastest serve at 149 mph. Born in Canada, he represented Great Britain from 1995, reaching the 1997 US Open final and winning the BBC Sports Personality of the Year.",
    category: "legend",
  },
];

const categoryLabels: Record<PlayerCategory, { label: string; icon: typeof Trophy }> = {
  singles: { label: "Singles Stars", icon: Trophy },
  doubles: { label: "Doubles Specialists", icon: Users },
  wheelchair: { label: "Wheelchair Champions", icon: Accessibility },
  legend: { label: "Legends of the Game", icon: Trophy },
};

const BritishPlayerWatch = () => {
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<PlayerCategory | "all">("all");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredPlayers = activeCategory === "all" ? players : players.filter((p) => p.category === activeCategory);

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
    }
  };

  /**
 * Card image for a player: the gallery shot where one is nominated, otherwise
 * the bundled asset. Storage is a network hop, so callers pair this with an
 * onError that falls back to the bundled image.
 */
const heroSrc = (p: Player): string =>
  (p.heroPhoto !== undefined ? photosFor(p.slug)[p.heroPhoto]?.url : undefined) ?? p.image;

/** Hero first, then the rest of the gallery, with no duplicate of the hero. */
const galleryFor = (p: Player): PlayerPhoto[] => {
  const photos = photosFor(p.slug);
  if (photos.length === 0) return [];
  if (p.heroPhoto === undefined) return photos;
  const hero = photos[p.heroPhoto];
  return [hero, ...photos.filter((x) => x !== hero)];
};

const categoryColor = (cat: PlayerCategory) => {
    switch (cat) {
      case "singles": return "bg-[hsl(var(--lta-cyan))]/20 text-[hsl(var(--lta-cyan))]";
      case "doubles": return "bg-[hsl(var(--suffolk-gold))]/20 text-[hsl(var(--suffolk-gold))]";
      case "wheelchair": return "bg-green-500/20 text-green-400";
      case "legend": return "bg-purple-500/20 text-purple-400";
    }
  };

  return (
    <section className="py-24 bg-[hsl(var(--suffolk-navy))]">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full mb-4"
          >
            <Trophy size={14} className="text-[hsl(var(--suffolk-gold))]" />
            <span className="text-sm font-semibold text-white/70 uppercase tracking-widest">Inspiration</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-4xl md:text-5xl font-black text-white mb-4"
          >
            British <span className="text-[hsl(var(--lta-cyan))]">Player Watch</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-white/60 text-lg font-body"
          >
            Follow Britain's top professional players — singles stars, doubles specialists, wheelchair champions,
            and legends who inspire the next generation.
          </motion.p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeCategory === "all"
                ? "bg-white text-[hsl(var(--suffolk-navy))]"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            All Players ({players.length})
          </button>
          {(Object.keys(categoryLabels) as PlayerCategory[]).map((cat) => {
            const count = players.filter((p) => p.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeCategory === cat
                    ? "bg-white text-[hsl(var(--suffolk-navy))]"
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                {categoryLabels[cat].label} ({count})
              </button>
            );
          })}
        </div>

        {/* Scroll controls */}
        <div className="relative">
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 backdrop-blur-sm text-white p-2 rounded-full hover:bg-black/70 transition-colors hidden md:flex"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 backdrop-blur-sm text-white p-2 rounded-full hover:bg-black/70 transition-colors hidden md:flex"
          >
            <ChevronRight size={24} />
          </button>

          {/* Scrolling Player Cards */}
          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory md:px-10"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {filteredPlayers.map((player, i) => (
              <motion.div
                key={player.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                onClick={() => { setSelectedPlayer(players.indexOf(player)); setGalleryIndex(0); }}
                className="group cursor-pointer rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-[hsl(var(--lta-cyan))]/40 transition-all hover:-translate-y-1 flex-shrink-0 w-[240px] snap-start"
              >
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={heroSrc(player)}
                    alt={player.name}
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src !== player.image) img.src = player.image;
                    }}
                    style={{ objectPosition: player.heroPosition ?? "50% 15%" }}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className={`absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${categoryColor(player.category)}`}>
                    {player.category === "wheelchair" ? "Wheelchair" : player.category === "doubles" ? "Doubles" : player.category === "legend" ? "Legend" : "Singles"}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Play size={20} className="text-white ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-display font-black text-white text-lg leading-tight">{player.name}</h3>
                    <p className="text-white/60 text-xs mt-0.5">Age {player.age} · {player.hand}</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[hsl(var(--lta-cyan))] text-xs font-bold">
                      {player.titles} title{player.titles !== 1 ? "s" : ""}
                    </span>
                    <span className="text-white/40 text-xs">
                      Peak #{player.careerHighRanking}
                    </span>
                  </div>
                  <p className="text-white/50 text-xs line-clamp-2">{player.highlights[0]}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Player Detail Modal */}
      <AnimatePresence>
        {selectedPlayer !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedPlayer(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[hsl(var(--suffolk-navy))] border border-white/10 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              {(() => {
                const p = players[selectedPlayer];
                const gallery = galleryFor(p);
                // Always have something to show even if the library is empty.
                const allImages: PlayerPhoto[] =
                  gallery.length > 0
                    ? gallery
                    : [{ url: p.image, credit: "", licence: "", source: "" }];
                const shown = allImages[Math.min(galleryIndex, allImages.length - 1)];
                return (
                  <>
                    {/* Gallery Hero */}
                    <div className="relative h-72 overflow-hidden rounded-t-3xl">
                      <img
                        src={shown.url}
                        alt={`${p.name} - photo ${galleryIndex + 1}`}
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.src !== p.image) img.src = p.image;
                        }}
                        className="w-full h-full object-cover object-[50%_20%] transition-all duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--suffolk-navy))] via-[hsl(var(--suffolk-navy))]/40 to-transparent" />
                      <button
                        onClick={() => setSelectedPlayer(null)}
                        className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/30 rounded-full p-2 transition-colors"
                      >
                        <X size={20} />
                      </button>

                      {/* Gallery navigation arrows */}
                      {allImages.length > 1 && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setGalleryIndex((prev) => (prev - 1 + allImages.length) % allImages.length); }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-sm text-white p-2 rounded-full hover:bg-black/60 transition-colors"
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setGalleryIndex((prev) => (prev + 1) % allImages.length); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-sm text-white p-2 rounded-full hover:bg-black/60 transition-colors"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </>
                      )}

                      {/* Gallery dots */}
                      {allImages.length > 1 && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {allImages.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => { e.stopPropagation(); setGalleryIndex(idx); }}
                              className={`w-2 h-2 rounded-full transition-all ${
                                idx === galleryIndex ? "bg-white w-5" : "bg-white/40 hover:bg-white/60"
                              }`}
                            />
                          ))}
                        </div>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 p-8">
                        <div className="flex items-end justify-between">
                          <div>
                            <div className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-2 ${categoryColor(p.category)}`}>
                              {p.category === "wheelchair" ? "Wheelchair Tennis" : p.category === "doubles" ? "Doubles Specialist" : p.category === "legend" ? "Legend" : "Singles"}
                            </div>
                            <h3 className="font-display text-3xl font-black text-white">{p.name}</h3>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[hsl(var(--lta-cyan))] text-sm font-semibold">Age {p.age}</span>
                              <span className="text-white/40">·</span>
                              <span className="text-white/60 text-sm flex items-center gap-1">
                                <MapPin size={12} /> {p.hometown}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CC attribution — required by the licence on every photo we show */}
                      {shown.credit && (
                        <a
                          href={shown.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-2 right-3 text-[10px] text-white/40 hover:text-white/70 transition-colors"
                        >
                          Photo: {shown.credit} · {shown.licence}
                        </a>
                      )}
                    </div>

                    <div className="p-8 space-y-8">
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                          <p className="text-[hsl(var(--suffolk-gold))] font-display font-black text-2xl">{p.titles}</p>
                          <p className="text-white/50 text-xs mt-1">Career Titles</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                          <p className="text-[hsl(var(--lta-cyan))] font-display font-black text-2xl">#{p.careerHighRanking}</p>
                          <p className="text-white/50 text-xs mt-1">Career High</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                          <p className="text-white font-display font-black text-2xl">{p.hand.split("-")[0]}</p>
                          <p className="text-white/50 text-xs mt-1">Playing Hand</p>
                        </div>
                      </div>

                      {/* Gallery Thumbnails */}
                      {allImages.length > 1 && (
                        <div>
                          <h4 className="font-display font-bold text-white mb-3 flex items-center gap-2">
                            <ImageIcon size={16} className="text-[hsl(var(--suffolk-gold))]" /> Photo Gallery
                          </h4>
                          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                            {allImages.map((img, idx) => (
                              <button
                                key={idx}
                                onClick={() => setGalleryIndex(idx)}
                                className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                                  idx === galleryIndex ? "border-[hsl(var(--lta-cyan))] scale-105" : "border-white/10 opacity-60 hover:opacity-100"
                                }`}
                              >
                                <img
                                  src={img.url}
                                  alt={`${p.name} ${idx + 1}`}
                                  loading="lazy"
                                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-white/70 font-body leading-relaxed">{p.bio}</p>

                      <div>
                        <h4 className="font-display font-bold text-white mb-3 flex items-center gap-2">
                          <TrendingUp size={16} className="text-[hsl(var(--suffolk-gold))]" /> Career Highlights
                        </h4>
                        <ul className="space-y-2">
                          {p.highlights.map((h) => (
                            <li key={h} className="flex items-start gap-3 text-white/60 text-sm font-body">
                              <span className="w-2 h-2 rounded-full bg-[hsl(var(--lta-cyan))] mt-1.5 shrink-0" />
                              {h}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-display font-bold text-white mb-3 flex items-center gap-2">
                          <Play size={16} className="text-[hsl(var(--suffolk-gold))]" /> Highlights Reel
                        </h4>
                        <div className="rounded-2xl overflow-hidden aspect-video">
                          <iframe
                            src={`https://www.youtube.com/embed/${p.youtubeId}?rel=0`}
                            title={`${p.name} highlights`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default BritishPlayerWatch;
