CREATE OR REPLACE FUNCTION public.assistant_save_reply(p_thread_id uuid, p_text text)
RETURNS TABLE(id uuid, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin')
     OR length(trim(coalesce(p_text, ''))) NOT BETWEEN 1 AND 20000
     OR NOT EXISTS (
       SELECT 1 FROM public.assistant_threads
       WHERE assistant_threads.id = p_thread_id
         AND assistant_threads.user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Administrator access and a valid owned conversation are required';
  END IF;

  RETURN QUERY
  INSERT INTO public.assistant_messages(thread_id, role, parts)
  VALUES (
    p_thread_id,
    'assistant',
    jsonb_build_array(jsonb_build_object('type', 'text', 'text', trim(p_text)))
  )
  RETURNING assistant_messages.id, assistant_messages.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_save_reply(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assistant_save_reply(uuid, text) TO authenticated;
