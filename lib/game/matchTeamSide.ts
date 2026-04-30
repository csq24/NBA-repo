/**
 * Map a `teams` row to home/away using `games.home_team` / `games.away_team` labels
 * (ESPN display strings — not always identical to `teams.name`).
 */
export function scoreTeamAgainstLabel(
  label: string,
  teamName: string,
  abbreviation: string,
): number {
  const L = label.trim().toLowerCase();
  const n = teamName.trim().toLowerCase();
  const a = abbreviation.trim().toLowerCase();
  if (!L) return 0;
  if (L === n) return 100;
  if (L.includes(n) || n.includes(L)) return 85;
  if (a && (L.includes(a) || L.endsWith(a))) return 70;
  const tail = n.split(/\s+/).pop();
  if (tail && tail.length > 2 && (L.includes(tail) || L.endsWith(tail))) return 55;
  return 0;
}

export function sideForTeam(
  homeLabel: string,
  awayLabel: string,
  teamName: string,
  abbreviation: string,
): "home" | "away" | null {
  const h = scoreTeamAgainstLabel(homeLabel, teamName, abbreviation);
  const aw = scoreTeamAgainstLabel(awayLabel, teamName, abbreviation);
  if (h > aw && h > 0) return "home";
  if (aw > h && aw > 0) return "away";
  if (h > 0) return "home";
  if (aw > 0) return "away";
  return null;
}
