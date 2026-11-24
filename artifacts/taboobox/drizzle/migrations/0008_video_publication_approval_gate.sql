BEGIN;

CREATE TABLE public.video_approval_records (
  video_id text PRIMARY KEY,
  video_data jsonb NOT NULL,
  approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
ALTER TABLE public.video_approval_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_approval_records FROM anon, authenticated;
GRANT SELECT ON public.video_approval_records TO authenticated;
CREATE POLICY video_approval_admin_read ON public.video_approval_records
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_video_approval(
  p_video_id text, p_video_data jsonb, p_confirmed boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_confirmed IS DISTINCT FROM true OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Explicit administrator approval required';
  END IF;
  IF p_video_id IS NULL OR length(p_video_id) NOT BETWEEN 1 AND 120
     OR jsonb_typeof(p_video_data) <> 'object'
     OR p_video_data->>'id' IS DISTINCT FROM p_video_id THEN
    RAISE EXCEPTION 'Invalid video approval payload';
  END IF;
  IF length(trim(coalesce(p_video_data->>'title',''))) NOT BETWEEN 1 AND 300
     OR length(coalesce(p_video_data->>'title_ar','')) > 300
     OR length(coalesce(p_video_data->>'description','')) > 10000 THEN
    RAISE EXCEPTION 'Invalid video metadata';
  END IF;
  IF p_video_data->>'category' NOT IN ('action','drama','thriller','horror','documentary','music','sports','classic') THEN
    RAISE EXCEPTION 'Invalid video category';
  END IF;
  IF coalesce(p_video_data->>'embed_url','') !~ '^https://(cloudfam\.io/embed/[A-Za-z0-9_-]+|([a-z0-9-]+\.)?youtube(-nocookie)?\.com/embed/[A-Za-z0-9_-]+|youtu\.be/[A-Za-z0-9_-]+|player\.vimeo\.com/video/[0-9]+|vimeo\.com/[0-9]+|geo\.dailymotion\.com/player/[a-z0-9]+\.html\?video=[A-Za-z0-9]+|www\.dailymotion\.com/embed/video/[A-Za-z0-9]+|archive\.org/embed/[A-Za-z0-9_.-]+)$' THEN
    RAISE EXCEPTION 'Unsupported or unsafe video embed URL';
  END IF;
  IF EXISTS (SELECT 1 FROM public.videos WHERE id = p_video_id) THEN
    RAISE EXCEPTION 'Video is already in the archive';
  END IF;
  INSERT INTO public.video_approval_records(video_id, video_data, approved_by, approved_at, published_at)
  VALUES (p_video_id, p_video_data, auth.uid(), now(), NULL)
  ON CONFLICT (video_id) DO UPDATE
    SET video_data = EXCLUDED.video_data, approved_by = EXCLUDED.approved_by, approved_at = now()
    WHERE public.video_approval_records.published_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approval already consumed'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.record_video_approval(text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_video_approval(text, jsonb, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_unapproved_video_publication()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published')
     AND coalesce(current_setting('taboobox.publish_approved_video', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Use the approval-checked publishing function';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_unapproved_video_publication() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS prevent_unapproved_video_publication ON public.videos;
CREATE TRIGGER prevent_unapproved_video_publication
  BEFORE INSERT OR UPDATE OF status ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.prevent_unapproved_video_publication();

CREATE OR REPLACE FUNCTION public.publish_approved_video(
  p_video_id text, p_video_data jsonb, p_confirmed boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE approval public.video_approval_records%ROWTYPE;
BEGIN
  IF p_confirmed IS DISTINCT FROM true OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Explicit administrator confirmation required';
  END IF;
  SELECT * INTO approval FROM public.video_approval_records WHERE video_id = p_video_id FOR UPDATE;
  IF NOT FOUND OR approval.approved_by <> auth.uid() OR approval.published_at IS NOT NULL
     OR approval.video_data IS DISTINCT FROM p_video_data THEN
    RAISE EXCEPTION 'No matching unused individual approval';
  END IF;
  PERFORM set_config('taboobox.publish_approved_video', 'on', true);
  INSERT INTO public.videos(id, title, title_ar, description, category, thumbnail, embed_url, views, likes, duration, status, quality, quality_source, created_at)
  VALUES (
    p_video_data->>'id', p_video_data->>'title', coalesce(p_video_data->>'title_ar',''),
    coalesce(p_video_data->>'description',''), p_video_data->>'category', coalesce(p_video_data->>'thumbnail',''),
    p_video_data->>'embed_url', greatest(0, coalesce((p_video_data->>'views')::integer,0)),
    greatest(0, coalesce((p_video_data->>'likes')::integer,0)), coalesce(p_video_data->>'duration','0:00'),
    'published', nullif(p_video_data->>'quality',''), coalesce(p_video_data->>'quality_source','unknown'),
    coalesce((p_video_data->>'created_at')::timestamptz, now())
  );
  UPDATE public.video_approval_records SET published_at = now() WHERE video_id = p_video_id;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_approved_video(text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_approved_video(text, jsonb, boolean) TO authenticated;

DROP POLICY IF EXISTS "Admins insert" ON public.videos;
CREATE POLICY "Admins insert pending only" ON public.videos
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND status = 'pending');

COMMIT;
