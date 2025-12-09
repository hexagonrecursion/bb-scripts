import {
  autoKillAtExit,
  autonuke,
  autoscan,
  copyHelpers,
  getServer,
  isNeedWeaken,
  isNeedGrow,
  getBotnetRam,
} from 'libv2.ts';

// mango is a randomly chosen word to avoid collisions
const botWeaken = '/mango/weaken.js';
const botGrow = '/mango/grow.js';
const botHack = '/mango/hack.js';
const hackFrac = 0.5;
const slotMs = 200;
const maxPrepGrowMult = 100;
const manageSleepMs = 60 * 1000;
const miscSleepMs = 10 * 1000;
// const flags = [
//   ['wave-max-minutes', 0],
// ] as [string, number][];

// export function autocomplete(
//   data: AutocompleteData,
//   args: string[],
// ): string[] {
//   data.flags(flags);
//   return [];
// }

export async function main(ns: NS) {
  autoKillAtExit(ns);
  ns.disableLog('ALL');
  autonuke(ns);
  copyHelpers(ns, [botWeaken, botGrow, botHack]);
  const stats = new Stats(ns);
  const priorityManager = new PriorityManager(ns, stats);
  const weakenRunner = new Weaken(ns, priorityManager);
  await Promise.all([
    manage(ns, stats, weakenRunner),
    ...autoscan(ns).map(
      s => attack(ns, s, stats, priorityManager, weakenRunner)
    ),
  ]);
}

async function attack(
  ns: NS,
  victim: string,
  stats: Stats,
  priorityManager: PriorityManager,
  weakenRunner: Weaken,
) {
  if (getServer(ns, victim).moneyMax <= 0) {
    return;
  }
  while (
    getServer(ns, victim).requiredHackingSkill >
    ns.getHackingLevel()
  ) {
    await ns.asleep(miscSleepMs);
  }
  weakenRunner.exec(victim);
  while (!getServer(ns, victim).hasAdminRights) {
    await ns.asleep(miscSleepMs);
  }
  while (true) {
    if (isNeedWeaken(ns, victim)) {
      weakenRunner.exec(victim);
      await ns.asleep(miscSleepMs);
      continue;
    }
    // cleanup old child pid list
    priorityManager.stopSpecific(victim);
    let isDidGrow = false;
    const hMs = ns.getHackTime(victim);
    const wMs = ns.getWeakenTime(victim);
    const gMs = ns.getGrowTime(victim);
    const waveMs = Math.ceil(Math.max(
      hMs + 3 * slotMs,
      wMs + 2 * slotMs,
      gMs + 1 * slotMs,
      wMs + 0 * slotMs,
    ));
    let i = 0;
    for (let end = waveMs; end < 2 * waveMs; end += 4 * slotMs) {
      if ((++i) % 20 === 0) {
        await ns.asleep(0);
      }
      if (isNeedGrow(ns, victim) && !isDidGrow) {
        const { moneyAvailable, moneyMax } = getServer(ns, victim);
        const mult = Math.min(
          maxPrepGrowMult,
          moneyMax / moneyAvailable,
        );
        const threads = Math.ceil(
          ns.growthAnalyze(victim, mult)
        );
        const wThreads = Math.ceil(
          ns.growthAnalyzeSecurity(threads)
          / ns.weakenAnalyze(1)
        );
        if (threads <= 0 || wThreads <= 0) {
          throw ('threads <= 0 || wThreads <= 0'
            + ` ${victim} ${mult} ${threads} ${wThreads}`);
        }
        if (end - wMs < 0) {
          throw `end - wMs < 0 ${end} ${wMs}`;
        }
        const result = priorityManager.exec(
          victim,
          [
            {
              script: botGrow,
              threads,
              args: [end - slotMs - gMs, victim],
            },
            {
              script: botWeaken,
              threads: wThreads,
              args: [end - wMs, victim],
            },
          ],
        );
        if (result === 'ok') {
          isDidGrow = true;
          const { moneyAvailable, moneyMax } = getServer(ns, victim);
          stats.recordGrow(victim, moneyAvailable / moneyMax);
        }
        if (result === 'out of memory') {
          priorityManager.maybeStopOne(victim);
        }
      } else {
        const hThreads = Math.floor(
          hackFrac / ns.hackAnalyze(victim)
        );
        const gThreads = Math.ceil(
          ns.growthAnalyze(victim, 1 / (1 - hackFrac))
        );
        const w1Threads = Math.ceil(
          ns.hackAnalyzeSecurity(hThreads) / ns.weakenAnalyze(1)
        );
        const w2Threads = Math.ceil(
          ns.growthAnalyzeSecurity(gThreads) / ns.weakenAnalyze(1)
        );
        if (
          hThreads <= 0
          || gThreads <= 0
          || w1Threads <= 0
          || w2Threads <= 0
        ) {
          throw ('*Threads <= 0'
            + ` ${victim} ${hThreads} ${gThreads} ${w1Threads} ${w2Threads}`);
        }
        if (end - 2 * slotMs - wMs < 0) {
          throw `${end} - ${2 * slotMs} - ${wMs} < 0`;
        }
        const result = priorityManager.exec(
          victim,
          [
            {
              script: botHack,
              threads: hThreads,
              args: [end - 3 * slotMs - hMs, victim],
            },
            {
              script: botWeaken,
              threads: w1Threads,
              args: [end - 2 * slotMs - wMs, victim],
            },
            {
              script: botGrow,
              threads: gThreads,
              args: [end - 1 * slotMs - gMs, victim],
            },
            {
              script: botWeaken,
              threads: w2Threads,
              args: [end - 0 * slotMs - wMs, victim],
            }
          ]
        );
        if (result === 'out of memory') {
          priorityManager.maybeStopOne(victim);
        }
      }
    }
    await ns.asleep(2 * waveMs + slotMs);
  }
}

class PriorityManager {
  ns: NS;
  stats: Stats;
  managed: { [index: string]: number[] } = {};
  constructor(ns: NS, stats: Stats) {
    this.ns = ns;
    this.stats = stats;
  }
  exec(
    victim: string,
    tasks: {
      script: string;
      threads: number;
      args: ScriptArg[];
    }[],
  ): 'ok' | 'out of memory' {
    const ns = this.ns;
    const pid = tasks.map(t => botExec(ns, t));
    if (pid.every(p => p)) {
      this.managed[victim] ??= [];
      this.managed[victim].push(...pid);
      return 'ok';
    }
    pid.forEach(p => ns.kill(p));
    return 'out of memory';
  }
  stopSpecific(victim: string) {
    const ns = this.ns;
    this.managed[victim] ??= [];
    if (this.managed[victim].some(pid => ns.isRunning(pid))) {
      this.stats.recordStop(victim);
    }
    this.managed[victim].forEach(pid => ns.kill(pid));
    this.managed[victim] = [];
  }
  maybeStopOne(important: string) {
    const ns = this.ns;
    let lestImportant = undefined;
    for (const k in this.managed) {
      if (!this.managed[k].length) continue;
      if (lestImportant
        && getValue(ns, lestImportant) < getValue(ns, k)
      ) {
        continue;
      }
      if (getValue(ns, k) >= getValue(ns, important)) {
        continue;
      }
      lestImportant = k;
    }
    if (lestImportant) {
      this.stopSpecific(lestImportant);
    }
  }
  stopOne() {
    const ns = this.ns;
    let lestImportant = undefined;
    for (const k in this.managed) {
      if (!this.managed[k].length) continue;
      if (lestImportant
        && getValue(ns, lestImportant) < getValue(ns, k)
      ) {
        continue;
      }
      lestImportant = k;
    }
    if (lestImportant) {
      this.stopSpecific(lestImportant);
    }
  }
}

function getValue(ns: NS, victim: string): number {
  const { moneyMax } = getServer(ns, victim);
  const time = Math.max(
    ns.getHackTime(victim),
    ns.getWeakenTime(victim),
    ns.getGrowTime(victim),
  );
  const chance = ns.hackAnalyzeChance(victim);
  const threads =
    hackFrac / ns.hackAnalyze(victim)
    + ns.growthAnalyze(victim, 1 / (1 - hackFrac))
  return ((moneyMax * chance) / time) / threads;
}

class Stats {
  ns: NS;
  growVictims: { [index: string]: number } = {};
  stopVictims: { [index: string]: boolean } = {};
  numStop = 0;
  constructor(ns: NS) {
    this.ns = ns;
  }
  reset() {
    this.growVictims = {};
    this.stopVictims = {};
    this.numStop = 0;
  }
  getGrowVictims(): { [index: string]: string } {
    const ns = this.ns;
    const res: { [index: string]: string } = {};
    for (const k in this.growVictims) {
      res[k] = ns.formatPercent(this.growVictims[k]);
    }
    return res;
  }
  getStopVictims(): string[] {
    return Object.keys(this.stopVictims);
  }
  recordGrow(victim: string, fullFrac: number) {
    this.growVictims[victim] = Math.min(
      this.growVictims[victim] ?? 1,
      fullFrac,
    )
  }
  recordStop(victim: string) {
    this.stopVictims[victim] = true;
    ++this.numStop;
  }
}

async function manage(
  ns: NS,
  stats: Stats,
  weakenRunner: Weaken,
) {
  while (true) {
    const before = ns.self().onlineMoneyMade;
    await ns.asleep(manageSleepMs);
    const after = ns.self().onlineMoneyMade;
    ns.printf('$%s /sec', ns.formatNumber(
      (after - before) / (manageSleepMs / 1000)
    ));
    autonuke(ns);
    purchaseServers(ns);
    copyHelpers(ns, [botWeaken, botGrow, botHack]);
    const { ramUsed, maxRam } = getBotnetRam(ns);
    ns.print('weaken: ', weakenRunner.getVictims());
    ns.print('grow: ', stats.getGrowVictims());
    ns.print('num stop: ', stats.numStop);
    ns.print('stop: ', stats.getStopVictims());
    ns.printf(
      'mem: %s/%s (%s)',
      ns.formatRam(ramUsed),
      ns.formatRam(maxRam),
      ns.formatPercent(ramUsed / maxRam),
    );
    stats.reset();
  }
}

class Weaken {
  weakenPid = {} as { [index: string]: number };
  ns: NS;
  priorityManager: PriorityManager;
  constructor(ns: NS, priorityManager: PriorityManager) {
    this.ns = ns;
    this.priorityManager = priorityManager;
  }
  getVictims(): string[] {
    const ns = this.ns;
    return Object.keys(this.weakenPid)
      .filter(server =>
        ns.isRunning(this.weakenPid[server] ?? 0)
      );
  }
  exec(server: string) {
    const ns = this.ns;
    const {
      moneyMax,
      requiredHackingSkill,
      minDifficulty,
      hackDifficulty,
      hasAdminRights,
    } = getServer(ns, server);
    if (
      moneyMax === 0
      || !hasAdminRights
      || requiredHackingSkill > ns.getHackingLevel()
      || !isNeedWeaken(ns, server)
      || ns.isRunning(this.weakenPid[server] ?? 0)
    ) {
      return;
    }
    const threads = Math.ceil(
      (hackDifficulty - minDifficulty)
      / ns.weakenAnalyze(1)
    );
    let pid = botExec(ns, {
      script: botWeaken,
      threads,
      args: [0, server],
    });
    if (!pid) {
      this.priorityManager.stopOne();
      pid = botExec(ns, {
        script: botWeaken,
        threads,
        args: [0, server],
      });
    }
    this.weakenPid[server] = pid;
  }
}

function botExec(
  ns: NS,
  { script, threads, args }: {
    script: string,
    threads: number,
    args: ScriptArg[]
  }
): number {
  for (const server of autoscan(ns)) {
    const pid = ns.exec(
      script,
      server,
      { threads, temporary: true },
      ...args,
    );
    if (pid !== 0) {
      return pid;
    }
  }
  return 0;
}

function purchaseServers(ns: NS) {
  let maxRam = 0;
  for (let i = 0; i < ns.getPurchasedServerLimit(); ++i) {
    const name = 'purchassed-' + ('00' + i).slice(-2);
    if (!ns.serverExists(name)) {
      if (!ns.purchaseServer(name, 1)) {
        continue;
      }
    }
    for (let r = 1; r <= ns.getPurchasedServerMaxRam(); r *= 2) {
      ns.upgradePurchasedServer(name, r);
    }
    const s = ns.getServer(name);
    maxRam += s.maxRam;
  }
  const limit = ns.getPurchasedServerLimit() *
    ns.getPurchasedServerMaxRam();
  ns.printf(
    'purchassed %s/%s (%s)',
    ns.formatRam(maxRam),
    ns.formatRam(limit),
    ns.formatPercent(maxRam / limit),
  );
}
