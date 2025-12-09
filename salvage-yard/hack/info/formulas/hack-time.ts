import { autoscan, getServer, shortTFormat } from 'libv2.ts';

const flags = [['hacking-skill', 0]] as [string, number][];

export function autocomplete(
  data: AutocompleteData,
  args: string[],
): string[] {
  data.flags(flags);
  return [];
}

export async function main(ns: NS) {
  const {'hacking-skill': hackingSkill} = ns.flags(flags);
  if(typeof hackingSkill !== 'number' || hackingSkill <= 0) {
    ns.tprintf(
      'Usage:\n%s --hacking-skill 100',
      ns.getScriptName(),
    );
    return;
  }
  const player = ns.formulas.mockPlayer();
  player.skills.hacking = hackingSkill;
  const sorted = autoscan(ns)
    .map(h => getServer(ns, h))
    .filter(
      ({moneyMax, requiredHackingSkill}) =>
        moneyMax > 0 && requiredHackingSkill <= hackingSkill
    )
    .sort((a, b) =>
      a.requiredHackingSkill - b.requiredHackingSkill
      || a.minDifficulty - b.minDifficulty
    );
  for(const s of sorted) {
    s.hackDifficulty = s.minDifficulty;
    const h = ns.formulas.hacking.hackTime(s, player);
    const w = ns.formulas.hacking.weakenTime(s, player);
    const g = ns.formulas.hacking.growTime(s, player);

    ns.tprintf(
      '%20s %-4d %-4d %-5s %-5s %-5s',
      s.hostname,
      s.requiredHackingSkill,
      s.minDifficulty,
      shortTFormat(ns, h),
      shortTFormat(ns, w),
      shortTFormat(ns, g),
    );
  }
  ns.tprintf(
    '%20s %-4s %-4s %-5s %-5s %-5s',
    '',
    'skll',
    'dif',
    'h',
    'w',
    'g',
  );
}