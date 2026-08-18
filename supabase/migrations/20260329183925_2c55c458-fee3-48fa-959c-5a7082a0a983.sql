-- Fix entries titled "Individual" that were saved as tennis_training → should be individual_lesson
UPDATE sporting_schedule 
SET category = 'individual_lesson' 
WHERE category = 'tennis_training' 
AND LOWER(title) LIKE '%individual%';

-- Fix "With Simon Thadani" physical_training → should be tennis_sc (it's S&C / tennis specific)
UPDATE sporting_schedule 
SET category = 'tennis_sc' 
WHERE category = 'physical_training';

-- Fix "Football" and similar entries stored as 'other' → should be other_sport
UPDATE sporting_schedule 
SET category = 'other_sport' 
WHERE category = 'other';

-- Fix remaining tennis_training (Group Coaching = squad_training)
UPDATE sporting_schedule 
SET category = 'squad_training' 
WHERE category = 'tennis_training';