CREATE TABLE public.suffolk_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.suffolk_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published suffolk news"
ON public.suffolk_news
FOR SELECT
USING (published = true);

INSERT INTO public.suffolk_news (title, content, image_url) VALUES (
  'National Success for Suffolk 9U Boys',
  'After winning the regional event, the Suffolk 9U boys travelled to Southampton to compete against the best teams in the country. The team produced a fantastic performance, finishing 4th nationally and recording impressive victories against Middlesex and Avon.

The eventual winners were Surrey, who secured three wins, showing just how close the competition was at the top.

A standout performance came from Freddie, who played at number one and won 8 out of his 9 matches across the event — a tremendous effort against some of the best young players in the country.

The team was made up of Amay, Arjun, and Rocky, with Harry unfortunately missing out due to illness. Despite this, the boys gained invaluable experience and plenty of court time competing at the highest national level.

A brilliant achievement and a great sign of the strength of Suffolk''s young tennis talent.',
  NULL
);