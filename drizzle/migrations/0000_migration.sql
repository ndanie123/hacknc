CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type text NOT NULL DEFAULT 'patient' CHECK (account_type IN ('patient','provider')),
  email text,
  full_name text,
  date_of_birth date,
  organization text,
  job_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, date_of_birth, organization, job_title, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  log_type text NOT NULL DEFAULT 'general',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_logs TO authenticated;
GRANT ALL ON public.health_logs TO service_role;
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.log_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.health_logs(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (log_id, provider_id)
);
GRANT SELECT, INSERT, DELETE ON public.log_shares TO authenticated;
GRANT ALL ON public.log_shares TO service_role;
ALTER TABLE public.log_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_log(_log_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.health_logs WHERE id = _log_id AND user_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.log_shared_with_me(_log_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.log_shares WHERE log_id = _log_id AND provider_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.patient_shared_with_me(_patient uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.log_shares s JOIN public.health_logs l ON l.id = s.log_id
    WHERE l.user_id = _patient AND s.provider_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.find_provider_by_email(_email text)
RETURNS TABLE (id uuid, full_name text, organization text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.organization FROM public.profiles p
  WHERE p.account_type = 'provider' AND lower(p.email) = lower(trim(_email)) AND auth.uid() IS NOT NULL
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.find_provider_by_email(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.find_provider_by_email(text) TO authenticated;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.patient_shared_with_me(id) OR account_type = 'provider');
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "logs read" ON public.health_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.log_shared_with_me(id));
CREATE POLICY "logs insert" ON public.health_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "logs update" ON public.health_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "logs delete" ON public.health_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "shares read" ON public.log_shares FOR SELECT TO authenticated
  USING (provider_id = auth.uid() OR public.owns_log(log_id));
CREATE POLICY "shares insert" ON public.log_shares FOR INSERT TO authenticated WITH CHECK (public.owns_log(log_id));
CREATE POLICY "shares delete" ON public.log_shares FOR DELETE TO authenticated USING (public.owns_log(log_id));

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, account_type, full_name, date_of_birth, organization, job_title)
  VALUES (
    NEW.id, NEW.email,
    CASE WHEN NEW.raw_user_meta_data->>'account_type' = 'provider' THEN 'provider' ELSE 'patient' END,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date,
    NEW.raw_user_meta_data->>'organization',
    NEW.raw_user_meta_data->>'job_title'
  );
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER logs_touch BEFORE UPDATE ON public.health_logs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();