// mango is a randomly chosen word to avoid collisions
const botWeaken = '/mango/weaken.js';
const botGrow = '/mango/grow.js';
const botHack = '/mango/hack.js';
const configJson = 'v2.json';
const timeSlotMs = 200;
const iterationMs = 5 * timeSlotMs;
const maxPrepGrowMult = 100;
const hackFrac = 0.5;

export async function main(ns: NS) {
  async function mainLoop() {
    ns.disableLog('ALL');
    while (true) {
      let sleep = ns.asleep(iterationMs);
      nukeAll();
      purchaseServers();
      copyHelpers();
      let printed: { [index: string]: boolean } = {};
      for (let t of tasks) {
        let category: taskCategory = isReady(t.victim) ? 'HWGW' : 'Prep';
        if (t.category !== category) {
          t.stop();
          ++stats[t.category].stoppedCategory;
          if (t.category === 'HWGW' && !printed[t.victim]) {
            printed[t.victim] = true;
            let {
              moneyAvailable,
              moneyMax,
              minDifficulty,
              hackDifficulty,
            } = myGetServer(t.victim);
            if (!serverStats[t.victim]) {
              serverStats[t.victim] = { ff: 0, tf: 0, ft: 0 };
            }
            let d = hackDifficulty === minDifficulty;
            let m = moneyAvailable === moneyMax;
            serverStats[t.victim].ff += Number(!d && !m);
            serverStats[t.victim].tf += Number(d && !m);
            serverStats[t.victim].ft += Number(!d && m);
            ns.printf(
              '%20s S:%7s $:%7s {%7s %7s %7s}',
              t.victim,
              ns.formatPercent(hackDifficulty / minDifficulty),
              ns.formatPercent(moneyAvailable / moneyMax),
              serverStats[t.victim].ff,
              serverStats[t.victim].tf,
              serverStats[t.victim].ft,
            );
            let events = '';
            for(
              let data = ns.readPort(getPort(t.victim));
              data !== 'NULL PORT DATA';
              data = ns.readPort(getPort(t.victim))
            ){
              events += data;
            }
            ns.print(events);
          }
        }
      }
      tasks = tasks.filter(t => !t.isDone());
      let victims = sortVictims();
      for (let t of tasks) {
        let p = victims.indexOf(t.victim);
        t.priority = p >= 0 ? p : victims.length;
      }
      tasks.sort((a, b) => a.priority - b.priority);
      let havePrep = tasks
        .filter(t => t.category === 'Prep')
        .map(t => t.victim);
      for(let host of autoscan()) {
        ns.writePort(getPort(host), '.');
      }
      for (let priority = 0; priority < victims.length; ++priority) {
        let v = victims[priority];
        if (isReady(v)) {
          execHWGW(v, priority);
        } else if (!havePrep.includes(v)) {
          execPrep(v, priority);
        }
      }
      if (tasks.length) {
        printStats();
        await sleep;
      } else {
        await bootstrap();
      }
    }
  }

  function myGetServer(host: string): {
    hasAdminRights: boolean;
    ramUsed: number;
    maxRam: number;
    minDifficulty: number;
    hackDifficulty: number;
    moneyAvailable: number;
    moneyMax: number;
  } {
    let {
      hasAdminRights,
      ramUsed,
      maxRam,
      minDifficulty,
      hackDifficulty,
      moneyAvailable,
      moneyMax,
    } = ns.getServer(host);
    if (
      minDifficulty === undefined
      || hackDifficulty === undefined
      || moneyAvailable === undefined
      || moneyMax === undefined
    ) {
      throw host;
    }
    return {
      hasAdminRights,
      ramUsed,
      maxRam,
      minDifficulty,
      hackDifficulty,
      moneyAvailable,
      moneyMax,
    };
  }

  function printStats() {
    let { statSkip } = readConfig();
    if (stats.skipped < statSkip) {
      ++stats.skipped;
      return;
    }
    ns.printf(
      'P{%-4d +%-4d -S%-4d -C%-4d} H{%-4d +%-4d -S%-4d -C%-4d}',
      tasks.filter(t => t.category == 'Prep').length,
      stats.Prep.started,
      stats.Prep.stoppedSpace,
      stats.Prep.stoppedCategory,
      tasks.filter(t => t.category == 'HWGW').length,
      stats.HWGW.started,
      stats.HWGW.stoppedSpace,
      stats.HWGW.stoppedCategory,
    );
    stats = {
      HWGW: { started: 0, stoppedSpace: 0, stoppedCategory: 0 },
      Prep: { started: 0, stoppedSpace: 0, stoppedCategory: 0 },
      skipped: 0,
    };
  }

  async function bootstrap() {
    let victim = sortVictims()[0];
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
    let perThread = ns.getScriptRam(script);
    let children = [];
    for (let h of autoscan()) {
      let { ramUsed, maxRam, hasAdminRights } = ns.getServer(h);
      let threads = Math.floor((maxRam - ramUsed) / perThread);
      if (threads === 0 || !hasAdminRights) {
        continue;
      }
      children.push(ns.exec(
        script, h, { threads, temporary: true }, 0, victim
      ));
    }
    for (let childPid of children) {
      while (ns.isRunning(childPid)) {
        await ns.sleep(1000);
      }
    }
  }

  function isNeedWeaken(target: string): boolean {
    let s = myGetServer(target);
    return s.hackDifficulty > s.minDifficulty;
  }

  function isNeedGrow(target: string): boolean {
    let s = myGetServer(target);
    return s.moneyAvailable < s.moneyMax;
  }

  function isReady(target: string): boolean {
    return !isNeedGrow(target) && !isNeedWeaken(target);
  }

  function purchaseServers() {
    let { reserveMoney } = readConfig();
    for (let i = 0; i < ns.getPurchasedServerLimit(); ++i) {
      let name = 'purchassed-' + ('00' + i).slice(-2);
      if (!ns.serverExists(name)) {
        let cost = ns.getPurchasedServerCost(1);
        if (cost + reserveMoney <= ns.getPlayer().money) {
          ns.purchaseServer(name, 1);
        }
      }
      if (!ns.serverExists(name)) {
        continue;
      }
      for (let r = 1; r <= ns.getPurchasedServerMaxRam(); r *= 2) {
        let cost = ns.getPurchasedServerUpgradeCost(name, r);
        if (cost + reserveMoney <= ns.getPlayer().money) {
          ns.upgradePurchasedServer(name, r);
        }
      }
    }
  }

  function readConfig(): {
    reserveMoney: number;
    statSkip: number;
  } {
    let s = ns.read(configJson);
    let conf: any = {};
    try {
      conf = JSON.parse(s);
    } catch (e) {
    }
    return {
      reserveMoney: conf.reserveMoney ?? 0,
      statSkip: conf.statSkip ?? 0,
    };
  }

  function execHWGW(victim: string, priority: number) {
    let { moneyAvailable } = myGetServer(victim);
    let hThreads = Math.floor(
      ns.hackAnalyzeThreads(victim, moneyAvailable * hackFrac)
    );
    /*ns.tprint({
      hThreads,
      hackAnalyzeThreads: ns.hackAnalyzeThreads(victim, hackFrac),
      victim,
      hackFrac,
    });*/
    let gThreads = Math.ceil(
      ns.growthAnalyze(victim, 1 / (1 - hackFrac))
    );
    let w1Threads = Math.ceil(
      ns.hackAnalyzeSecurity(hThreads) / ns.weakenAnalyze(1)
    );
    let w2Threads = Math.ceil(
      ns.growthAnalyzeSecurity(gThreads) / ns.weakenAnalyze(1)
    );
    let end = iterationMs * Math.ceil(
      Math.max(
        0,
        ns.getHackTime(victim) - timeSlotMs,
        ns.getWeakenTime(victim) - 2 * timeSlotMs,
        ns.getGrowTime(victim) - 3 * timeSlotMs,
      ) / iterationMs
    );
    let hSleep = end + timeSlotMs - ns.getHackTime(victim);
    let w1Sleep = end + 2 * timeSlotMs - ns.getWeakenTime(victim);
    let gSleep = end + 3 * timeSlotMs - ns.getGrowTime(victim);
    let w2Sleep = end + 4 * timeSlotMs - ns.getWeakenTime(victim);
    let h = execSubtask({
      script: botHack,
      threads: hThreads,
      priority,
    },
      hSleep,
      victim,
      getPort(victim),
      'H',
    );
    let w1 = execSubtask({
      script: botWeaken,
      threads: w1Threads,
      priority,
    },
      w1Sleep,
      victim,
      getPort(victim),
      'W1',
    );
    let g = execSubtask({
      script: botGrow,
      threads: gThreads,
      priority,
    },
      gSleep,
      victim,
      getPort(victim),
      'G',
    );
    let w2 = execSubtask({
      script: botWeaken,
      threads: w2Threads,
      priority,
    },
      w2Sleep,
      victim,
      getPort(victim),
      'W2',
    );
    if (h && w1 && g && w2) {
      tasks.push(new Task([h, w1, g, w2], victim, 'HWGW'));
      return
    }
    h?.stop();
    w1?.stop();
    g?.stop();
    w2?.stop();
  }

  function execPrep(victim: string, priority: number) {
    let s = myGetServer(victim);
    let growMult = Math.min(
      s.moneyMax / s.moneyAvailable,
      maxPrepGrowMult
    );
    let gThreads = Math.ceil(
      ns.growthAnalyze(victim, growMult)
    );
    let difficulty =
      s.hackDifficulty
      + ns.growthAnalyzeSecurity(gThreads)
      - s.minDifficulty;
    let wThreads = Math.ceil(
      difficulty / ns.weakenAnalyze(1)
    );
    let wSleep = Math.max(0,
      ns.getGrowTime(victim) + timeSlotMs - ns.getWeakenTime(victim)
    );
    let botW = execSubtask({
      script: botWeaken,
      threads: wThreads,
      priority,
    },
      wSleep,
      victim,
    );
    if (!botW) return;
    let subtasks = [botW];
    if (gThreads > 0) {
      let botG = execSubtask({
        script: botGrow,
        threads: gThreads,
        priority,
      },
        0,
        victim,
      );
      if (botG) {
        subtasks.push(botG);
      }
    }
    tasks.push(new Task(subtasks, victim, 'Prep'));
  }

  function execSubtask(
    { script, threads, priority }: {
      script: string;
      threads: number;
      priority: number;
    },
    ...args: ScriptArg[]
  ): SubTask | null {
    //ns.tprint({ script, threads, priority, sleep, victim });
    // @ignore-infinite
    while (true) {
      for (let bot of autoscan()) {
        let taskPid = ns.exec(
          script,
          bot,
          { threads, temporary: true },
          ...args
        );
        if (taskPid !== 0) {
          return new SubTask(taskPid);
        }
      }
      let leastImportant = tasks.at(-1);
      if (!leastImportant || leastImportant.priority >= priority) {
        return null;
      }
      leastImportant.stop();
      ++stats[leastImportant.category].stoppedSpace;
      tasks.pop();
    }
  }

  function copyHelpers() {
    for (let bot of autoscan()) {
      ns.scp([
        botWeaken,
        botGrow,
        botHack,
      ],
        bot,
        'home'
      );
    }
  }

  function nukeAll() {
    for (let h of autoscan()) {
      let { hasAdminRights } = ns.getServer(h);
      if (hasAdminRights) {
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

  function sortVictims(): string[] {
    function isEasy(h: string): boolean {
      let s = ns.getServer(h);
      if (typeof s.requiredHackingSkill === 'undefined') return false;
      return s.requiredHackingSkill <= ns.getHackingLevel() / 2;
    };
    function moneyMax(h: string): number {
      let s = ns.getServer(h);
      return s.moneyMax ?? 0;
    }
    return autoscan()
      .filter(h => {
        let s = ns.getServer(h);
        if (!s.hasAdminRights) return false;
        if (s.moneyMax === undefined || s.moneyMax === 0) return false;
        if (s.requiredHackingSkill === undefined) return false;
        return s.requiredHackingSkill <= ns.getHackingLevel();
      })
      .sort((a, b) =>
        (Number(isEasy(b)) - Number(isEasy(a)))
        || (moneyMax(b) - moneyMax(a))
      );
  }

  function autoscan(): string[] {
    // https://www.reddit.com/r/Bitburner/comments/16u9akw/3_line_script_to_get_all_servers/
    let hosts = new Set(["home"]);
    hosts.forEach(h => { ns.scan(h).forEach(n => hosts.add(n)); });
    return Array.from(hosts);
  }

  type taskCategory = 'HWGW' | 'Prep';
  class SubTask {
    constructor(taskPid: number) {
      this.taskPid = taskPid;
    }
    taskPid: number;
    stop() {
      ns.kill(this.taskPid);
    }
    isDone(): boolean {
      return !ns.isRunning(this.taskPid);
    }
  }
  class Task {
    constructor(
      subtasks: SubTask[],
      victim: string,
      category: taskCategory,
    ) {
      this.subtasks = subtasks;
      this.victim = victim;
      this.category = category;
      ++stats[category].started;
    }
    subtasks: SubTask[];
    victim: string;
    category: taskCategory;
    priority: number = 0;
    stop(): void {
      for (let sub of this.subtasks) {
        sub.stop();
      }
    }
    isDone(): boolean {
      return this.subtasks.every(sub => sub.isDone());
    }
  }

  function getPort(victim: string): number {
    if (ports[victim] === undefined) {
      ns.clearPort(nextPort);
      ports[victim] = nextPort++;
    }
    return ports[victim];
  }

  let tasks: Task[] = [];
  let nextPort = 1;
  let ports: { [index: string]: number } = {};
  let stats = {
    HWGW: { started: 0, stoppedSpace: 0, stoppedCategory: 0 },
    Prep: { started: 0, stoppedSpace: 0, stoppedCategory: 0 },
    skipped: 0,
  };
  let serverStats: {
    [inxex: string]: {
      ff: number,
      tf: number,
      ft: number,
    }
  } = {};

  await mainLoop();
}
