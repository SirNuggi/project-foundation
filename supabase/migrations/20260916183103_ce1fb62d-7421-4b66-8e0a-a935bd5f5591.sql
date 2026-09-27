ALTER TABLE public.penalty_rules ADD COLUMN IF NOT EXISTS amount numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE public.penalties ADD COLUMN IF NOT EXISTS amount numeric(6,2) NOT NULL DEFAULT 0;

UPDATE public.penalty_rules SET amount = 0.50 WHERE code IN ('three_putt','double_par');
UPDATE public.penalty_rules SET amount = 1.00 WHERE code = 'girly';

UPDATE public.penalties p SET amount = r.amount FROM public.penalty_rules r WHERE r.code = p.code AND p.amount = 0;