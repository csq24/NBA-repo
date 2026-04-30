-- Analytical views for player/team stats, leaderboards, and sparkline payloads.
-- Depends on 002_stats_tracking (and prior) migrations; runs after 003_games_anon_upsert.sql by filename order.

-- NBA-style season label from game date (UTC): Oct–Dec → Y-(Y+1)%100, else (Y-1)-Y%100.
create or replace function public.game_season_label(g_date timestamptz)
returns text
language sql
immutable
as $$
  select case
    when extract(month from g_date at time zone 'UTC') >= 10 then
      extract(year from g_date at time zone 'UTC')::int
      || '-'
      || lpad(((extract(year from g_date at time zone 'UTC')::int + 1) % 100)::text, 2, '0')
    else
      (extract(year from g_date at time zone 'UTC')::int - 1)
      || '-'
      || lpad((extract(year from g_date at time zone 'UTC')::int % 100)::text, 2, '0')
  end;
$$;

create or replace view public.player_stats_with_game_info as
select
  gps.*,
  p.name as player_name,
  case
    when lower(regexp_replace(g.home_team, '\s+', ' ', 'g'))
      = lower(regexp_replace(t.name, '\s+', ' ', 'g')) then g.away_team
    when lower(regexp_replace(g.away_team, '\s+', ' ', 'g'))
      = lower(regexp_replace(t.name, '\s+', ' ', 'g')) then g.home_team
    else null
  end as opponent_name,
  g.start_time as game_date,
  case
    when g.home_score is null or g.away_score is null then null
    when lower(regexp_replace(g.home_team, '\s+', ' ', 'g'))
      = lower(regexp_replace(t.name, '\s+', ' ', 'g')) then
      case
        when g.home_score > g.away_score then 'W'
        when g.home_score < g.away_score then 'L'
        else 'T'
      end
    else
      case
        when g.away_score > g.home_score then 'W'
        when g.away_score < g.home_score then 'L'
        else 'T'
      end
  end as result_wl,
  case
    when lower(regexp_replace(g.home_team, '\s+', ' ', 'g'))
      = lower(regexp_replace(t.name, '\s+', ' ', 'g')) then 'home'
    when lower(regexp_replace(g.away_team, '\s+', ' ', 'g'))
      = lower(regexp_replace(t.name, '\s+', ' ', 'g')) then 'away'
    else null
  end as home_or_away,
  g.external_id as game_external_id,
  g.league as game_league
from public.game_player_stats gps
join public.games g on g.id = gps.game_id
join public.players p on p.id = gps.player_id
join public.teams t on t.id = gps.team_id;

create or replace view public.team_stats_with_record as
select
  tss.*,
  coalesce(gr.wins_from_games, 0)::bigint as wins_from_games,
  coalesce(gr.losses_from_games, 0)::bigint as losses_from_games
from public.team_season_stats tss
left join (
  select
    gts.team_id,
    public.game_season_label(g.start_time) as season,
    count(*) filter (where gts.points > opp.points) as wins_from_games,
    count(*) filter (where gts.points < opp.points) as losses_from_games
  from public.game_team_stats gts
  join public.games g on g.id = gts.game_id
  join public.game_team_stats opp
    on opp.game_id = gts.game_id
    and opp.team_id <> gts.team_id
  where gts.points is not null
    and opp.points is not null
  group by gts.team_id, public.game_season_label(g.start_time)
) gr on gr.team_id = tss.team_id and gr.season = tss.season;

create or replace view public.top_scorers_by_league as
select
  league,
  season,
  player_id,
  player_name,
  games_played,
  ppg,
  rpg,
  apg,
  spg,
  bpg,
  topg,
  fg_pct,
  three_pct,
  ft_pct,
  minutes_pg,
  rank_in_league
from (
  select
    psa.league,
    psa.season,
    psa.player_id,
    p.name as player_name,
    psa.games_played,
    psa.ppg,
    psa.rpg,
    psa.apg,
    psa.spg,
    psa.bpg,
    psa.topg,
    psa.fg_pct,
    psa.three_pct,
    psa.ft_pct,
    psa.minutes_pg,
    row_number() over (
      partition by psa.league, psa.season
      order by psa.ppg desc nulls last, p.name asc
    ) as rank_in_league
  from public.player_season_averages psa
  join public.players p on p.id = psa.player_id
) ranked
where rank_in_league <= 25;

create or replace view public.player_last_10 as
select
  p.id as player_id,
  coalesce(x.last_10_games, '[]'::jsonb) as last_10_games
from public.players p
left join (
  select
    r.player_id,
    jsonb_agg(
      jsonb_build_object(
        'game_id', r.game_id,
        'game_external_id', r.game_external_id,
        'start_time', r.start_time,
        'points', r.points,
        'rebounds', r.rebounds,
        'assists', r.assists,
        'steals', r.steals,
        'blocks', r.blocks,
        'turnovers', r.turnovers,
        'fouls', r.fouls,
        'plus_minus', r.plus_minus,
        'fg_made', r.fg_made,
        'fg_attempted', r.fg_attempted,
        'three_made', r.three_made,
        'three_attempted', r.three_attempted,
        'ft_made', r.ft_made,
        'ft_attempted', r.ft_attempted,
        'minutes', r.minutes,
        'starter', r.starter
      )
      order by r.start_time desc
    ) as last_10_games
  from (
    select
      gps.player_id,
      gps.game_id,
      g.external_id as game_external_id,
      g.start_time,
      gps.points,
      gps.rebounds,
      gps.assists,
      gps.steals,
      gps.blocks,
      gps.turnovers,
      gps.fouls,
      gps.plus_minus,
      gps.fg_made,
      gps.fg_attempted,
      gps.three_made,
      gps.three_attempted,
      gps.ft_made,
      gps.ft_attempted,
      gps.minutes,
      gps.starter,
      row_number() over (
        partition by gps.player_id
        order by g.start_time desc nulls last
      ) as rn
    from public.game_player_stats gps
    join public.games g on g.id = gps.game_id
  ) r
  where r.rn <= 10
  group by r.player_id
) x on x.player_id = p.id;

grant select on public.player_stats_with_game_info to anon, authenticated;
grant select on public.team_stats_with_record to anon, authenticated;
grant select on public.top_scorers_by_league to anon, authenticated;
grant select on public.player_last_10 to anon, authenticated;

grant execute on function public.game_season_label(timestamptz) to anon, authenticated;
