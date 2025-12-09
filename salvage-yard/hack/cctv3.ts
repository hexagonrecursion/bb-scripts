export function autocomplete(
  data: AutocompleteData,
  args: string[],
): string[] {
  switch (args[0]) {
    case 'test-one': {
      return Object.keys(data.enums.CodingContractName);
    }
    case 'run': {
      return data.servers;
    }
    default: {
      return ['test-one', 'test-all', 'run'];
    }
  }
}

export async function main(ns: NS) {
  switch (ns.args[0]) {
    case 'test-one': {
      function usage() {
        ns.tprintf(
          'Usage:\n%s %s FindLargestPrimeFactor 1000',
          ns.getScriptName(),
          ns.args[0],
        );
      }
      const argTyp = ns.args[1];
      if (
        typeof argTyp !== 'string' ||
        !(argTyp in ns.enums.CodingContractName)
      ) {
        usage();
        return;
      }
      const typ = ns.enums.CodingContractName[
        argTyp as keyof typeof CodingContractName
      ];
      const numTests = Number(ns.args[2]);
      if (isNaN(numTests) || numTests <= 0) {
        usage();
        return;
      }
      await testOne(
        ns,
        typ,
        numTests,
      );
      break;
    }
    case 'test-all': {
      const numTests = Number(ns.args[1]);
      if (isNaN(numTests) || numTests <= 0) {
        ns.tprintf(
          'Usage:\n%s %s 1000',
          ns.getScriptName(),
          ns.args[0],
        );
        return;
      }
      await testAll(
        ns,
        numTests,
      );
      break;
    }
    case 'run': {
      const host = ns.args[1];
      const file = ns.args[2];
      if (
        typeof host !== 'string'
        || typeof file !== 'string'
      ) {
        ns.tprintf(
          'Usage:\n%s %s home contract-663064.cct',
          ns.getScriptName(),
          ns.args[0],
        );
        return;
      }
      await runOne(
        ns,
        host,
        file,
      );
      break;
    }
    default: {
      ns.tprintf(
        'Usage:\n%1$s test-all ...\n%1$s test-one ...\n%1$s run ...',
        ns.getScriptName(),
      );
      break;
    }
  }
}

type Result = (
  {
    result: 'file not found',
    exception: any
  } | {
    result: 'solver not found',
    type: CodingContractName,
  } | {
    result: 'solver error',
    type: CodingContractName,
    data: any,
    exception: any,
  } | {
    result: 'ok',
    type: CodingContractName,
    reward: string,
  } | {
    result: 'incorrect answer',
    type: CodingContractName,
    data: any,
    answer: any,
  }
);

async function submit(
  ns: NS, host: string, file: string, verbose: boolean
): Promise<Result> {
  let cct;
  try {
    cct = ns.codingcontract.getContract(file, host);
  } catch (exception) {
    return {
      result: 'file not found',
      exception,
    };
  }
  const solver = solvers[cct.type];
  if (!solver) {
    return {
      result: 'solver not found',
      type: cct.type,
    };
  }
  const c = new Ctx(ns, verbose);
  let answer;
  try {
    answer = await (solver as any)(c, cct.data);
  } catch (exception) {
    return {
      result: 'solver error',
      type: cct.type,
      data: cct.data,
      exception,
    };
  }
  const reward = cct.submit(answer);
  if (reward) {
    return {
      result: 'ok',
      type: cct.type,
      reward,
    }
  }
  return {
    result: 'incorrect answer',
    type: cct.type,
    data: cct.data,
    answer
  };
}

function unreachable(x: never) {
  throw new Error('unreachable');
}

async function testAll(
  ns: NS, numTests: number
) {
  const noSolver: { [k: string]: true } = {};
  const error: { [k: string]: true } = {};
  const ok: { [k: string]: true } = {};
  let typ: keyof typeof CodingContractName;
  forAllTypes: for (typ in ns.enums.CodingContractName) {
    for (let i = 0; i < numTests; ++i) {
      await ns.sleep(0);
      ns.tprintf('%s %d', typ, i);
      const file = ns.codingcontract.createDummyContract(
        ns.enums.CodingContractName[typ]
      );
      const result = await submit(ns, 'home', file, false);
      switch (result.result) {
        case 'file not found': {
          ns.tprint(result.result);
          ns.tprint(file);
          ns.tprint(result.exception);
          return;
        }
        case 'solver not found': {
          noSolver[result.type] = true;
          ns.rm(file);
          continue forAllTypes;
        }
        case 'solver error': {
          error[result.type] = true;
          continue forAllTypes;
        }
        case 'incorrect answer': {
          error[result.type] = true;
          continue forAllTypes;
        }
        case 'ok': {
          ok[result.type] = true;
          break;
        }
        default: {
          unreachable(result);
          return;
        }
      }
    }
  }
  ns.tprintf('OK:');
  for (const typ of Object.keys(ok)) {
    ns.tprintf('\t%s', typ);
  }
  ns.tprintf('No solver:');
  for (const typ of Object.keys(noSolver)) {
    ns.tprintf('\t%s', typ);
  }
  ns.tprintf('Error:');
  for (const typ of Object.keys(error)) {
    ns.tprintf('\t%s', typ);
  }
}

async function testOne(
  ns: NS, typ: CodingContractName, numTests: number
) {
  for (let i = 0; i < numTests; ++i) {
    await ns.sleep(0);
    ns.tprintf('%d', i);
    const file = ns.codingcontract.createDummyContract(typ);
    const result = await submit(ns, 'home', file, false);
    switch (result.result) {
      case 'file not found': {
        ns.tprint(result.result);
        ns.tprint(file);
        ns.tprint(result.exception);
        return;
      }
      case 'solver not found': {
        ns.tprint(result.result);
        ns.tprint(result.type);
        return;
      }
      case 'solver error': {
        ns.tprint(result.result);
        ns.tprint('home:', file);
        ns.tprint(result.type);
        ns.tprint(result.data);
        ns.tprint('======>');
        ns.tprint(result.exception);
        throw result.exception;
        return;
      }
      case 'incorrect answer': {
        ns.tprint(result.result);
        ns.tprint('home:', file);
        ns.tprint(result.type);
        ns.tprint(result.data);
        ns.tprint('======>');
        ns.tprint(result.answer);
        return;
      }
      case 'ok': {
        break;
      }
      default: {
        unreachable(result);
        return;
      }
    }
  }
  ns.tprintf('Success');
  ns.tprintf('%s', typ);
}

async function runOne(
  ns: NS,
  host: string,
  file: string,
) {
  const result = await submit(ns, host, file, true);
  switch (result.result) {
    case 'file not found': {
      ns.tprint(result.result);
      ns.tprint(file);
      ns.tprint(result.exception);
      return;
    }
    case 'solver not found': {
      ns.tprint(result.result);
      ns.tprint(result.type);
      return;
    }
    case 'solver error': {
      ns.tprint(result.result);
      ns.tprint('home:', file);
      ns.tprint(result.type);
      ns.tprint(result.data);
      ns.tprint('======>');
      ns.tprint(result.exception);
      throw result.exception;
    }
    case 'incorrect answer': {
      ns.tprint(result.result);
      ns.tprint('home:', file);
      ns.tprint(result.type);
      ns.tprint(result.data);
      ns.tprint('======>');
      ns.tprint(result.answer);
      return;
    }
    case 'ok': {
      ns.tprint(result.result);
      ns.tprint(result.type);
      ns.tprint(result.reward);
      return;
    }
    default: {
      unreachable(result);
      return;
    }
  }
}

class Ctx {
  ns: NS;
  verbose: boolean;
  start: number;
  constructor(ns: NS, verbose: boolean) {
    this.ns = ns;
    this.verbose = verbose;
    this.start = Date.now();
  }
  log(...args: any) {
    if (this.verbose) {
      this.ns.tprint(...args);
    }
  }
  tick<Cond>(b: Cond): Cond {
    if (Date.now() - this.start > 1000) {
      throw new Error('Timeout');
    }
    return b;
  }
  memoize<A, R>(
    key: (arg: A) => string,
    f: (arg: A) => R,
  ): (arg: A) => R {
    const cache: {
      [k: string]: R,
    } = {};
    return (arg: A) => {
      const k = key(arg);
      let res = cache[k];
      if (res !== undefined) {
        return res;
      }
      this.tick(true);
      res = f(arg);
      this.log(k, ' => ', res);
      cache[k] = res;
      return res;
    }
  }
};

const solvers: {
  [T in keyof CodingContractSignatures]?
  : (c: Ctx, data: CodingContractSignatures[T][0])
    => Promise<CodingContractSignatures[T][1]>
} = {
  'Find Largest Prime Factor':
    async function (c: Ctx, data: number): Promise<number> {
      for (let i = 2; c.tick(i * i <= data); ++i) {
        while (c.tick(data % i === 0)) {
          data /= i;
        }
        if (data === 1) return i;
      }
      return data;
    },

  'Subarray with Maximum Sum':
    async function (c: Ctx, data: number[]): Promise<number> {
      let partialSum = 0;
      let minPartialSum = 0;
      let maxSubarraySum = -Infinity;
      for (const n of data) {
        partialSum += n;
        maxSubarraySum = Math.max(
          maxSubarraySum,
          partialSum - minPartialSum,
        );
        minPartialSum = Math.min(minPartialSum, partialSum);
      }
      return maxSubarraySum;
    },

  'Total Ways to Sum':
    async function (c: Ctx, data: number): Promise<number> {
      const arr = [];
      for (let i = 1; c.tick(i < data); ++i) {
        arr.push(i);
      }
      arr.reverse(); // optimization
      return solvers['Total Ways to Sum II']!(
        c,
        [data, arr],
      );
    },

  'Total Ways to Sum II':
    async function (c: Ctx, data: [number, number[]]): Promise<number> {
      const arr = data[1];
      const rec = c.memoize<[number, number], number>(
        ([start, goal]) => `${start} ${goal}`,
        ([start, goal]) => {
          if (start === arr.length) {
            return goal === 0 ? 1 : 0;
          }
          let res = 0;
          for (let use = 0;
            c.tick(goal - use * arr[start] >= 0);
            ++use
          ) {
            res += rec([
              start + 1,
              goal - use * arr[start]
            ]);
          }
          return res;
        },
      );
      return rec([0, data[0]]);
    },

  'Spiralize Matrix':
    async function (c: Ctx, data: number[][]): Promise<number[]> {
      const res = [];
      for (
        let
        top = 0,
        bottom = data.length - 1,
        left = 0,
        right = data[0].length - 1;

        c.tick(top <= bottom && left <= right);

        ++top, --bottom, ++left, --right
      ) {
        if (top === bottom) {
          for (let j = left; c.tick(j <= right); ++j) {
            res.push(data[top][j]);
          }
          break;
        }
        if (right === left) {
          for (let i = top; c.tick(i <= bottom); ++i) {
            res.push(data[i][right]);
          }
          break;
        }
        for (let j = left; c.tick(j < right); ++j) {
          res.push(data[top][j]);
        }
        for (let i = top; c.tick(i < bottom); ++i) {
          res.push(data[i][right]);
        }
        for (let j = right; c.tick(j > left); --j) {
          res.push(data[bottom][j]);
        }
        for (let i = bottom; c.tick(i > top); --i) {
          res.push(data[i][left]);
        }
      }
      return res;
    },

  'Array Jumping Game':
    async function (c: Ctx, data: number[]): Promise<0 | 1> {
      const steps = await solvers['Array Jumping Game II']!(
        c, data
      );
      return steps !== 0 ? 1 : 0;
    },

  'Array Jumping Game II':
    async function (c: Ctx, data: number[]): Promise<number> {
      const shortest = c.memoize<number, number>(
        start => `${start}`,
        start => {
          if (start === data.length - 1) {
            return 0;
          }
          let ret = Infinity;
          for (let jump = 1;
            c.tick(jump <= data[start]);
            ++jump
          ) {
            ret = Math.min(ret, 1 + shortest(start + jump));
          }
          return ret;
        },
      );
      const res = shortest(0);
      return isFinite(res) ? res : 0;
    },

  'Merge Overlapping Intervals':
    async function (c: Ctx, data: [number, number][]):
      Promise<[number, number][]> {
      const sorted = data.toSorted((a, b) =>
        a[0] - b[0]
      );
      const res: [number, number][] = [];
      for (const [s, e] of sorted) {
        const prev = res.at(-1);
        if (prev && s <= prev[1]) {
          prev[1] = Math.max(prev[1], e);
        } else {
          res.push([s, e]);
        }
      }
      return res;
    },

  'Generate IP Addresses':
    async function (c: Ctx, data: string): Promise<string[]> {
      const isValid = (octet: string) => {
        if (octet === '0') return true;
        if (octet[0] === '0') return false;
        if (octet === '') return false;
        return 0 <= Number(octet) && Number(octet) <= 255;
      }
      const rec = c.memoize<[number, number], string[]>(
        ([start, numOct]) => `${start} ${numOct}`,
        ([start, numOct]) => {
          if (numOct === 1) {
            const octet = data.substring(start);
            return isValid(octet) ? [octet] : [];
          }
          const res: string[] = [];
          for (let len = 1; c.tick(len <= 3); ++len) {
            if (start + len > data.length) break;
            const octet = data.substring(start, start + len);
            if (!isValid(octet)) continue;
            for (const remainder of rec([start + len, numOct - 1])) {
              res.push(octet + '.' + remainder)
            }
          }
          return res;
        },
      );
      return rec([0, 4]);
    },

  'Algorithmic Stock Trader II':
    async function (c: Ctx, data: number[]): Promise<number> {
      let res = 0;
      let prev = data[0];
      for (const price of data) {
        res += Math.max(0, price - prev);
        prev = price;
      }
      return res;
    },

  'Algorithmic Stock Trader IV':
    async function (c: Ctx, data: [number, number[]]): Promise<number> {
      const days = data[1];
      const rec = c.memoize<[number, number], number>(
        ([start, transactions]) => `${start} ${transactions}`,
        ([start, transactions]) => {
          if (transactions === 0) return 0;
          let best = 0;
          let min = days[start];
          for (let i = start; c.tick(i < days.length); ++i) {
            min = Math.min(min, days[i]);
            best = Math.max(
              best,
              days[i] - min + rec([i + 1, transactions - 1]),
            );
          }
          return best;
        }
      );
      return rec([0, data[0]]);
    },

  'Algorithmic Stock Trader III':
    async function (c: Ctx, data: number[]): Promise<number> {
      return solvers['Algorithmic Stock Trader IV']!(
        c, [2, data]
      );
    },

  'Algorithmic Stock Trader I':
    async function (c: Ctx, data: number[]): Promise<number> {
      return solvers['Algorithmic Stock Trader IV']!(
        c, [1, data],
      );
    },

  'Minimum Path Sum in a Triangle':
    async function (c: Ctx, data: number[][]): Promise<number> {
      const rec = c.memoize<[number, number], number>(
        ([i, j]) => `${i} ${j}`,
        ([i, j]): number => {
          if (i === data.length) return 0;
          return data[i][j] + Math.min(
            rec([i + 1, j]), rec([i + 1, j + 1]),
          );
        },
      );
      return rec([0, 0]);
    },

  'Unique Paths in a Grid II':
    async function (c: Ctx, data: (0 | 1)[][]): Promise<number> {
      const rec = c.memoize<[number, number], number>(
        ([i, j]) => `${i} ${j}`,
        ([i, j]): number => {
          if (i === data.length) return 0;
          if (j === data[i].length) return 0;
          if (data[i][j] === 1) return 0;
          if (
            i === data.length - 1
            && j === data[i].length - 1
          ) {
            return 1;
          }
          return rec([i + 1, j]) + rec([i, j + 1]);
        }
      );
      return rec([0, 0]);
    },

  'Unique Paths in a Grid I':
    async function (c: Ctx, data: [number, number]): Promise<number> {
      return solvers['Unique Paths in a Grid II']!(
        c,
        Array(data[0]).fill(
          Array(data[1]).fill(0)
        ),
      );
    },

  'Shortest Path in a Grid':
    async function (c: Ctx, data: (0 | 1)[][]): Promise<string> {
      const toEnd: ('U' | 'D' | 'L' | 'R' | '?' | '*')[][]
        = data.map(r => r.map(_ => '?'));
      const H = data.length;
      const W = data[0].length;
      const queue: [number, number, 'U' | 'D' | 'L' | 'R' | '*'][] = [
        [H - 1, W - 1, '*']
      ];
      while (c.tick(queue.length)) {
        const [i, j, dir] = queue.shift()!;
        const isInBounds = (
          0 <= i && i < H
          && 0 <= j && j < W
        );
        if (
          !isInBounds
          || toEnd[i][j] !== '?'
          || data[i][j]
        ) {
          continue;
        }
        toEnd[i][j] = dir;
        queue.push(
          [i + 1, j, 'U'],
          [i - 1, j, 'D'],
          [i, j + 1, 'L'],
          [i, j - 1, 'R'],
        );
      }
      c.log(toEnd);
      if (toEnd[0][0] === '?') return '';
      let res = '';
      for (
        let i = 0,
        j = 0,
        next = toEnd[i][j];
        next !== '*' && next !== '?';
        next = toEnd[i][j]
      ) {
        res += next;
        const [di, dj] = {
          'U': [-1, 0],
          'D': [1, 0],
          'L': [0, -1],
          'R': [0, 1],
        }[next];
        i += di;
        j += dj;
      }
      return res;
    },

  'HammingCodes: Integer to Encoded Binary':
    async function (c: Ctx, data: number): Promise<string> {
      const binary = data.toString(2);
      let padded = '00';
      for (const bit of binary) {
        if (isPow2(padded.length)) {
          padded += '0';
        }
        padded += bit;
      }
      c.log(binary);
      c.log(padded);
      const res = [];
      for (let i = 1; padded[i]; ++i) {
        if (isPow2(i)) {
          res.push(await hammingParity(c, padded, i) ? '1' : '0');
        } else {
          res.push(padded[i]);
        }
      }
      const noLeading = res.join('');
      c.log(noLeading);
      return ((await hammingParity(c, noLeading, 0) ? '1' : '0')
        + noLeading);
    },

  'HammingCodes: Encoded Binary to Integer':
    async function (c: Ctx, data: string): Promise<number> {
      let err = 0;
      for (let i = 1; data[i]; i *= 2) {
        if (await hammingParity(c, data, i)) {
          err += i;
        }
      }
      c.log({ err });
      let res = 0;
      for (let i = 1; data[i]; ++i) {
        if (!isPow2(i)) {
          let bit = data[i] === '1';
          if (i === err) bit = !bit;
          res = 2 * res + (+bit);
        }
      }
      return res;
    },

  'Proper 2-Coloring of a Graph':
    async function (
      c: Ctx, data: [number, [number, number][]]
    ): Promise<(0 | 1)[]> {
      const graph = {} as { [v: number]: number[] };
      for (const [u, v] of data[1]) {
        graph[u] ??= [];
        graph[v] ??= [];
        graph[u].push(v);
        graph[v].push(u);
      }
      const res: (0 | 1)[] = [];
      const stack = [...Array(data[0]).keys()];
      while (c.tick(stack.length)) {
        //await ns.asleep(0);
        const v = stack.pop()!;
        if (res[v] === undefined) {
          res[v] = 0;
        }
        for (const u of graph[v] ?? []) {
          if (res[u] === undefined) {
            res[u] = res[v] ? 0 : 1;
            stack.push(u);
          } else {
            if (res[u] === res[v]) {
              return [];
            }
          }
        }
      }
      return res;
    },

  'Compression I: RLE Compression':
    async function (c: Ctx, data: string): Promise<string> {
      let res = '';
      let prev = data[0];
      let len = 0;
      for (const c of data) {
        if (c === prev && len < 9) {
          ++len;
        } else {
          res += `${len}${prev}`;
          prev = c;
          len = 1;
        }
      }
      if (len) {
        res += `${len}${prev}`;
      }
      return res;
    },

  'Compression II: LZ Decompression':
    async function (c: Ctx, data: string): Promise<string> {
      const result = [];
      for (let next = 0; c.tick(data[next]);) {
        let vLen = Number(data[next++]);
        while (c.tick(vLen--)) {
          result.push(data[next++]);
        }
        if (data[next]) {
          let rLen = Number(data[next++]);
          if (rLen) {
            const offset = Number(data[next++]);
            while (c.tick(rLen--)) {
              result.push(result.at(-offset));
            }
          }
        }
      }
      return result.join('');
    },

  'Encryption I: Caesar Cipher':
    async function (c: Ctx, data: [string, number]): Promise<string> {
      const result = [];
      for (const c of data[0]) {
        if ('A' <= c && c <= 'Z') {
          let cypher = c.charCodeAt(0) - data[1];
          if (cypher < 'A'.charCodeAt(0)) {
            cypher += 26;
          }
          result.push(String.fromCharCode(cypher));
        } else {
          result.push(c);
        }
      }
      return result.join('');
    },

  'Encryption II: Vigenère Cipher':
    async function (c: Ctx, data: [string, string]): Promise<string> {
      const [plain, key] = data;
      const result = [];
      let nextK = 0;
      for (const p of plain) {
        if ('A' <= p && p <= 'Z') {
          const plain = p.charCodeAt(0) - 'A'.charCodeAt(0);
          const k = key[
            (nextK++) % key.length
          ].charCodeAt(0) - 'A'.charCodeAt(0);
          result.push(String.fromCharCode(
            (plain + k) % 26 + 'A'.charCodeAt(0)
          ));
        } else {
          result.push(p);
        }
      }
      return result.join('');
    },

  'Square Root':
    async function (c: Ctx, data: bigint): Promise<bigint> {
      const abs = (x: bigint) => x >= 0 ? x : -x;
      let guess = 1n << BigInt(data.toString(4).length);
      c.log(guess);
      let absDiff = data;
      // newton's method
      while (c.tick(true)) {
        const otherGuess = data / guess;
        const nextAbsDiff = abs(guess - otherGuess);
        if (nextAbsDiff >= absDiff) break;
        absDiff = nextAbsDiff;
        guess = (guess + otherGuess) / 2n;
        c.log(guess);
      }
      c.log('--------------');
      // fixup a couple least significant bits
      absDiff = abs(data - guess ** 2n);
      while (c.tick(true)) {
        const nextGuess = guess + 1n;
        const nextAbsDiff = abs(data - nextGuess ** 2n);
        if (nextAbsDiff >= absDiff) break;
        absDiff = nextAbsDiff;
        guess = nextGuess;
        c.log(guess);
      }
      while (c.tick(true)) {
        const nextGuess = guess - 1n;
        const nextAbsDiff = abs(data - nextGuess ** 2n);
        if (nextAbsDiff >= absDiff) break;
        absDiff = nextAbsDiff;
        guess = nextGuess;
        c.log(guess);
      }
      return guess;
    },

  'Compression III: LZ Compression':
    async function (c: Ctx, data: string): Promise<string> {
      // let lvl = 0;
      function assertPos(pos: number) {
        if(pos < data.length) {
          return;
        }
        throw new Error('assert pos < data.length');
      }
      type Typ1 = {chunk1Len: number, cost: number};
      function typ1(pos: number): Typ1 {
        // c.log(lvl++);
        assertPos(pos);
        const {chunk1Len, cost} = typ1strict(pos);
        const {cost: cost2} = typ2strict(pos);
        const costZlen = cost2 + 1;
        if(cost <= costZlen) {
          return {chunk1Len, cost};
        }
        return {chunk1Len: 0, cost: costZlen};
      }
      type Typ2 = {
        chunk2Len: number,
        offset: number,
        cost: number,
      };
      function typ2(pos: number): Typ2 {
        // c.log([2, pos, lvl++]);
        assertPos(pos);
        const {cost: cost1} = typ1strict(pos);
        const {chunk2Len, offset, cost} = typ2strict(pos);
        const costZlen = cost1 + 1;
        if(chunk2Len && cost <= costZlen) {
          return {chunk2Len, offset, cost};
        }
        return {chunk2Len: 0, offset: 0, cost: costZlen};
      }
      const typ1strict = c.memoize<number, Typ1>(
        pos => ''+pos,
        pos => {
          // c.log([1, pos, lvl++]);
          assertPos(pos);
          let chunk1Len = -1;
          let cost = Infinity;
          for(let len = 1; len <= 9; ++len) {
            if(pos + len === data.length) {
              const cost1 = 1 + len;
              if(cost1 <= cost) {
                cost = cost1;
                chunk1Len = len;
              }  
              break;
            }
            const {cost: cost2} = typ2(pos + len);
            const cost1 = 1 + len + cost2;
            if(cost1 <= cost) {
              cost = cost1;
              chunk1Len = len;
            }
          }
          if(chunk1Len < 0) throw new Error('chunk1Len < 0');
          return {chunk1Len, cost};
        },
      );
      const typ2strict = c.memoize<number, Typ2>(
        pos => ''+pos,
        pos => {
          // c.log(lvl++);
          assertPos(pos);
          let chunk2Len = 0;
          let cost = Infinity;
          let offset = 0;
          for(let off = 1; off <= 9; ++off) {
            if(off > pos) break;
            for(let len = 1; len <= 9; ++len) {
              const a = data.slice(pos, pos+len);
              const b = data.slice(pos-off, pos-off+len);
              if(a !== b) break;
              if(pos + len === data.length) {
                const cost2 = 2;
                if(cost2 <= cost) {
                  chunk2Len = len;
                  cost = cost2;
                  offset = off;
                }
                break;
              }
              const {cost: cost1} = typ1(pos+len);
              const cost2 = 2 + cost1;
              if(cost2 <= cost) {
                chunk2Len = len;
                cost = cost2;
                offset = off;
              }
            }
          }
          return {chunk2Len, cost, offset};
        },
      );

      const res: string[] = [];
      let pos = 0;
      while(c.tick(true)) {
        if(pos === data.length) break;
        const {chunk1Len} = typ1(pos);
        res.push(''+chunk1Len);
        res.push(data.slice(pos, pos + chunk1Len));
        pos += chunk1Len;
        if(pos === data.length) break;
        const {chunk2Len, offset} = typ2(pos);
        res.push(''+chunk2Len);
        pos += chunk2Len;
        if(chunk2Len) {
          res.push(''+offset);
        }
      }
      return res.join('');
    },
};

function isPow2(x: number): boolean {
  return x > 0 && (x & (x - 1)) === 0;
}

async function hammingParity(
  c: Ctx, data: string, pos: number
): Promise<boolean> {
  const len = pos ? pos : data.length;
  const skip = pos ? 2 * pos : data.length;
  let res = false;
  const xor = (a: boolean, b: boolean) => a !== b;
  for (let start = pos; c.tick(data[start]); start += skip) {
    for (let i = 0; c.tick(data[start + i] && i < len); ++i) {
      res = xor(res, data[start + i] === '1');
    }
  }
  return res;
}
