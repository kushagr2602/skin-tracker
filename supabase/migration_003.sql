-- migration_003: add right-side photo column to daily_logs
alter table daily_logs add column if not exists photo_url_right text;
