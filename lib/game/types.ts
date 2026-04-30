/** Row shape from `public.game_team_stats` (numeric fields nullable). */
export type GameTeamStatsRow = {
  game_id: string;
  team_id: string;
  points: number | null;
  fg_made: number | null;
  fg_attempted: number | null;
  three_made: number | null;
  three_attempted: number | null;
  ft_made: number | null;
  ft_attempted: number | null;
  offensive_rebounds: number | null;
  defensive_rebounds: number | null;
  total_rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fast_break_points: number | null;
  points_in_paint: number | null;
  second_chance_points: number | null;
  bench_points: number | null;
};

/** Row shape from `public.game_player_stats`. */
export type GamePlayerStatsRow = {
  game_id: string;
  player_id: string;
  team_id: string;
  minutes: string | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  plus_minus: number | null;
  fg_made: number | null;
  fg_attempted: number | null;
  three_made: number | null;
  three_attempted: number | null;
  ft_made: number | null;
  ft_attempted: number | null;
  starter: boolean;
};

export type TeamMini = {
  id: string;
  name: string;
  abbreviation: string;
  logo_url: string | null;
};

export type PlayerMini = {
  id: string;
  name: string;
  position: string | null;
  jersey_number: string | null;
  headshot_url: string | null;
};

export type TeamSideBundle = {
  side: "home" | "away";
  team: TeamMini;
  stats: GameTeamStatsRow | null;
};

export type PlayerStatLine = {
  player: PlayerMini;
  stats: GamePlayerStatsRow;
};

/** Serializable snapshot for the game page + polling. */
export type GameBoxscoreSnapshot = {
  game: {
    id: string;
    league: string;
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
    status: string;
    status_detail?: string | null;
    start_time: string;
    external_id: string;
    stats_synced: boolean | null;
  };
  home: TeamSideBundle | null;
  away: TeamSideBundle | null;
  homePlayers: PlayerStatLine[];
  awayPlayers: PlayerStatLine[];
};
