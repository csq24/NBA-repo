export type MatchRow = {
  id: string;
  game_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number;
  away_score: number;
  match_date: string;
};

export type MatchPlayerStatRow = {
  player_id: string;
  player_name: string;
  team_id: string;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  minutes_played: number;
  position: string | null;
};

export type TeamAggregate = {
  team_id: string;
  team_name: string;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  clean_sheets: number;
  top_scorer_name: string | null;
  top_scorer_goals: number;
  top_assister_name: string | null;
  top_assister_assists: number;
};

export type MatchStatsBundle = {
  match: MatchRow | null;
  players: MatchPlayerStatRow[];
  homeAggregate: TeamAggregate | null;
  awayAggregate: TeamAggregate | null;
  /** From `games` when no `teams` row linked yet */
  homeLabel: string;
  awayLabel: string;
};
