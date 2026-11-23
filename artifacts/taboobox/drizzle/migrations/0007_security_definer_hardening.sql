ALTER FUNCTION public.assistant_clear_conversation(uuid) SET search_path = '';
ALTER FUNCTION public.assistant_create_task(uuid,text,text,boolean,uuid) SET search_path = '';
ALTER FUNCTION public.assistant_delete_automation(uuid,boolean) SET search_path = '';
ALTER FUNCTION public.assistant_manage_thread(uuid,text,text,boolean) SET search_path = '';
ALTER FUNCTION public.assistant_message_saved() SET search_path = '';
ALTER FUNCTION public.assistant_save_automation(uuid,text,text,timestamptz,text,boolean,boolean) SET search_path = '';
ALTER FUNCTION public.claim_migrated_identity() SET search_path = '';
ALTER FUNCTION public.handle_new_user_role() SET search_path = '';
ALTER FUNCTION public.support_admin_read(uuid) SET search_path = '';
ALTER FUNCTION public.support_create_contact(text,text,text,text,text,uuid,text,text,text,text) SET search_path = '';
ALTER FUNCTION public.support_message_saved() SET search_path = '';
ALTER FUNCTION public.support_report_action(uuid,text,boolean) SET search_path = '';
ALTER FUNCTION public.support_video_deleted() SET search_path = '';

ALTER FUNCTION public.has_role(uuid,public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.has_role(uuid,public.app_role) SET search_path = '';
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.claim_migrated_identity() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.support_message_saved() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.support_video_deleted() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.assistant_save_automation(p_id uuid,p_name text,p_command text,p_scheduled_at timestamptz,p_recurrence text,p_enabled boolean,p_confirmed boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF p_confirmed IS DISTINCT FROM true OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Confirmation and administrator access required'; END IF;
 IF p_enabled IS DISTINCT FROM false THEN RAISE EXCEPTION 'Scheduler not connected. Activation refused.'; END IF;
 IF length(trim(p_name)) NOT BETWEEN 1 AND 120 OR length(trim(p_command)) NOT BETWEEN 1 AND 20000 OR p_scheduled_at IS NULL OR p_recurrence NOT IN ('once','daily','weekly') THEN RAISE EXCEPTION 'Invalid schedule'; END IF;
 INSERT INTO public.assistant_automations AS existing(id,user_id,name,command,scheduled_at,recurrence,enabled) VALUES(p_id,auth.uid(),trim(p_name),trim(p_command),p_scheduled_at,p_recurrence,false)
 ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,command=EXCLUDED.command,scheduled_at=EXCLUDED.scheduled_at,recurrence=EXCLUDED.recurrence,enabled=false,updated_at=now() WHERE existing.user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Forbidden'; END IF;
 INSERT INTO public.assistant_activity(user_id,action) VALUES(auth.uid(),'automation_draft_saved');
 RETURN p_id;
END $$;
