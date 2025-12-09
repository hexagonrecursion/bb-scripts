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
    while(!getServer(victim).hasAdminRights) {
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
      const priorities = calcPriorities();
      if (nW && !hasTasks) {
        tryExecWeaken(victim, priorities);
        await ns.asleep(readConfig().sleepMs);
        continue;
      }
      if (nG && !hasTasks) {
        tryExecGrow(victim, priorities);
        await ns.asleep(readConfig().sleepMs);
        continue;
      }
      if (nW || nG) {
        const port = ports.getPort(victim);
        await ns.nextPortWrite(port);
        ns.clearPort(port);
        continue;
      }
      tryExecHWGW(victim, priorities);
      await ns.asleep(readConfig().sleepMs * 5);
    }
  }

  function calcPriorities(): Priorities {
    const res: Priorities = {};
    const sorted = autoscan().sort((a, b) =>
      getServer(b).moneyMax - getServer(a).moneyMax
    );
    for (let i = 0; i < sorted.length; ++i) {
      const {requiredHackingSkill} = getServer(sorted[i]);
      const isHard = requiredHackingSkill > ns.getHackingLevel() / 2;
      res[sorted[i]] = i + sorted.length * +isHard;
    }
    return res;
  }

  function tryExecWeaken(victim: string, priorities: Priorities) {
    const { minDifficulty, hackDifficulty } = getServer(victim);
    const threads = Math.ceil(
      (hackDifficulty - minDifficulty)
      / ns.weakenAnalyze(1)
    );
    tasks.tryAdd(victim, priorities, [
      {
        script: botWeaken,
        threads,
        args: [0, victim],
      }
    ]);
  }

  function tryExecGrow(victim: string, priorities: Priorities) {
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
    tasks.tryAdd(victim, priorities, [
      {
        script: botGrow,
        threads,
        args: [0, victim],
      }
    ]);
  }

  function tryExecHWGW(victim: string, priorities: Priorities) {
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
    tasks.tryAdd(victim, priorities, [
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

  interface Task {
    subtasks: { pid: number }[],
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
      priorities: Priorities,
      subtasks: {
        script: string,
        threads: number,
        args: ScriptArg[],
      }[],
    ) {
      const task: Task = { subtasks: [] };
      const grower = new Grower(victim, priorities);
      for (const sub of subtasks) {
        const pid = this.execOne(grower, sub);
        if (pid !== 0) {
          task.subtasks.push({ pid });
        } else {
          for (const { pid } of task.subtasks) {
            ns.kill(pid);
          }
          return;
        }
      }
      this.victims[victim] ??= {tasks: []};
      this.victims[victim].tasks.push(task);
    },
    execOne: function (
      grower: Grower,
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
      for (const server of grower.growSpace()) {
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
  class Grower {
    killList: {
      victim: string,
      tasks: Task[],
    }[];
    constructor(victim: string, priorities: Priorities) {
      this.killList = [];
      for (const key in tasks.victims) {
        if (priorities[key] <= priorities[victim]) {
          continue;
        }
        this.killList.push(
          {
            victim: key,
            tasks: tasks.victims[key].tasks,
          }
        );
      }
      this.killList.sort((a, b) =>
        priorities[b.victim] - priorities[a.victim]
      );
    }
    *growSpace(): Iterable<string> {
      yield* autoscan();
      for (let i = 0; i < ns.getPurchasedServerLimit(); ++i) {
        const name = 'purchassed-' + ('00' + i).slice(-2);
        if (!ns.serverExists(name)) {
          if (ns.purchaseServer(name, 1) === '') {
            break;
          }
          yield name;
        }
        for (
          let r = getServer(name).maxRam * 2;
          r <= ns.getPurchasedServerMaxRam();
          r *= 2
        ) {
          if (!ns.upgradePurchasedServer(name, r)) {
            break;
          }
          yield name;
        }
      }
      for (const taskGroup of this.killList) {
        for (const task of taskGroup.tasks.toReversed()) {
          const free = task.subtasks.map(({ pid }) =>
            ns.getRunningScript(pid)?.server
          );
          for (const { pid } of task.subtasks) {
            ns.kill(pid);
          }
          for (const h of free) {
            if (h) {
              yield h;
            }
          }
        }
      }
    }
  }
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
  interface Priorities {
    [index: string]: number
  }

  ns.disableLog('ALL');
  autoKillAtExit();
  await Promise.all(
    [Promise.resolve()].concat(autoscan().map(attack))
  );
}