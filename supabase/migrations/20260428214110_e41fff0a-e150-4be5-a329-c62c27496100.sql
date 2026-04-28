REVOKE EXECUTE ON FUNCTION public.delete_assignment_safely(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_assignment_safely(uuid) TO authenticated;