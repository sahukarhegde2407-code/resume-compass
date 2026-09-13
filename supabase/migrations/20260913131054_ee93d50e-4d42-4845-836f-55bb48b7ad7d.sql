CREATE POLICY "Server manages screening sessions" ON public.screening_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Server manages job descriptions" ON public.job_descriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Server manages candidates" ON public.candidates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Server manages match results" ON public.match_results FOR ALL TO service_role USING (true) WITH CHECK (true);