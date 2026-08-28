-- County squad lists, 28 Aug 2026.
--
-- Two spreadsheets from Ollie: 34 players on the 10U county squad and 75 on
-- the 11-18 county database. Six of them were not in the roster at all (the
-- ones he had marked in red, plus two with no LTA number), so they are added
-- here; the rest are tagged in place.
--
-- The tag on player_roster is the durable record of squad membership. The two
-- email groups are seeded from it and are then the admin's to edit — pruning
-- or deleting a group never loses a player.

insert into public.player_roster
  (lta_number, first_name, last_name, gender, age_group, contact_email, mobile, marketing_opt_in, source, tags)
values
  (null,'Lilly','Noreika','Female',null,'lioncics@gmail.com','07412101200',null,'county_squad_sheet',array['10U county squad']),
  ('114075268','Amelie','Austin','Female',null,'r.osullivan@hotmail.co.uk','07841534225',null,'county_squad_sheet',array['11-18 county squad']),
  ('114454329','Ariana','Ionescu','Female','11U','sandruhedvig@yahoo.com','07540719479',true,'county_squad_sheet',array['11-18 county squad']),
  ('117475702','Cheng','Ismet Sevindik-Kit','Male',null,'meng.kit@live.co.uk','07850 2799977',null,'county_squad_sheet',array['11-18 county squad']),
  (null,'Daniel','Simpson','Male',null,'msimpson46@googlemail.co.uk','07485244842',null,'county_squad_sheet',array['11-18 county squad']),
  ('113440544','Freddie','Bemrose','Male',null,'abbi.lacey@hotmail.co.uk','07970434482',null,'county_squad_sheet',array['11-18 county squad'])
on conflict do nothing;

-- Two players appear on both sheets, so aggregate per player first: an
-- UPDATE ... FROM only ever applies one matching source row.
with sheet(list_name, lta) as (values
 ('10U county squad','128271551'),
 ('10U county squad','127951064'),
 ('10U county squad','125044435'),
 ('10U county squad','120124198'),
 ('10U county squad','119032907'),
 ('10U county squad','124361998'),
 ('10U county squad','126319225'),
 ('10U county squad','123089512'),
 ('10U county squad','132143799'),
 ('10U county squad','129972369'),
 ('10U county squad','122514142'),
 ('10U county squad','128049663'),
 ('10U county squad','131062552'),
 ('10U county squad','125394712'),
 ('10U county squad','124970578'),
 ('10U county squad','130085177'),
 ('10U county squad','123026638'),
 ('10U county squad','134120679'),
 ('10U county squad','124840023'),
 ('10U county squad','134261831'),
 ('10U county squad','128091609'),
 ('10U county squad','127416726'),
 ('10U county squad','123002147'),
 ('10U county squad','129947365'),
 ('10U county squad','127442692'),
 ('10U county squad','130203868'),
 ('10U county squad','128070262'),
 ('10U county squad','122484941'),
 ('10U county squad','116178036'),
 ('10U county squad','123002021'),
 ('10U county squad','123320979'),
 ('10U county squad','128264327'),
 ('10U county squad','133787373'),
 ('11-18 county squad','119244134'),
 ('11-18 county squad','117197477'),
 ('11-18 county squad','117442923'),
 ('11-18 county squad','113221359'),
 ('11-18 county squad','112118346'),
 ('11-18 county squad','112167101'),
 ('11-18 county squad','117442855'),
 ('11-18 county squad','119032907'),
 ('11-18 county squad','114075268'),
 ('11-18 county squad','119336657'),
 ('11-18 county squad','122429572'),
 ('11-18 county squad','114454329'),
 ('11-18 county squad','112438661'),
 ('11-18 county squad','113374582'),
 ('11-18 county squad','113281626'),
 ('11-18 county squad','117475702'),
 ('11-18 county squad','114477576'),
 ('11-18 county squad','121456506'),
 ('11-18 county squad','120233226'),
 ('11-18 county squad','118878336'),
 ('11-18 county squad','116134629'),
 ('11-18 county squad','114633216'),
 ('11-18 county squad','117848995'),
 ('11-18 county squad','117239248'),
 ('11-18 county squad','130254475'),
 ('11-18 county squad','119056817'),
 ('11-18 county squad','119084327'),
 ('11-18 county squad','113440544'),
 ('11-18 county squad','119245989'),
 ('11-18 county squad','120124198'),
 ('11-18 county squad','114380324'),
 ('11-18 county squad','112911461'),
 ('11-18 county squad','119092751'),
 ('11-18 county squad','112740622'),
 ('11-18 county squad','113285534'),
 ('11-18 county squad','114196367'),
 ('11-18 county squad','121042779'),
 ('11-18 county squad','114191057'),
 ('11-18 county squad','115407025'),
 ('11-18 county squad','113023266'),
 ('11-18 county squad','116845405'),
 ('11-18 county squad','112367804'),
 ('11-18 county squad','124158115'),
 ('11-18 county squad','119851929'),
 ('11-18 county squad','112503827'),
 ('11-18 county squad','118948912'),
 ('11-18 county squad','114264971'),
 ('11-18 county squad','119263239'),
 ('11-18 county squad','112847608'),
 ('11-18 county squad','127993468'),
 ('11-18 county squad','115126825'),
 ('11-18 county squad','119393316'),
 ('11-18 county squad','110646399'),
 ('11-18 county squad','121673591'),
 ('11-18 county squad','119097145'),
 ('11-18 county squad','113429744'),
 ('11-18 county squad','113399231'),
 ('11-18 county squad','126986638'),
 ('11-18 county squad','114264955'),
 ('11-18 county squad','115677977'),
 ('11-18 county squad','112229654'),
 ('11-18 county squad','115925248'),
 ('11-18 county squad','113829753'),
 ('11-18 county squad','114556473'),
 ('11-18 county squad','111991822'),
 ('11-18 county squad','119012021'),
 ('11-18 county squad','119949952'),
 ('11-18 county squad','113011135'),
 ('11-18 county squad','120233537'),
 ('11-18 county squad','114428428'),
 ('11-18 county squad','123030516'),
 ('11-18 county squad','119873354'),
 ('11-18 county squad','127722592'),
 ('11-18 county squad','113020348')
), agg as (
  select lta, array_agg(distinct list_name) as tags from sheet group by lta
)
update public.player_roster r
   set tags = (select array(select distinct unnest(coalesce(r.tags,'{}'::text[]) || a.tags)))
  from agg a
 where r.lta_number = a.lta
   and not (coalesce(r.tags,'{}'::text[]) @> a.tags);

insert into public.email_groups (name, description)
select v.name, v.descr
from (values
 ('10U county players', 'Parents of the players on the 10U county squad sheet (28 Aug 2026). Seeded from the roster tag "10U county squad"; edit freely — the roster keeps the master list.'),
 ('11-18 county players', 'Parents of the players on the 11-18 county database (28 Aug 2026). Seeded from the roster tag "11-18 county squad"; edit freely — the roster keeps the master list.')
) as v(name, descr)
where not exists (select 1 from public.email_groups g where lower(g.name) = lower(v.name));

insert into public.email_preferences (email, source)
select distinct lower(btrim(contact_email)), 'county_squad'
from public.player_roster
where contact_email is not null and btrim(contact_email) <> ''
  and tags && array['10U county squad','11-18 county squad']
on conflict (email) do nothing;

insert into public.email_group_members (group_id, email)
select g.id, lower(btrim(r.contact_email))
from public.player_roster r
join public.email_groups g on g.name = '10U county players'
where r.tags @> array['10U county squad']
  and r.contact_email is not null and btrim(r.contact_email) <> ''
on conflict do nothing;

insert into public.email_group_members (group_id, email)
select g.id, lower(btrim(r.contact_email))
from public.player_roster r
join public.email_groups g on g.name = '11-18 county players'
where r.tags @> array['11-18 county squad']
  and r.contact_email is not null and btrim(r.contact_email) <> ''
on conflict do nothing;
