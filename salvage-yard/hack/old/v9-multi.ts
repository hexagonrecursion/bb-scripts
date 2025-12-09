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
const flags = [
  ['iter-minutes', 0],
  ['iter-seconds', 0],
] as [string, number][];

export function autocomplete(
  data: AutocompleteData,
  args: string[],
): string[] {
  data.flags(flags);
  return [];
}

export async function main(ns: NS) {
  const arg = ns.flags(flags) as {
    'iter-minutes': number,
    'iter-seconds': number,
  };
  const end = 1000 * (60 * arg['iter-minutes'] + arg['iter-seconds']);
  if(end <= 0) {
    ns.tprintf(
      'Usage:\n%s --iter-minutes 10',
      ns.getScriptName(),
    );
    return;
  }
  autoKillAtExit(ns);
  ns.disableLog('ALL');
  const weakenRunner = new Weaken(ns);
  while (true) {
    autonuke(ns);
    purchaseServers(ns);
    copyHelpers(ns, [botWeaken, botGrow, botHack]);
    weakenRunner.exec();
    const gwhwgw = new GWHWGW(ns);
    await gwhwgw.exec(end);
    const sleep = end + slotMs;
    const { ramUsed, maxRam } = getBotnetRam(ns);
    ns.print('weaken: ', weakenRunner.getVictims());
    ns.printf(
      'GWHWGW num grow: %d; num hack: %d; used: %s/%s (%s)',
      gwhwgw.growCount,
      gwhwgw.getVictims().length,
      ns.formatRam(ramUsed),
      ns.formatRam(maxRam),
      ns.formatPercent(ramUsed / maxRam),
    );
    const before = ns.self().onlineMoneyMade;
    await ns.sleep(sleep);
    const after = ns.self().onlineMoneyMade;
    ns.printf('$%s /sec', ns.formatNumber(
      (after - before) / (sleep / 1000)
    ));
  }
}

class GWHWGW {
  ns: NS
  end = 0;
  growCount = 0;
  victims = {} as { [index: string]: boolean };
  constructor(ns: NS) {
    this.ns = ns;
  }
  getVictims(): string[] {
    return Object.keys(this.victims);
  }
  async exec(end: number) {
    const ns = this.ns;
    const victims = this.sortVictims();
    this.end = end;
    //ns.tprint(victims[0]);
    for (const server of victims) {
      await ns.sleep(0);
      this.attackOne(server);
    }
  }
  sortVictims(): string[] {
    const ns = this.ns;
    return autoscan(ns)
      .filter(h => {
        const {
          hasAdminRights,
          moneyMax,
          requiredHackingSkill,
        } = getServer(ns, h);
        return hasAdminRights
          && moneyMax > 0
          && requiredHackingSkill <= ns.getHackingLevel()
      })
      .sort((a, b) =>
        getServer(ns, b).moneyMax - getServer(ns, a).moneyMax
      );
  }
  attackOne(server: string) {
    const ns = this.ns;
    const {
      moneyMax,
      requiredHackingSkill,
      hasAdminRights,
    } = getServer(ns, server);
    if (
      moneyMax === 0
      || !hasAdminRights
      || requiredHackingSkill > ns.getHackingLevel()
      || isNeedWeaken(ns, server)
    ) {
      return;
    }
    let isDidGrow = false;
    for (let end = 0; end <= this.end; end += 5 * slotMs) {
      const hSleep = end - 3 * slotMs
        - ns.getHackTime(server);
      const w1Sleep = end - 2 * slotMs
        - ns.getWeakenTime(server);
      const gSleep = end - slotMs
        - ns.getGrowTime(server);
      const w2Sleep = end
        - ns.getWeakenTime(server);
      if (hSleep < 0 || w1Sleep < 0 || gSleep < 0 || w2Sleep < 0) {
        continue;
      }
      if (isNeedGrow(ns, server) && !isDidGrow) {
        isDidGrow = true;
        const result = this.execG(server, gSleep, w2Sleep);
        if (result === 'out of memory') {
          return;
        }
        ++this.growCount;
      } else {
        this.execH(server, hSleep, w1Sleep, gSleep, w2Sleep);
      }
    }
  }

  execG(victim: string, gSleep: number, w2Sleep: number):
    'out of memory' | 'ok' {
    const ns = this.ns;
    const { moneyAvailable, moneyMax } = getServer(ns, victim);
    const mult = Math.min(
      maxPrepGrowMult,
      moneyMax / moneyAvailable,
    );
    const gThreads = Math.ceil(
      ns.growthAnalyze(victim, mult)
    );
    const w2Threads = Math.ceil(
      ns.growthAnalyzeSecurity(gThreads) / ns.weakenAnalyze(1)
    );
    const g = botExec(ns, {
      script: botGrow,
      threads: gThreads,
      args: [gSleep, victim],
    });
    const w2 = botExec(ns, {
      script: botWeaken,
      threads: w2Threads,
      args: [w2Sleep, victim],
    });
    if (g && w2) return 'ok';
    ns.kill(g);
    ns.kill(w2);
    return 'out of memory';
  }
  execH(
    victim: string,
    hSleep: number,
    w1Sleep: number,
    gSleep: number,
    w2Sleep: number,
  ) {
    const ns = this.ns;
    const { moneyAvailable } = getServer(ns, victim);
    const hThreads = Math.floor(
      ns.hackAnalyzeThreads(victim, moneyAvailable * hackFrac)
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
    const h = botExec(ns, {
      script: botHack,
      threads: hThreads,
      args: [hSleep, victim],
    });
    const w1 = botExec(ns, {
      script: botWeaken,
      threads: w1Threads,
      args: [w1Sleep, victim],
    });
    const g = botExec(ns, {
      script: botGrow,
      threads: gThreads,
      args: [gSleep, victim],
    });
    const w2 = botExec(ns, {
      script: botWeaken,
      threads: w2Threads,
      args: [w2Sleep, victim],
    });
    if (h && w1 && g && w2) {
      this.victims[victim] = true;
      return;
    }
    ns.kill(h);
    ns.kill(w1);
    ns.kill(g);
    ns.kill(w2);
  }
}

class Weaken {
  weakenPid = {} as { [index: string]: number };
  ns: NS
  constructor(ns: NS) {
    this.ns = ns;
  }
  getVictims(): string[] {
    const ns = this.ns;
    return Object.keys(this.weakenPid)
      .filter(server =>
        ns.isRunning(this.weakenPid[server] ?? 0)
      );
  }
  exec() {
    const ns = this.ns;
    for (const server of autoscan(ns)) {
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
        continue;
      }
      const threads = Math.ceil(
        (hackDifficulty - minDifficulty)
        / ns.weakenAnalyze(1)
      );
      this.weakenPid[server] = botExec(ns, {
        script: botWeaken,
        threads,
        args: [0, server],
      });
    }
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