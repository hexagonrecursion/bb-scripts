// mango is a randomly chosen word to avoid collisions
const botWeaken = '/mango/weaken.js';
const botGrow = '/mango/grow.js';
const botHack = '/mango/hack.js';
const extraSleepMs = 200;
const maxHackFrac = 0.5;

class Main {
  async main() {
    this.ns.disableLog('ALL');
    while (true) {
      let { reserveMoney } = this.readConfig();
      this.nukeAll();
      this.purchaseServers(reserveMoney);
      this.copyHelpers();
      let victim = this.findVictim();
      let victimServer = this.ns.getServer(victim);
      if (
        typeof victimServer.hackDifficulty === 'undefined'
        || typeof victimServer.minDifficulty === 'undefined'
        || typeof victimServer.moneyAvailable === 'undefined'
        || typeof victimServer.moneyMax === 'undefined'
      ) {
        throw victimServer;
      }
      this.ns.print(
        victim,
        ' diff: ',
        this.ns.formatPercent(
          victimServer.hackDifficulty / victimServer.minDifficulty
        ),
        ' $: ',
        this.ns.formatPercent(
          victimServer.moneyAvailable / victimServer.moneyMax
        ),
      );
      this.ns.print(
        'h: ',
        this.ns.tFormat(this.ns.getHackTime(victim)),
        ', w: ',
        this.ns.tFormat(this.ns.getWeakenTime(victim)),
        ', g: ',
        this.ns.tFormat(this.ns.getGrowTime(victim)),
      );
      if (this.needWeaken(victim)) {
        await this.prepare(victim, botWeaken);
        continue;
      }
      if (this.needGrow(victim)) {
        await this.prepare(victim, botGrow);
        continue;
      }
      let hackFrac = maxHackFrac;
      while (true) {
        let h = new Hacker(this.ns, { victim, hackFrac });
        if (await h.batchHack()) {
          break;
        }
        hackFrac /= 2;
      }
    }
  }

  readConfig(): { reserveMoney: number; } {
    let s = this.ns.read('v2.json');
    let conf: any = {};
    try {
      conf = JSON.parse(s);
    } catch(e) {
    }
    return {
      reserveMoney: conf.reserveMoney ?? 0,
    };
  }

  purchaseServers(reserveMoney: any) {
    for (let i = 0; i < this.ns.getPurchasedServerLimit(); ++i) {
      let name = 'purchassed-' + ('00'+i).slice(-2);
      if (!this.ns.serverExists(name)) {
        let money = this.ns.getPlayer().money - reserveMoney;
        if (this.ns.getPurchasedServerCost(1) <= money) {
          this.ns.purchaseServer(name, 1);
        }
      }
      if (!this.ns.serverExists(name)) {
        continue;
      }
      for (let r = 1; r <= this.ns.getPurchasedServerMaxRam(); r *= 2) {
        let money = this.ns.getPlayer().money - reserveMoney;
        if (this.ns.getPurchasedServerUpgradeCost(name, r) <= money) {
          this.ns.upgradePurchasedServer(name, r);
        }
      }
    }
  }

  async prepare(victim: string, bot: string) {
    let children = [];
    for (let h of autoscan(this.ns)) {
      let { ramUsed, maxRam } = this.ns.getServer(h);
      let perThread = this.ns.getScriptRam(bot);
      let threads = Math.floor((maxRam - ramUsed) / perThread);
      if (threads === 0) {
        continue;
      }
      children.push(this.ns.exec(
        bot, h, { threads, temporary: true }, 0, victim
      ));
    }
    for (let childPid of children) {
      while (this.ns.isRunning(childPid)) {
        await this.ns.sleep(1000);
      }
    }
  }

  needGrow(victim: string): boolean {
    let s = this.ns.getServer(victim);
    if (s.moneyAvailable === undefined || s.moneyMax === undefined) {
      return false;
    }
    return s.moneyAvailable < s.moneyMax;
  }

  needWeaken(victim: string): boolean {
    let s = this.ns.getServer(victim);
    if (s.hackDifficulty === undefined || s.minDifficulty === undefined) {
      return false;
    }
    return s.hackDifficulty > s.minDifficulty;
  }

  findVictim(): string {
    let skill = this.ns.getHackingLevel();
    let easy: any = {};
    let hard: any = {};
    for (let h of autoscan(this.ns)) {
      let s = this.ns.getServer(h);
      if (!s.hasAdminRights) continue;
      let requiredHackingSkill = s.requiredHackingSkill ?? Infinity;
      let moneyMax = s.moneyMax ?? 0;
      if (requiredHackingSkill > skill) continue;
      if (requiredHackingSkill < skill / 2) {
        if (moneyMax > (easy.moneyMax ?? 0)) {
          easy = s;
        }
      } else {
        if (moneyMax > (hard.moneyMax ?? 0)) {
          hard = s;
        }
      }
      s.hostname
    }
    return easy.hostname ?? hard.hostname;
  }

  copyHelpers() {
    for (let bot of autoscan(this.ns)) {
      this.ns.scp([
        botWeaken,
        botGrow,
        botHack,
      ],
        bot,
        'home'
      );
    }
  }

  nukeAll() {
    for (let h of autoscan(this.ns)) {
      let { hasAdminRights } = this.ns.getServer(h);
      if (hasAdminRights) {
        continue;
      }
      try { this.ns.brutessh(h); } catch (e) {/* this.ns.print(e); */ }
      try { this.ns.ftpcrack(h); } catch (e) {/* this.ns.print(e); */ }
      try { this.ns.relaysmtp(h); } catch (e) {/* this.ns.print(e); */ }
      try { this.ns.httpworm(h); } catch (e) {/* this.ns.print(e); */ }
      try { this.ns.sqlinject(h); } catch (e) {/* this.ns.print(e); */ }
      try { this.ns.nuke(h); } catch (e) {/* this.ns.print(e); */ }
    }
  }

  ns: NS
  constructor(ns: NS) {
    this.ns = ns;
  }
}

class Hacker {
  async batchHack(): Promise<boolean> {
    //this.ns.print('batchHack');
    let batches = 0;
    while (true) {
      await this.ns.sleep(0);
      let log = (p: string) => {
        let b = this.batch;
        let s = this.security;
        let e = this.end;
        this.ns.print(`${p} sec:${s} end:${e} ${b}`);
      };
      if (!this.H()) break;
      //log('H');
      if (!this.W()) break;
      //log('W1');
      if (!this.G()) break;
      //log('G');
      if (!this.W()) break;
      //log('W2');
      this.batch = [];
      ++batches;
    }
    //this.ns.print(this.batch);
    for (let c of this.batch) {
      this.ns.kill(c);
    }
    if (batches === 0) {
      return false;
    }
    this.ns.print(
      this.ns.formatPercent(this.hackFrac),
      ' x ',
      batches,
      ' ',
      this.ns.tFormat(this.end),
    );
    await this.ns.sleep(this.nextEnd());
    return true;
  }

  H(): boolean {
    let hackAnalyze = this.ns.hackAnalyze(this.victim);
    let sleepDuration = this.nextEnd() - this.ns.getHackTime(this.victim);
    let script = botHack;
    let fracRemain = 1;
    for (let bot of this.botnet()) {
      let maxT = this.getMaxThreads({ bot, script });
      let wantT = Math.max(0, Math.floor(
        (1 - (1 - this.hackFrac) / fracRemain) / hackAnalyze
      ));
      let threads = Math.min(maxT, wantT);
      this.exec({ script, bot, sleepDuration, threads });
      this.security += this.ns.hackAnalyzeSecurity(threads);
      fracRemain = fracRemain * (1 - hackAnalyze * threads);
      if (threads === wantT) return true;
    }
    return false;
  }

  W(): boolean {
    let script = botWeaken;
    let sleepDuration = this.nextEnd() - this.ns.getWeakenTime(this.victim);
    for (let bot of this.botnet()) {
      let maxT = this.getMaxThreads({ bot, script });
      let wantT = Math.ceil(
        this.security / this.ns.weakenAnalyze(1)
      );
      let threads = Math.min(maxT, wantT);
      this.exec({ script, bot, sleepDuration, threads });
      this.security = Math.max(0,
        this.security - this.ns.weakenAnalyze(threads)
      );
    }
    return this.security === 0;
  }

  G(): boolean {
    let script = botGrow;
    let sleepDuration = this.nextEnd() - this.ns.getGrowTime(this.victim);
    let wantT = Math.ceil(
      this.ns.growthAnalyze(this.victim, 1 / (1 - this.hackFrac))
    );
    for (let bot of this.botnet()) {
      let maxT = this.getMaxThreads({ bot, script });
      let threads = Math.min(maxT, wantT);
      wantT -= threads;
      this.exec({ script, bot, sleepDuration, threads });
      this.security += this.ns.growthAnalyzeSecurity(threads);
    }
    return wantT === 0;
  }

  botnet(): string[] {
    return autoscan(this.ns)
      .filter(h => this.ns.getServer(h).hasAdminRights);
  }

  exec({ script, bot, sleepDuration, threads }: {
    script: string; bot: string; sleepDuration: number; threads: number
  }) {
    if (threads <= 0) {
      return;
    }
    this.batch.push(
      this.ns.exec(
        script,
        bot,
        { temporary: true, threads },
        sleepDuration,
        this.victim,
      )
    );
  }

  getMaxThreads({ bot, script }: { bot: string, script: string }): number {
    let s = this.ns.getServer(bot);
    let perThread = this.ns.getScriptRam(script);
    return Math.floor(
      (s.maxRam - s.ramUsed) / perThread
    );
  }

  nextEnd(): number {
    this.end += extraSleepMs;
    return this.end - extraSleepMs
  }

  ns: NS
  batch: number[];
  victim: string;
  hackFrac: number;
  security: number = 0;
  end: number;
  constructor(
    ns: NS,
    { victim, hackFrac }: { victim: string, hackFrac: number }
  ) {
    this.ns = ns;
    this.batch = [];
    this.victim = victim;
    this.hackFrac = hackFrac;
    this.end = Math.max(
      this.ns.getHackTime(this.victim),
      this.ns.getWeakenTime(this.victim) - extraSleepMs,
      this.ns.getGrowTime(this.victim) - 2 * extraSleepMs,
    );
  }
}

function autoscan(ns: NS) {
  // https://www.reddit.com/r/Bitburner/comments/16u9akw/3_line_script_to_get_all_servers/
  let hosts = new Set(["home"]);
  hosts.forEach(h => { ns.scan(h).forEach(n => hosts.add(n)); });
  return Array.from(hosts);
}

export async function main(ns: NS) {
  await (new Main(ns)).main();
}