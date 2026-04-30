-- Machine-readable `games.status` for cron queries; ESPN clock/label preserved in `status_detail`.

alter table public.games add column if not exists status_detail text;

update public.games
set status_detail = coalesce(status_detail, status)
where status_detail is null;

-- Backfill canonical phase from legacy ESPN-style `status` text.
update public.games
set status = case
  when status in ('in_progress', 'final', 'scheduled') then status
  when upper(coalesce(status, '')) like '%FINAL%'
    or upper(coalesce(status, '')) like '%OFFICIAL%'
    or upper(coalesce(status, '')) ~ '(^|[^A-Z0-9])FT([^A-Z0-9]|$)' then 'final'
  when upper(coalesce(status, '')) like '%LIVE%'
    or upper(coalesce(status, '')) like '%HALF%'
    or upper(coalesce(status, '')) like '%QTR%'
    or upper(coalesce(status, '')) like '%END %'
    or upper(coalesce(status, '')) like '% OT%'
    or upper(coalesce(status, '')) like '%IN PROGRESS%'
    or upper(coalesce(status, '')) like '%HALFTIME%'
    or upper(coalesce(status, '')) like '%DELAY%' then 'in_progress'
  else 'scheduled'
end
where status is null or status not in ('in_progress', 'final', 'scheduled');
