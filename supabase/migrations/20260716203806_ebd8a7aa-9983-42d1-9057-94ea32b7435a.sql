
CREATE OR REPLACE FUNCTION public.compute_profile_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  score int := 0;
  artwork_count int := 0;
  answered int := 0;
BEGIN
  SELECT count(*) INTO artwork_count FROM public.artworks WHERE user_id = NEW.id;
  IF artwork_count >= 10 THEN score := score + 50; END IF;

  SELECT
    (CASE WHEN coalesce(q1,'') <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN coalesce(q2,'') <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN coalesce(q3,'') <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN coalesce(q4,'') <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN coalesce(q5,'') <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN coalesce(q6,'') <> '' THEN 1 ELSE 0 END)
    INTO answered
  FROM public.questionnaires WHERE user_id = NEW.id;
  answered := coalesce(answered, 0);
  IF answered >= 6 THEN score := score + 50; END IF;

  IF score > 100 THEN score := 100; END IF;
  NEW.completion_percent := score;

  IF score >= 100 AND NEW.application_status = 'draft' THEN
    NEW.application_status := 'submitted';
    NEW.application_submitted_at := now();
  END IF;

  RETURN NEW;
END $function$;

-- Also recompute when artworks OR questionnaires change, so the trigger on profiles fires
CREATE OR REPLACE FUNCTION public.recompute_profile_on_questionnaire_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid;
BEGIN
  _uid := coalesce(NEW.user_id, OLD.user_id);
  UPDATE public.profiles SET updated_at = now() WHERE id = _uid;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_recompute_profile_on_questionnaire ON public.questionnaires;
CREATE TRIGGER trg_recompute_profile_on_questionnaire
AFTER INSERT OR UPDATE OR DELETE ON public.questionnaires
FOR EACH ROW EXECUTE FUNCTION public.recompute_profile_on_questionnaire_change();
