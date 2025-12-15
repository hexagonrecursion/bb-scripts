/// stochastic hill-climbing optimizer
export async function main(ns: NS) {
  const dir = ns.getScriptName().replace(/\/[^\/]*$/, '');
  const dataFile = dir + '/round-2.json';
  init(ns);
  let bestScore = undefined;
  let best: Levels = JSON.parse(ns.read(dataFile));
  let goalEvaluations = 0;
  while (true) {
    if (goalEvaluations % 10 === 0) {
      // avoid getting stuck due to a lucky score
      bestScore = undefined;
    }
    const experimentalyDeterminedMedianFunds = 319e9;
    reset(ns, experimentalyDeterminedMedianFunds);
    const levels = mutate(ns, best);
    const score = await evaluateScore(ns, levels);
    ++goalEvaluations;
    ns.print({ score: ns.formatNumber(score), goalEvaluations });
    ns.print(levels);
    if (bestScore === undefined || score > bestScore) {
      bestScore = score;
      best = levels;
      ns.tprint({ score: ns.formatNumber(score), goalEvaluations });
      ns.tprint(levels);
      ns.write(dataFile, JSON.stringify(levels), 'w');
    }
  }
}

function mutate(ns: NS, best: Levels): Levels {
  const boostProb = 1 / Object.keys(best).length;
  const boostRand = Math.random();
  if (boostRand < boostProb) {
    return {
      ...best,
      agricultureBoost: (
        9 * best.agricultureBoost + Math.random()
      ) / 10
    };
  }
  if (boostRand < 2 * boostProb) {
    return {
      ...best,
      chemicalBoost: (
        9 * best.chemicalBoost + Math.random()
      ) / 10
    };
  }
  const mutator = new Mutator(ns, best);
  const [improve, ...rest] = toShuffled(Object.values(HasLevel));
  mutator.inc(improve);
  const teaPartyReserve = 1e9;
  while (mutator.getFunds() < teaPartyReserve) {
    const last = rest.at(-1);
    if (last === undefined) {
      return best;
    }
    if (mutator.dec(last) !== 'ok') {
      rest.pop();
    }
  }
  mutator.incMax(improve, teaPartyReserve);
  for (const key of [...rest, ...toShuffled(Object.values(HasLevel))]) {
    mutator.incMax(key, teaPartyReserve);
  }
  return mutator.asLevels();
}

class Mutator {
  inc(what: HasLevel) {
    ++this.current[what];
  }
  dec(what: HasLevel): 'ok' | 'hit-zero' {
    if(this.current[what] === 0) {
      return 'hit-zero';
    }
    --this.current[what];
    return 'ok';
  }
  incMax(what: HasLevel, teaPartyReserve: number) {
    while(this.getFunds() > teaPartyReserve) {
      this.inc(what);
    }
    if(this.getFunds() < teaPartyReserve) {
      this.dec(what);
    }
  }
  asLevels(): Levels {
    return this.current;
  }
  getFunds(): number {
    throw new Error("Method not implemented.");
  }
  constructor(ns: NS, best: Levels) {
    this.ns = ns;
    this.current = {...best};
  }
  current: Levels;
  ns: NS;
};

function toShuffled<T>(arr: T[]): T[] {
  const ret = [...arr];
  for (let end = ret.length; end >= 2; --end) {
    const i = Math.floor(Math.random() * end);
    assert(i < end, 'i < end');
    [ret[i], ret[end - 1]] = [ret[end - 1], ret[i]];
  }
  return ret;
}

function assert(test: boolean, err: string) {
  if (!test) {
    throw new Error('assertion failed: ' + err);
  }
}

enum HasLevel {
  smartStorage = 'smartStorage',
  agricultureAdvert = 'agricultureAdvert',
  agricultureWarehouse = 'agricultureWarehouse',
  agricultureOperations = 'agricultureOperations',
  agricultureEngineer = 'agricultureEngineer',
  agricultureBusiness = 'agricultureBusiness',
  agricultureManagement = 'agricultureManagement',
  chemicalWarehouse = 'chemicalWarehouse',
  chemicalOperations = 'chemicalOperations',
  chemicalEngineer = 'chemicalEngineer',
  chemicalManagement = 'chemicalManagement',
};

type Levels = {
  agricultureBoost: number,
  chemicalBoost: number,
} & Record<HasLevel, number>;
