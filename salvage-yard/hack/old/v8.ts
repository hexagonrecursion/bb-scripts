import lib from './lib.ts';

// mango is a randomly chosen word to avoid collisions
const botWeaken = '/mango/weaken.js';
const botGrow = '/mango/grow.js';
const botHack = '/mango/hack.js';
const configJson = 'v8.json';
const hackFrac = 0.5;
const maxPrepGrowMult = 100;

export async function main(ns: NS) {
  const {
    getServer,
    isNeedWeaken,
    isNeedGrow,
    autoscan,
    autoKillAtExit,
  } = lib(ns);

  async function mainLoop() {
    autoKillAtExit();
    ns.disableLog('ALL');
    //ns.enableLog('sleep');
    while (true) {
      autonuke();
      purchaseServers();
      copyHelpers();
      execWeaken();
      const gwhwgw = new GWHWGW();
      const end = await gwhwgw.start();
      //ns.tprint(end);
      if (end) {
        const sleep = end + readConfig().slotMs;
        ns.print(ns.tFormat(sleep));
        ns.print(gwhwgw.getVictims());
        const before = ns.self().onlineMoneyMade;
        await ns.sleep(sleep);
        const after = ns.self().onlineMoneyMade;
        ns.printf('$%s /sec', ns.formatNumber(
          (after - before) / (sleep / 1000)
        ));
      } else {
        ns.print('bootstrap');
        await bootstrap();
      }
    }
  }

  async function bootstrap() {
    const victim = 'n00dles';
    while (true) {
      if (isNeedWeaken(victim)) {
        await execMax(victim, botWeaken);
        continue;
      }
      if (isNeedGrow(victim)) {
        await execMax(victim, botGrow);
        continue;
      }
      break;
    }
    await execMax(victim, botHack);
  }

  async function execMax(victim: string, script: string) {
    const perThread = ns.getScriptRam(script);
    const children = [];
    for (const h of autoscan()) {
      const { ramUsed, maxRam, hasAdminRights } = ns.getServer(h);
      const threads = Math.floor((maxRam - ramUsed) / perThread);
      if (threads === 0 || !hasAdminRights) {
        continue;
      }
      children.push(ns.exec(
        script, h, { threads, temporary: true }, 0, victim
      ));
    }
    for (const childPid of children) {
      while (ns.isRunning(childPid)) {
        await ns.sleep(1000);
      }
    }
  }

  class GWHWGW {
    slotMs: number;
    maxEnd: number;
    waveEnd = 0;
    execEnd = 0;
    execFail = false;
    isNeedGrow: { [index: string]: boolean };
    victims = {} as { [index: string]: boolean };
    constructor() {
      this.slotMs = readConfig().slotMs;
      this.isNeedGrow = {};
      for (const server of autoscan()) {
        this.isNeedGrow[server] = isNeedGrow(server);
      }
      const durations = autoscan()
        .filter(h => {
          const {
            moneyMax,
            hasAdminRights,
            requiredHackingSkill,
          } = getServer(h);
          return moneyMax > 0
            && hasAdminRights
            && requiredHackingSkill <= ns.getHackingLevel()
            && !isNeedWeaken(h);
        })
        .map(h => Math.max(
          ns.getGrowTime(h),
          ns.getHackTime(h),
          ns.getWeakenTime(h),
        ));
      this.maxEnd = 2 * Math.max(0, ...durations);
    }
    getVictims(): string[] {
      return Object.keys(this.victims);
    }
    async start(): Promise<number> {
      this.execFail = false;
      while (true) {
        for (let i = 0; i < 10; ++i) {
          //ns.tprint(this.waveEnd);
          this.execWave()
          if (this.execFail) {
            //ns.tprint('execFail');
            return this.execEnd;
          }
          this.waveEnd += 5 * this.slotMs;
          if (this.waveEnd > this.maxEnd) {
            //ns.tprint('maxEnd');
            return this.execEnd;
          }
        }
        await ns.sleep(0);
      }
    }
    execWave() {
      for (const server of autoscan()) {
        const {
          moneyMax,
          requiredHackingSkill,
          hasAdminRights,
        } = getServer(server);
        const hSleep = this.waveEnd
          - 3 * this.slotMs
          - ns.getHackTime(server);
        const w1Sleep = this.waveEnd
          - 2 * this.slotMs
          - ns.getWeakenTime(server);
        const gSleep = this.waveEnd
          - this.slotMs
          - ns.getGrowTime(server);
        const w2Sleep = this.waveEnd
          - ns.getWeakenTime(server);
        if (
          moneyMax === 0
          || !hasAdminRights
          || requiredHackingSkill > ns.getHackingLevel()
          || isNeedWeaken(server)
          || Math.min(hSleep, w1Sleep, gSleep, w2Sleep) < 0
        ) {
          continue;
        }
        if (this.isNeedGrow[server]) {
          this.G(server, gSleep, w2Sleep);
          this.isNeedGrow[server] = false;
        } else {
          this.H(server, hSleep, w1Sleep, gSleep, w2Sleep);
        }
      }
    }
    G(victim: string, gSleep: number, w2Sleep: number) {
      const { moneyAvailable, moneyMax } = getServer(victim);
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
      const g = botExec({
        script: botGrow,
        threads: gThreads,
        args: [gSleep, victim],
      });
      const w2 = botExec({
        script: botWeaken,
        threads: w2Threads,
        args: [w2Sleep, victim],
      });
      if (g && w2) {
        this.execEnd = this.waveEnd;
        return;
      }
      ns.kill(g);
      ns.kill(w2);
      this.execFail = true;
    }
    H(
      victim: string,
      hSleep: number,
      w1Sleep: number,
      gSleep: number,
      w2Sleep: number,
    ) {
      const { moneyAvailable } = getServer(victim);
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
      const h = botExec({
        script: botHack,
        threads: hThreads,
        args: [hSleep, victim],
      });
      const w1 = botExec({
        script: botWeaken,
        threads: w1Threads,
        args: [w1Sleep, victim],
      });
      const g = botExec({
        script: botGrow,
        threads: gThreads,
        args: [gSleep, victim],
      });
      const w2 = botExec({
        script: botWeaken,
        threads: w2Threads,
        args: [w2Sleep, victim],
      });
      if (h && w1 && g && w2) {
        this.victims[victim] = true;
        this.execEnd = this.waveEnd;
        return;
      }
      ns.kill(h);
      ns.kill(w1);
      ns.kill(g);
      ns.kill(w2);
      this.execFail = true;
    }
  }

  const weakenPid = {} as { [index: string]: number };
  function execWeaken() {
    for (const server of autoscan()) {
      const {
        moneyMax,
        requiredHackingSkill,
        minDifficulty,
        hackDifficulty,
      } = getServer(server);
      if (
        moneyMax === 0
        || requiredHackingSkill > ns.getHackingLevel() + 1
        || !isNeedWeaken(server)
        || ns.isRunning(weakenPid[server] ?? 0)
      ) {
        continue;
      }
      const threads = Math.ceil(
        (hackDifficulty - minDifficulty)
        / ns.weakenAnalyze(1)
      );
      weakenPid[server] = botExec({
        script: botWeaken,
        threads,
        args: [0, server],
      });
    }
  }

  function botExec(
    { script, threads, args }: {
      script: string,
      threads: number,
      args: ScriptArg[]
    }
  ): number {
    for (const server of autoscan()) {
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

  function purchaseServers() {
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
    }
  }

  function copyHelpers() {
    for (const server of autoscan()) {
      ns.scp([
        botWeaken,
        botGrow,
        botHack,
      ],
        server,
        'home'
      );
    }
  }

  function autonuke() {
    for (const h of autoscan()) {
      if (getServer(h).hasAdminRights) {
        continue;
      }
      try { ns.brutessh(h); } catch (e) { }
      try { ns.ftpcrack(h); } catch (e) { }
      try { ns.relaysmtp(h); } catch (e) { }
      try { ns.httpworm(h); } catch (e) { }
      try { ns.sqlinject(h); } catch (e) { }
      try { ns.nuke(h); } catch (e) { }
    }
  }

  function readConfig(): {
    slotMs: number;
  } {
    const s = ns.read(configJson);
    let conf: any = {};
    try {
      conf = JSON.parse(s);
    } catch (e) {
    }
    return {
      slotMs: conf.slotMs ?? 200,
    };
  }

  await mainLoop();
}