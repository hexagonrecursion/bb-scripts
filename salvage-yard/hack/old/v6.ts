import lib from './lib.ts';

// mango is a randomly chosen word to avoid collisions
const botWeaken = '/mango/weaken.js';
const botGrow = '/mango/grow.js';
const botHack = '/mango/hack.js';
const configJson = 'v5.json';
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
  async function attack(victim: string) {
    while (!getServer(victim).hasAdminRights) {
      try { ns.brutessh(victim); } catch (e) { }
      try { ns.ftpcrack(victim); } catch (e) { }
      try { ns.relaysmtp(victim); } catch (e) { }
      try { ns.httpworm(victim); } catch (e) { }
      try { ns.sqlinject(victim); } catch (e) { }
      try { ns.nuke(victim); } catch (e) { }
      await ns.asleep(readConfig().sleepMs);
    }
    if (getServer(victim).moneyMax === 0) {
      return;
    }
    while (
      getServer(victim).requiredHackingSkill >
      ns.getHackingLevel()
    ) {
      await ns.asleep(readConfig().sleepMs);
    }
    while (true) {
      const nW = isNeedWeaken(victim);
      const nG = isNeedGrow(victim);
      const hasTasks = tasks.has(victim);
      if (manager.isEnabled(victim)) {
        //ns.tprint({ victim, nW, nG, hasTasks });
      }
      if (nW && !hasTasks) {
        tryExecWeaken(victim);
        await ns.asleep(readConfig().sleepMs);
        continue;
      }
      if (nG && !hasTasks) {
        tryExecGrow(victim);
        await ns.asleep(readConfig().sleepMs);
        continue;
      }
      if (nW || nG) {
        const port = ports.getPort(victim);
        await Promise.race([
          ns.nextPortWrite(port),
          ns.asleep(readConfig().sleepMs)
        ]);
        ns.clearPort(port);
        continue;
      }
      tryExecHWGW(victim);
      await ns.asleep(readConfig().sleepMs * 5);
    }
  }

  function tryExecWeaken(victim: string) {
    const { minDifficulty, hackDifficulty } = getServer(victim);
    const threads = Math.ceil(
      (hackDifficulty - minDifficulty)
      / ns.weakenAnalyze(1)
    );
    if (tasks.tryAdd(victim, [
      {
        script: botWeaken,
        threads,
        args: [0, victim],
      }
    ])) {
      ns.print('weaken ', victim);
    }
  }

  function tryExecGrow(victim: string) {
    const {
      moneyAvailable,
      moneyMax,
    } = getServer(victim);
    const threads = Math.ceil(
      ns.growthAnalyze(
        victim,
        Math.min(moneyMax / moneyAvailable, maxPrepGrowMult)
      )
    );
    if (tasks.tryAdd(victim, [
      {
        script: botGrow,
        threads,
        args: [0, victim],
      }
    ])) {
      ns.print('grow ', victim);
    }
  }

  function tryExecHWGW(victim: string) {
    manager.updateSleepTime(victim);
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
    const { sleepMs } = readConfig();
    const hEnd = Math.max(
      ns.getHackTime(victim),
      ns.getWeakenTime(victim) - sleepMs,
      ns.getGrowTime(victim) - 2 * sleepMs,
    );
    const hSleep = hEnd - ns.getHackTime(victim);
    const w1Sleep = hEnd + sleepMs - ns.getWeakenTime(victim);
    const gSleep = hEnd + 2 * sleepMs - ns.getGrowTime(victim);
    const w2Sleep = hEnd + 3 * sleepMs - ns.getWeakenTime(victim);
    tasks.tryAdd(victim, [
      {
        script: botHack,
        threads: hThreads,
        args: [
          hSleep,
          victim,
          ports.getPort(victim),
          'H',
        ],
      },
      {
        script: botWeaken,
        threads: w1Threads,
        args: [
          w1Sleep,
          victim,
          ports.getPort(victim),
          'W1',
        ],
      },
      {
        script: botGrow,
        threads: gThreads,
        args: [
          gSleep,
          victim,
          ports.getPort(victim),
          'G',
        ],
      },
      {
        script: botWeaken,
        threads: w2Threads,
        args: [
          w2Sleep,
          victim,
          ports.getPort(victim),
          'W2',
        ],
      },
    ]);
  }

  function readConfig(): {
    sleepMs: number;
  } {
    const s = ns.read(configJson);
    let conf: any = {};
    try {
      conf = JSON.parse(s);
    } catch (e) {
    }
    return {
      sleepMs: conf.sleepMs ?? 200,
    };
  }

  function* botnetTemplate(): Iterable<string> {
    for (let i = 0; i < ns.getPurchasedServerLimit(); ++i) {
      const name = 'purchassed-' + ('00' + i).slice(-2);
      yield name;
    }
    yield 'home';
  }
  function* botnet(): Iterable<string> {
    for (const server of botnetTemplate()) {
      if (ns.serverExists(server)) {
        yield server;
      }
    }
  }
  function botnetRam(): number {
    let res = 0;
    for (const server of botnet()) {
      res += getServer(server).maxRam;
    }
    return res;
  }
  const manager = {
    sleepTime: 10 * 60 * 1000,
    parallell: 1,
    conflict: false,
    maxUsedRam: 0,
    needFreeRam: 1,
    isEnabled: function (victim: string): boolean {
      function isEasy(h: string): boolean {
        return getServer(h).requiredHackingSkill <= ns.getHackingLevel() / 2;
      };
      const sorted = autoscan()
        .filter(h => {
          let s = getServer(h);
          return s.hasAdminRights
            && s.moneyMax > 0
            && s.requiredHackingSkill <= ns.getHackingLevel()
        })
        .sort((a, b) =>
          (Number(isEasy(b)) - Number(isEasy(a)))
          || getServer(b).moneyMax - getServer(a).moneyMax
        );
      const indexOf = sorted.indexOf(victim);
      return indexOf >= 0 && indexOf < this.parallell;
    },
    updateMaxUsedRam: function () {
      let ramUsed = 0;
      for (const server of botnet()) {
        ramUsed += getServer(server).ramUsed
      }
      this.maxUsedRam = Math.max(this.maxUsedRam, ramUsed);
    },
    setConflict: function () {
      this.conflict = true;
    },
    updateSleepTime: function (victim: string) {
      this.sleepTime = Math.max(
        this.sleepTime,
        ns.getHackTime(victim),
        ns.getWeakenTime(victim),
        ns.getGrowTime(victim),
      );
    },
    expandBotnet: function () {
      for (const server of botnetTemplate()) {
        if (!ns.serverExists(server)) {
          if (ns.purchaseServer(server, 1) === '') {
            continue;
          }
        }
        for (
          let r = getServer(server).maxRam * 2;
          r <= ns.getPurchasedServerMaxRam();
          r *= 2
        ) {
          if (2 * this.maxUsedRam <= botnetRam()) {
            return;
          }
          if (!ns.upgradePurchasedServer(server, r)) {
            break;
          }
        }
      }
    },
    manage: async function () {
      while (true) {
        this.conflict = false;
        await ns.asleep(this.sleepTime);
        if (this.conflict && this.parallell > 1) {
          --this.parallell;
          this.needFreeRam *= 2;
        }
        this.expandBotnet();
        const maxParallel = autoscan().filter(h =>
          getServer(h).moneyMax !== 0
        ).length;
        if (
          !this.conflict
          && this.parallell < maxParallel
          && this.maxUsedRam + this.needFreeRam <= botnetRam()
        ) {
          const multiplier = Math.min(2, botnetRam() / this.maxUsedRam);
          const parallel = Math.max(
            this.parallell + 1,
            Math.floor(this.parallell * multiplier),  
          );
          this.parallell = Math.min(parallel, maxParallel);
        }
        ns.printf(
          'sleep: %s parallell: %d/%d ram: %s+%s/%s',
          ns.tFormat(this.sleepTime),
          this.parallell,
          maxParallel,
          ns.formatRam(this.maxUsedRam),
          ns.formatRam(this.needFreeRam),
          ns.formatRam(botnetRam()),
        );
      }
    },
  };
  const tasks = {
    victims: {} as {
      [index: string]: {
        tasks: Task[],
      }
    },
    has: function (victim: string): boolean {
      const v = this.victims[victim];
      if (!v) return false;
      v.tasks = v.tasks.filter(t =>
        t.subtasks.some(({ pid }) => ns.isRunning(pid))
      );
      return v.tasks.length !== 0;
    },
    tryAdd: function (
      victim: string,
      subtasks: {
        script: string,
        threads: number,
        args: ScriptArg[],
      }[],
    ): boolean {
      if (!manager.isEnabled(victim)) {
        return false;
      }
      const task: Task = { subtasks: [] };
      for (const sub of subtasks) {
        const pid = this.execOne(sub);
        if (pid !== 0) {
          task.subtasks.push({ pid });
        } else {
          for (const { pid } of task.subtasks) {
            ns.kill(pid);
          }
          manager.setConflict();
          return false;
        }
      }
      this.victims[victim] ??= { tasks: [] };
      this.victims[victim].tasks.push(task);
      manager.updateMaxUsedRam();
      return true;
    },
    execOne: function (
      {
        script,
        threads,
        args,
      }: {
        script: string,
        threads: number,
        args: ScriptArg[],
      }
    ): number {
      for (const server of botnet()) {
        let pid = ns.exec(
          script,
          server,
          { threads, temporary: true },
          ...args
        );
        if (pid !== 0) {
          return pid;
        }
      }
      return 0;
    }
  };

  const ports = {
    nextPort: 1,
    ports: {} as { [index: string]: number },
    getPort: function (victim: string): number {
      if (this.ports[victim] === undefined) {
        ns.clearPort(this.nextPort);
        this.ports[victim] = this.nextPort++;
      }
      return this.ports[victim];
    },
  };
  interface Task {
    subtasks: { pid: number }[],
  }

  ns.disableLog('ALL');
  autoKillAtExit();
  await Promise.all(
    [manager.manage()].concat(autoscan().map(attack))
  );
}