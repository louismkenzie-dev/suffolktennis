// LTA Performance Pathway Data — sourced from official LTA documentation

export const pathwayStages = [
  {
    age: "9U",
    title: "9 & Under",
    description: "Regional Performance → National Performance. Building foundational skills, love for the game, and multi-sport participation.",
    color: "from-green-400 to-emerald-500",
    link: "https://www.lta.org.uk/compete/performance/aspirational-standards/9u/",
    stage: "Regional Performance → National Performance",
  },
  {
    age: "10U",
    title: "10 & Under",
    description: "Regional Performance → National Performance. Developing competitive habits, technical foundations, and match play experience.",
    color: "from-lta-cyan to-blue-500",
    link: "https://www.lta.org.uk/compete/performance/aspirational-standards/10u/",
    stage: "Regional Performance → National Performance",
  },
  {
    age: "11U",
    title: "11 & Under",
    description: "National Performance → International Junior. Stepping up to national competitions with increased training volume.",
    color: "from-blue-500 to-indigo-500",
    link: "https://www.lta.org.uk/compete/performance/aspirational-standards/11u/",
    stage: "National Performance → International Junior",
  },
  {
    age: "12U",
    title: "12 & Under",
    description: "National Performance → International Junior. GB representation opportunities and international competition exposure.",
    color: "from-indigo-500 to-purple-500",
    link: "https://www.lta.org.uk/compete/performance/aspirational-standards/12u/",
    stage: "National Performance → International Junior",
  },
  {
    age: "14U",
    title: "14 & Under",
    description: "National Performance → International Junior. Full international calendar with increased training demands.",
    color: "from-purple-500 to-pink-500",
    link: "https://www.lta.org.uk/compete/performance/aspirational-standards/14u/",
    stage: "National Performance → International Junior",
  },
  {
    age: "16U",
    title: "16 & Under",
    description: "Competing at 16U level with opportunities for GB representation and Junior Grand Slams.",
    color: "from-pink-500 to-rose-500",
    link: "https://www.lta.org.uk/compete/performance/aspirational-standards/16u/",
    stage: "International Junior → Professional",
  },
  {
    age: "18U",
    title: "18 & Under",
    description: "GB representation, international competitions, Junior Grand Slams and transition to professional tennis.",
    color: "from-rose-500 to-red-500",
    link: "https://www.lta.org.uk/compete/performance/aspirational-standards/18u/",
    stage: "International Junior → Professional",
  },
];

export const weeklyHours9U10U = {
  title: "9U/10U Pathway Progression",
  subtitle: "Regional Performance → National Performance",
  tennis: {
    headers: ["", "9U", "10U"],
    rows: [
      ["Individual Lessons", "2+", "2+"],
      ["Squad Training", "4+", "5+"],
      ["Free Play/Practice Matches**", "2+", "2+"],
      ["Total", "8+", "9+"],
    ],
  },
  athletic: {
    headers: ["", "9U", "10U"],
    rows: [
      ["Tennis Specific (S&C)", "3 sessions", "3 sessions"],
      ["Other Sports", "3+ sessions", "3+ sessions"],
      ["Total", "6+", "6+"],
    ],
  },
  matches: {
    headers: ["", "9U", "10U"],
    rows: [
      ["Official singles & doubles matches", "120+", "100+"],
      ["Win:Loss Ratio", "2:1–3:1", "2:1–3:1"],
    ],
  },
};

export const weeklyHours11U14U = {
  title: "11U/12U/14U Pathway Progression",
  subtitle: "National Performance → International Junior",
  tennis: {
    headers: ["", "11U", "12U", "14U"],
    rows: [
      ["Individual Lessons", "1+", "1+", "1+"],
      ["Small Group Training (2–3 on 1 court)", "3+", "4+", "5+"],
      ["Squad Training", "4+", "3+", "3+"],
      ["Practice Matches**", "2+", "3+", "3+"],
      ["Total", "10+", "11+", "12+"],
    ],
  },
  athletic: {
    headers: ["", "11U", "12U", "14U"],
    rows: [
      ["Tennis Specific (S&C)", "Min 3 sessions", "Min 3 sessions", "Min 3 sessions"],
      ["Other Sports", "2+ sessions", "2+ sessions", "1+ sessions"],
      ["Total", "5+", "5+", "4+"],
    ],
  },
  matches: {
    headers: ["", "11U", "12U", "14U"],
    rows: [
      ["Official singles & doubles matches", "100+", "100+", "100+"],
      ["Win:Loss Ratio", "2:1–3:1", "2:1–3:1", "2:1–3:1"],
    ],
  },
};

export const trainingContext9U10U = [
  {
    title: "Athletic Development",
    content: "Enhancing strength, power, agility, balance, co-ordination and speed is essential for long-term success. Best achieved through multi-sport participation, free play and structured, age-appropriate athletic development sessions with a qualified practitioner.",
  },
  {
    title: "Individual Lessons",
    content: "Important in the early stages for technical development of key fundamentals. Although costly, they allow focused and specific development work with progress seen quickly.",
  },
  {
    title: "Loading",
    content: "Players should increase training volumes steadily and avoid spikes. Signs of overplaying include lack of enjoyment, irritability, constant fatigue, injuries, and lack of improvement. Consider that the skeletal system is not fully formed at these early stages.",
  },
  {
    title: "Free Play / Practice Matches",
    content: "Vital for players to transition newly learnt skills to the match court, with or without coach presence.",
  },
  {
    title: "Official Matches",
    content: "The minimum number of matches recommended for developing match experience and competitive qualities. Match counts may be higher depending on factors listed and the player's love for competition.",
  },
  {
    title: "Other Sports",
    content: "Crucial at this age to help all-round athlete development and reduce pressures associated with specialising in one sport from a very young age.",
  },
  {
    title: "Recovery / Rest",
    content: "Ideally one rest day per week and a 24-hour rest period within the week. Try to factor in four weeks of complete rest per year.",
  },
  {
    title: "Squad Training",
    content: "Enables coaches to stretch players physically and mentally whilst achieving the volumes of practice needed. Encourages ownership of their game in fun, energetic environments with drilling and points play.",
  },
  {
    title: "Tennis Specific Athletic Development (S&C)",
    content: "Vital to prepare players for the future demands of the game and supports injury prevention.",
  },
  {
    title: "Total Tennis Hours",
    content: "A guide for typical term time, ideally spread out evenly. Consider travel time, academic priority, stage of development, parental commitments, playing other sports, and balancing quality over quantity.",
  },
  {
    title: "Win:Loss Ratio",
    content: "Players should aim for a tournament schedule keeping their win:loss ratio between 2:1 and 3:1. This maintains enjoyment with enough losses to drive improvement.",
  },
];

export const trainingContext11U14U = [
  {
    title: "Individual Lessons",
    content: "Important for technical development of key fundamentals. Allows focused and specific development work with progress being seen quickly.",
  },
  {
    title: "Loading",
    content: "Increase volumes steadily and avoid spikes. Signs of overplaying include lack of enjoyment, irritability, fatigue, injuries. It is crucial to understand the player's current growth and maturation status to adjust volume and intensity to mitigate risk of growth-related injuries.",
  },
  {
    title: "Practice Matches",
    content: "Vital for players to transition newly learnt skills to the match court, with or without coach presence.",
  },
  {
    title: "Official Matches",
    content: "Minimum number of matches recommended for match experience and competitive qualities. Exposing players to different environments (clay courts, hot conditions, different styles) is encouraged. Outdoor tennis recommended wherever possible.",
  },
  {
    title: "Other Sports",
    content: "Still encouraged to help all-round athletic development but time spent will naturally decrease as players progress with their tennis.",
  },
  {
    title: "Recovery / Rest",
    content: "Ideally one rest day per week and another 24-hour rest period within the week. Try to factor in four weeks of complete rest per year.",
  },
  {
    title: "Small Group Training",
    content: "Generally 2–3 players on one court with a coach. Highly encouraged as they provide opportunities for full court work, allowing coaches to stretch players and replicate the true demands of the game.",
  },
  {
    title: "Squad Training",
    content: "Important for players to take more ownership of their game in fun, energetic environments. Enables coaches to stretch players physically and mentally whilst achieving the volumes of practice required.",
  },
  {
    title: "Tennis Specific Athletic Development (S&C)",
    content: "Vital to prepare players for the future demands of the game and supports injury prevention.",
  },
  {
    title: "Win:Loss Ratio",
    content: "Aim for a tournament schedule that keeps win:loss ratio between 2:1 and 3:1. This helps maintain confidence but also normalises losing and the learnings that come from it.",
  },
];

export const scoringFormats = [
  {
    ageGroup: "8 & Under",
    color: "bg-red-500",
    formats: "One Match Tie-break (to 10 points, 2 clear at 9-9)",
    grades: "1–5",
  },
  {
    ageGroup: "9 & Under",
    color: "bg-orange-500",
    formats: "One Match Tie-break (to 10 points) · Best of 3 Tie-breaks (to 7 points, 2 clear at 6-6) · One FAST4 set (to 4 games, TB at 3-3)",
    grades: "1–5",
  },
  {
    ageGroup: "10 & Under",
    color: "bg-yellow-500",
    formats: "One FAST4 set (to 4 games, TB at 3-3) · Best of 2 FAST4 sets with a match TB at one set all",
    grades: "1–5",
  },
  {
    ageGroup: "11 & Under",
    color: "bg-green-500",
    formats: "Best of 2 FAST4 sets with a match TB at one set all · Best of 2 TB sets (to 6 games, TB at 6-6) with a match TB · Best of 3 TB sets (to 6 games, TB at 6-6)",
    grades: "1–5",
  },
  {
    ageGroup: "12U / 14U / 16U / 18U",
    color: "bg-blue-500",
    formats: "Best of 2 FAST4 sets with a match TB at one set all · Best of 2 TB sets (to 6 games, TB at 6-6) with a match TB · Best of 3 TB sets (to 6 games, TB at 6-6)",
    grades: "1–5",
  },
];

export const competitionTimescales = [
  { item: "Online entries accept date", detail: "46 days before the start of the competition" },
  { item: "Closing dates", detail: "Grade 2: 21 days · Grade 3: 14 days · Grade 4: 10 days · Grade 5: 7 days before start" },
  { item: "Publication of acceptance lists", detail: "As soon as possible, no later than 72 hours of closing date or before withdrawal deadline" },
  { item: "Withdrawal deadline & draw date", detail: "Grade 3: 12 days · Grade 4: 8 days · Grade 5: 5 days before start" },
  { item: "Publication of match dates/times", detail: "No later than 3 days before the start of the competition" },
  { item: "Publication of draws", detail: "No later than 1 day before the start of the competition" },
  { item: "Results loading", detail: "No later than 3 days (72 hours) after the competition end date" },
];

export const parentalGuidance = {
  favourable: [
    "Showing an interest; emotional, financial and material investment; availability; organisation of family life; transport; nutrition",
    "Knowledge of the competitive sport and tennis world; being a role model; introducing the child to tennis",
    "Introducing the child to a variety of sports in the beginning; sharing other activities",
    "Support; encouragement; comfort; trust",
    "Being a motivator, a guide; being demanding",
    "Putting results in perspective; playing down the importance of competition and defeat; avoiding a focus on rankings",
    "Transmitting values such as fighting spirit, rigour, attention to detail, respect, hard work, discipline, fair play, good behaviour",
    "Establishing a dialogue; decisions must be child-driven; maintaining positive communication",
    "Setting realistic goals; emphasising the importance of play and enjoyment at first, improvement vs results",
    "Developing the child's independence and autonomy",
    "Being present during matches to show support; presence must be neutral, discreet and impassive",
    "Showing respect for players and other parents, tournament organisers, etc.",
    "Giving advice and analysing matches when emotions have cooled down; being positive; teaching the child to think and find their own solutions",
    "With the coach: showing interest for their feedback; being open to advice; showing trust and respect; collaborating",
  ],
  unfavourable: [
    "Being uninvolved; showing no interest; lack of availability",
    "Being ever-present, being intrusive; being overprotective",
    "Focusing family activities on tennis; excessive purchases with no contribution from the child",
    "Forcing the child to play many matches; putting pressure without taking their goals into account",
    "Making accusations; making the child feel guilty; being sarcastic or aggressive",
    "Projecting their own desires and motivations onto the child; idealisation",
    "Overrating the child's level; emphasising the importance of results; reward/punishment system",
    "Disruptive behaviour during matches; making interventions, being demonstrative",
    "Making analyses right at the end of matches; only seeing errors and negative sides",
    "With the coach: interfering, being critical, lack of communication, conflicts",
  ],
};
