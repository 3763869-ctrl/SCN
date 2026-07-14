-- Correct the default client name from MS Support to RM Support.

update public.clients
set
  name = 'RM Support',
  notes = case
    when notes is null or notes = '' or notes = 'Initial client for partner production work.'
      then 'Initial client for partner production work.'
    else notes
  end
where name = 'MS Support';
