import { autoscan, getServer, shortTFormat } from 'libv2.ts';

const flags = [['hacking-skill', 0]] as [string, number][];
const botWeaken = '/mango/weaken.js';

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
    .filter(({moneyMax}) => moneyMax > 0)
    .sort((a, b) =>
      a.requiredHackingSkill - b.requiredHackingSkill
      || a.minDifficulty - b.minDifficulty
    );
  const weakenSec = 0.05;
  for(const s of sorted) {
    s.hackDifficulty = s.baseDifficulty;
    const w = ns.formulas.hacking.weakenTime(s, player);
    const threads = Math.ceil(
      (s.baseDifficulty - s.minDifficulty) / weakenSec
    );
    const ram = threads * ns.getScriptRam(botWeaken);
    ns.tprintf(
      '%20s %4d %4d %4d %5s %8s',
      s.hostname,
      s.requiredHackingSkill,
      s.baseDifficulty,
      s.minDifficulty,
      shortTFormat(ns, w),
      ns.formatRam(ram),
    );
  }
  ns.tprintf(
    '%20s %4s %4s %4s %5s %8s',
    '',
    'skll',
    'base',
    'min',
    '',
    '',
  );
  if(
    Math.abs(weakenSec - ns.weakenAnalyze(1)) / weakenSec > 0.01
  ) {
    ns.tprintf('Warning: unexpected result from weakenAnalyze');
  }
}