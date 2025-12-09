import { autoscan, getServer } from 'libv2.ts';

const flags = [
  ['hacking-skill', 0],
  ['slot-ms', 0],
  ['runtime-hours', 0],
] as [string, number][];
const botWeaken = '/mango/weaken.js';
const botGrow = '/mango/grow.js';
const botHack = '/mango/hack.js';

export function autocomplete(
  data: AutocompleteData,
  args: string[],
): string[] {
  data.flags(flags);
  return [];
}

export async function main(ns: NS) {
  const {
    'hacking-skill': hackingSkill,
    'slot-ms': slotMs,
    'runtime-hours': runtimeHours,
  } = ns.flags(flags);
  if(
    typeof hackingSkill !== 'number' || hackingSkill <= 0
    || typeof slotMs !== 'number' || slotMs <= 0
    || typeof runtimeHours !== 'number' || runtimeHours <= 0
  ) {
    ns.tprintf(
      'Usage:\n%s --hacking-skill 570 --slot-ms 200 --runtime-hours 1.1',
      ns.getScriptName(),
    );
    return;
  }
  const player = ns.formulas.mockPlayer();
  player.skills.hacking = hackingSkill;
  const runtimeMs = runtimeHours * 60 * 60 * 1000;
  ns.tprintf('v10 %s', ns.formatNumber(
    getMoney(
      ns,
      player,
      {
        slotMs,
        runtimeMs,
        activeMult: 0.5,
        parallelMult: 1,
      }
    )
  ));
  ns.tprintf('half-dense %s', ns.formatNumber(
    getMoney(
      ns,
      player,
      {
        slotMs,
        runtimeMs,
        activeMult: 1,
        parallelMult: 2,
      }
    )
  ));
  ns.tprintf('perfect %s', ns.formatNumber(
    getMoney(
      ns,
      player,
      {
        slotMs,
        runtimeMs,
        activeMult: 1,
        parallelMult: 1,
      }
    )
  ));
}

type RServer = Required<Server>;

function v10GetValue(
  ns: NS,
  server: RServer,
  player: Player,
  hackFrac: number
): number {
  const {
    maxTime,
    hackChance,
    hackThreads,
    growThreads,
  } = getStats(ns, server, player, hackFrac);
  return server.moneyMax * hackChance
    / maxTime
    / (hackThreads + growThreads);
}

interface Stats {
  hackChance: number,
  hackPercent: number,
  hackThreads: number,
  hackTime: number,
  growThreads: number,
  growTime: number,
  weakenTime: number,
  maxTime: number,
}

function getStats(
  ns: NS,
  server: RServer,
  player: Player,
  hackFrac: number,
): Stats {
  const hServer = {
    ...server,
    hackDifficulty: server.minDifficulty,
    moneyAvailable: server.moneyMax,
  };
  const gServer = {
    ...server,
    hackDifficulty: server.minDifficulty,
    moneyAvailable: server.moneyMax * (1 - hackFrac),
  };
  const timeServer: Server = {
    ...server,
    hackDifficulty: server.minDifficulty,
  };
  const hackPercent = ns.formulas.hacking.hackPercent(hServer, player);
  const growThreads = ns.formulas.hacking.growThreads(
    gServer,
    player,
    server.moneyMax,
  )
  const hackTime = ns.formulas.hacking.hackTime(timeServer, player);
  const growTime = ns.formulas.hacking.growTime(timeServer, player);
  const weakenTime = ns.formulas.hacking.weakenTime(timeServer, player);
  return {
    hackChance: ns.formulas.hacking.hackChance(hServer, player),
    hackPercent,
    hackThreads: hackFrac / hackPercent,
    hackTime,
    growThreads,
    growTime,
    weakenTime,
    maxTime: Math.max(hackTime, growTime, weakenTime),
  };
}

function getBotRam(ns: NS) {
  return {
    hGb: ns.getScriptRam(botHack),
    gGb: ns.getScriptRam(botGrow),
    wGb: ns.getScriptRam(botWeaken),
  };
}

function getMoney(
  ns: NS,
  player: Player,
  {
    slotMs,
    runtimeMs,
    activeMult,
    parallelMult,
  }: {
    slotMs: number;
    runtimeMs: number;
    activeMult: number;
    parallelMult: number;
  }
): number {
  const hackFrac = 0.5;
  const sorted = autoscan(ns)
    .sort((a, b) => 
      v10GetValue(ns, getServer(ns, b), player, hackFrac)
      - v10GetValue(ns, getServer(ns, a), player, hackFrac)
    );
  let res = 0;
  let haveRam = ns.getPurchasedServerLimit()
    * ns.getPurchasedServerMaxRam();
  for(const server of sorted) {
    const s = getServer(ns, server);
    const {requiredHackingSkill, moneyMax} = s;
    if(requiredHackingSkill > player.skills.hacking) {
      continue;
    }
    const {
      hackChance,
      growThreads,
      hackThreads,
      maxTime,
    } = getStats(ns, s, player, hackFrac);
    const {hGb, wGb} = getBotRam(ns);
    const ramPerBatch = hGb * hackThreads + wGb * growThreads;
    const numParallel = parallelMult * maxTime / (4 * slotMs);
    const needRam = ramPerBatch * numParallel;
    const batchMs = 4 * slotMs;
    const moneyPerBatch = hackFrac * moneyMax;
    const ramFrac = Math.min(1, haveRam / needRam);
    res += moneyPerBatch * hackChance * ramFrac / batchMs;
    if(haveRam - needRam < 0) {
      break;
    }
    haveRam -= needRam;
  }
  return res * activeMult * runtimeMs;
}
