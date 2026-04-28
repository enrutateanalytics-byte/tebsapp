CREATE UNIQUE INDEX IF NOT EXISTS uniq_assignment_date_route_unit
  ON public.assignments (assignment_date, route_id, unit_id);