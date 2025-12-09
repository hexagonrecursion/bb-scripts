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
          ns.asleep(10 * 1000),
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
      stats.record(victim, 'W');
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
      stats.record(victim, 'G');
    }
  }

  function tryExecHWGW(victim: string) {
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
    const success = tasks.tryAdd(victim, [
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
    if(success) {
      stats.record(victim, 'H');
    }
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

  function* purchassedNames(): Iterable<string> {
    for (let i = 0; i < ns.getPurchasedServerLimit(); ++i) {
      const name = 'purchassed-' + ('00' + i).slice(-2);
      yield name;
    }
  }
  function* botnet():  Iterable<string> {
    for(const server of purchassedNames()) {
      if(ns.serverExists(server)) {
        yield server;
      }
    }
    yield 'home';
  }
  function* growingBotnet(): Iterable<string> {
    for(const server of purchassedNames()) {
      if(ns.serverExists(server)) {
        yield server;
      }
    }
    for(const server of purchassedNames()) {
      if(!ns.serverExists(server)) {
        if(ns.purchaseServer(server, 1) === '') {
          break;
        }
        yield server;
      }
      for(
        let ram = 2 * getServer(server).maxRam;
        ram <= ns.getPurchasedServerMaxRam();
        ram *= 2
      ) {
        if(!ns.upgradePurchasedServer(server, ram)) {
          break;
        }
        yield server;
      }
    }
    yield 'home';
  }
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
      stats.recordTryExec();
      const task: Task = { subtasks: [] };
      for (const sub of subtasks) {
        const pid = this.execOne(sub);
        if (pid !== 0) {
          task.subtasks.push({ pid });
        } else {
          for (const { pid } of task.subtasks) {
            ns.kill(pid);
          }
          stats.recordExecFail();
          return false;
        }
      }
      this.victims[victim] ??= { tasks: [] };
      this.victims[victim].tasks.push(task);
      stats.updateRamUsed();
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
      for (const server of growingBotnet()) {
        ns.scp(script, server, 'home');
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

  const stats = {
    ramUsed: 0,
    execFail: 0,
    tryExec: 0,
    hwgw: {} as {[index: string]: boolean},
    victimState: {} as {[index: string]: 'W' | 'G' | 'H'},
    record: function(victim: string, state: 'W' | 'G' | 'H') {
      if(this.victimState[victim] === 'H' &&  state !== 'H') {
        ns.printf('%s => %s %s', this.victimState[victim], state, victim);
      }
      this.victimState[victim] = state;
      if(state === 'H') {
        this.hwgw[victim] = true;
      }
    },
    recordTryExec: function() {
      ++this.tryExec;
    },
    recordExecFail: function() {
      ++this.execFail;
    },
    updateRamUsed: function() {
      let ramUsed = 0;
      for (const server of botnet()) {
        ramUsed += getServer(server).ramUsed;
      }
      this.ramUsed = Math.max(ramUsed, this.ramUsed);
    },
    print: async function() {
      while (true) {
        this.ramUsed = 0;
        this.execFail = 0;
        this.tryExec = 0;
        this.hwgw = {};
        await ns.asleep(60 * 1000);
        let maxRam = 0;
        for(const server of botnet()) {
          maxRam += getServer(server).maxRam;
        }
        const victims = autoscan().filter(server =>
          getServer(server).moneyMax > 0
        );
        const haveSkill = victims.filter(server =>
          getServer(server).requiredHackingSkill <=
          ns.getHackingLevel()
        );
        ns.printf(
          'mem: %s fail: %s HWGW:%d/%d/%d',
          ns.formatPercent((this.ramUsed / maxRam) || 0),
          ns.formatPercent((this.execFail / this.tryExec) || 0),
          Object.keys(this.hwgw).length,
          haveSkill.length,
          victims.length,
        );
        const w = Object.keys(this.victimState).filter(k =>
           this.victimState[k] === 'W'
        );
        const g = Object.keys(this.victimState).filter(k =>
           this.victimState[k] === 'G'
        );
        const idle = Object.keys(this.victimState).filter(k =>
           this.victimState[k] === 'H' && !this.hwgw[k]
        );
        ns.print('W ', w);
        ns.print('G ', g);
        ns.print('I ', idle);
      }
    }
  };

  interface Task {
    subtasks: { pid: number }[],
  }

  ns.disableLog('ALL');
  //ns.enableLog('exec');
  autoKillAtExit();
  await Promise.all(
    [stats.print()].concat(autoscan().map(attack))
  );
}