update public.phone_system_settings
set
  working_hours_greeting = replace(working_hours_greeting, 'S C N', 'RM Support'),
  after_hours_greeting = replace(after_hours_greeting, 'S C N', 'RM Support'),
  voicemail_greeting = replace(voicemail_greeting, 'S C N', 'RM Support'),
  updated_at = now()
where
  working_hours_greeting ilike '%S C N%'
  or after_hours_greeting ilike '%S C N%'
  or voicemail_greeting ilike '%S C N%';
