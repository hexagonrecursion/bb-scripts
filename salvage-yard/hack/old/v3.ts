// mango is a randomly chosen word to avoid collisions
const botWeaken = '/mango/weaken.js';
const botGrow = '/mango/grow.js';
const botHack = '/mango/hack.js';
const timeSlotMs = 200;

export async function main(ns: NS) {
  async function mainLoop() {
    ns.disableLog('ALL');
    while (true) {
      nukeAll();
      purchaseServers();
      copyHelpers();
      clearDone();
      let targets = sortTargets();
      for (let i = 0; i < targets.length; ++i) {
        let victim = targets[i];
        let lowerPriority = targets.slice(i + 1);
        let needType = isReady(victim) ? "HWGW" : "Prep";
        let isReplace = !!groups[victim]; 
        if (groups[victim] && groups[victim].groupType !== needType) {
          ns.print(`${victim}: ${groups[victim].groupType} ==> ${needType}`);
          groups[victim].killAll();
          delete groups[victim];
        }
        if (!groups[victim]) {
          groups[victim] = isReady(victim)
            ? new HWGW(victim)
            : new Prep(victim);
          if(!isReplace) {
            ns.print(`${victim}: ${groups[victim].groupType}`);
          }
        }
        groups[victim].expand(lowerPriority);
      }
      await ns.sleep(5 * timeSlotMs);
    }
  }

  function clearDone() {
    for (let host in groups) {
      groups[host].clearDone();
    }
  }

  function sortTargets(): string[] {
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
        if (typeof s.requiredHackingSkill === 'undefined') return false;
        return s.requiredHackingSkill <= ns.getHackingLevel();
      })
      .toSorted((a, b) =>
        (Number(isEasy(b)) - Number(isEasy(a)))
        || (moneyMax(b) - moneyMax(a))
      );
  }

  function isReady(target: string): boolean {
    let s = ns.getServer(target);
    if (
      s.moneyAvailable === undefined
      || s.moneyMax === undefined
      || s.hackDifficulty === undefined
      || s.minDifficulty === undefined
    ) {
      throw s;
    }
    return s.moneyAvailable === s.moneyMax
      && s.hackDifficulty === s.minDifficulty;
  }

  function autoscan(): string[] {
    // https://www.reddit.com/r/Bitburner/comments/16u9akw/3_line_script_to_get_all_servers/
    let hosts = new Set(["home"]);
    hosts.forEach(h => { ns.scan(h).forEach(n => hosts.add(n)); });
    return Array.from(hosts);
  }

  interface BotGroup {
    clearDone(): void;
    killSome(): boolean;
    killAll(): void;
    expand(lowerPriority: string[]): void;
    groupType: "HWGW" | "Prep";
  }
  const groups: { [index: string]: BotGroup } = {};

  await mainLoop();
}