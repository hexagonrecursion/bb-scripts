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
  let answer;
  try {
    answer = await (solver as any)(ns, cct.data, verbose);
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
  throw 'unreachable';
}

async function testAll(
  ns: NS, numTests: number
) {
  const noSolver: {[k: string]: true} = {};
  const error: {[k: string]: true} = {};
  const ok: {[k: string]: true} = {};
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
  for(const typ of Object.keys(ok)) {
    ns.tprintf('\t%s', typ);
  }
  ns.tprintf('No solver:');
  for(const typ of Object.keys(noSolver)) {
    ns.tprintf('\t%s', typ);
  }
  ns.tprintf('Error:');
  for(const typ of Object.keys(error)) {
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

const solvers: {
  [T in keyof CodingContractSignatures]?
  : (
    ns: NS,
    data: CodingContractSignatures[T][0],
    verbose: boolean,
  ) => Promise<CodingContractSignatures[T][1]>
} = {
  'Find Largest Prime Factor':
    async function (
      ns: NS, data: number, verbose: boolean
    ): Promise<number> {
      for (let i = 2; i * i <= data; ++i) {
        while (data % i === 0) {
          data /= i;
        }
        if (data === 1) return i;
      }
      return data;
    },

  'Subarray with Maximum Sum':
    async function (
      ns: NS, data: number[], verbose: boolean
    ): Promise<number> {
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
    async function (
      ns: NS, data: number, verbose: boolean
    ): Promise<number> {
      const arr = [];
      for (let i = 1; i < data; ++i) {
        arr.push(i);
      }
      arr.reverse(); // optimization
      return solvers['Total Ways to Sum II']!(
        ns,
        [data, arr],
        verbose,
      );
    },

  'Total Ways to Sum II':
    async function (
      ns: NS, data: [number, number[]], verbose: boolean
    ): Promise<number> {
      const arr = data[1];
      const rec = memoize<[number, number], number>(
        ([start, goal]) => `${start} ${goal}`,
        ([start, goal]) => {
          if (start === arr.length) {
            return goal === 0 ? 1 : 0;
          }
          let res = 0;
          for (let use = 0; goal - use * arr[start] >= 0; ++use) {
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
    async function (
      ns: NS, data: number[][], verbose: boolean
    ): Promise<number[]> {
      const res = [];
      for (
        let
        top = 0,
        bottom = data.length - 1,
        left = 0,
        right = data[0].length - 1;
        top <= bottom && left <= right;
        ++top, --bottom, ++left, --right
      ) {
        if (top === bottom) {
          for (let r = left; r <= right; ++r) {
            res.push(data[top][r]);
          }
          break;
        }
        if (right === left) {
          for (let c = top; c <= bottom; ++c) {
            res.push(data[c][right]);
          }
          break;
        }
        for (let r = left; r < right; ++r) {
          res.push(data[top][r]);
        }
        for (let c = top; c < bottom; ++c) {
          res.push(data[c][right]);
        }
        for (let r = right; r > left; --r) {
          res.push(data[bottom][r]);
        }
        for (let c = bottom; c > top; --c) {
          res.push(data[c][left]);
        }
      }
      return res;
    },

  'Array Jumping Game':
    async function (
      ns: NS, data: number[], verbose: boolean
    ): Promise<0 | 1> {
      const steps = await solvers['Array Jumping Game II']!(
        ns, data, verbose,
      );
      return steps !== 0 ? 1 : 0;
    },

  'Array Jumping Game II':
    async function (
      ns: NS, data: number[], verbose: boolean
    ): Promise<number> {
      const shortest = memoize<number, number>(
        start => `${start}`,
        start => {
          if (start === data.length - 1) {
            return 0;
          }
          let ret = Infinity;
          for (let jump = 1; jump <= data[start]; ++jump) {
            ret = Math.min(ret, 1 + shortest(start + jump));
          }
          return ret;
        },
      );
      const res = shortest(0);
      return isFinite(res) ? res : 0;
    },

  'Merge Overlapping Intervals':
    async function (
      ns: NS, data: [number, number][], verbose: boolean
    ): Promise<[number, number][]> {
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
    async function (
      ns: NS, data: string, verbose: boolean
    ): Promise<string[]> {
      const isValid = (octet: string) => {
        if (octet === '0') return true;
        if (octet[0] === '0') return false;
        if (octet === '') return false;
        return 0 <= Number(octet) && Number(octet) <= 255;
      }
      const rec = memoize<[number, number], string[]>(
        ([start, numOct]) => `${start} ${numOct}`,
        ([start, numOct]) => {
          if (numOct === 1) {
            const octet = data.substring(start);
            return isValid(octet) ? [octet] : [];
          }
          const res: string[] = [];
          for (let len = 1; len <= 3; ++len) {
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
    async function (
      ns: NS, data: number[], verbose: boolean
    ): Promise<number> {
      let res = 0;
      let prev = data[0];
      for (const price of data) {
        res += Math.max(0, price - prev);
        prev = price;
      }
      return res;
    },

  'Algorithmic Stock Trader IV':
    async function (
      ns: NS, data: [number, number[]], verbose: boolean
    ): Promise<number> {
      const days = data[1];
      const rec = memoize<[number, number], number>(
        ([start, transactions]) => `${start} ${transactions}`,
        ([start, transactions]) => {
          if (transactions === 0) return 0;
          let best = 0;
          let min = days[start];
          for (let i = start; i < days.length; ++i) {
            min = Math.min(min, days[i]);
            best = Math.max(
              best,
              days[i] - min + rec([i + 1, transactions - 1]),
            );
          }
          if (verbose) ns.tprint({ start, transactions, best });
          return best;
        }
      );
      return rec([0, data[0]]);
    },

  'Algorithmic Stock Trader III':
    async function (
      ns: NS, data: number[], verbose: boolean
    ): Promise<number> {
      return solvers['Algorithmic Stock Trader IV']!(
        ns,
        [2, data],
        verbose,
      );
    },

  'Algorithmic Stock Trader I':
    async function (
      ns: NS, data: number[], verbose: boolean
    ): Promise<number> {
      return solvers['Algorithmic Stock Trader IV']!(
        ns,
        [1, data],
        verbose,
      );
    },

  'Minimum Path Sum in a Triangle':
    async function (
      ns: NS, data: number[][], verbose: boolean
    ): Promise<number> {
      const rec = memoize<[number, number], number>(
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
    async function (
      ns: NS, data: (0 | 1)[][], verbose: boolean
    ): Promise<number> {
      const rec = memoize<[number, number], number>(
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
    async function (
      ns: NS, data: [number, number], verbose: boolean
    ): Promise<number> {
      return solvers['Unique Paths in a Grid II']!(
        ns,
        Array(data[0]).fill(
          Array(data[1]).fill(0)
        ),
        verbose,
      );
    },

  'Shortest Path in a Grid':
    async function (
      ns: NS, data: (0 | 1)[][], verbose: boolean
    ): Promise<string> {
      const toEnd: ('U' | 'D' | 'L' | 'R' | '?' | '*')[][]
        = data.map(r => r.map(_ => '?'));
      const H = data.length;
      const W = data[0].length;
      const queue: [number, number, 'U' | 'D' | 'L' | 'R' | '*'][] = [
        [H - 1, W - 1, '*']
      ];
      while (queue.length) {
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
      if (verbose) {
        ns.tprint(toEnd);
      }
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
    async function (
      ns: NS, data: number, verbose: boolean
    ): Promise<string> {
      const binary = data.toString(2);
      let padded = '00';
      for (const bit of binary) {
        if (isPow2(padded.length)) {
          padded += '0';
        }
        padded += bit;
      }
      if (verbose) {
        ns.tprint(binary);
        ns.tprint(padded);
      }
      // await ns.asleep(5000);
      const res = [];
      for (let i = 1; padded[i]; ++i) {
        if (isPow2(i)) {
          res.push(await hammingParity(ns, padded, i) ? '1' : '0');
        } else {
          res.push(padded[i]);
        }
      }
      const noLeading = res.join('');
      if (verbose) {
        ns.tprint(noLeading);
      }
      // await ns.asleep(5000);
      return ((await hammingParity(ns, noLeading, 0) ? '1' : '0')
        + noLeading);
    },

  'HammingCodes: Encoded Binary to Integer':
    async function (
      ns: NS, data: string, verbose: boolean
    ): Promise<number> {
      let err = 0;
      for (let i = 1; data[i]; i *= 2) {
        if (await hammingParity(ns, data, i)) {
          err += i;
        }
      }
      if (verbose) ns.tprint({ err });
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
      ns: NS, data: [number, [number, number][]], verbose: boolean
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
      while (stack.length) {
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
    async function (
      ns: NS, data: string, verbose: boolean
    ): Promise<string> {
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
    async function (
      ns: NS, data: string, verbose: boolean
    ): Promise<string> {
      const result = [];
      for (let next = 0; data[next];) {
        let vLen = Number(data[next++]);
        while (vLen--) {
          result.push(data[next++]);
        }
        if (data[next]) {
          let rLen = Number(data[next++]);
          if (rLen) {
            const offset = Number(data[next++]);
            while (rLen--) {
              result.push(result.at(-offset));
            }
          }
        }
      }
      return result.join('');
    },

  'Encryption I: Caesar Cipher':
    async function (
      ns: NS, data: [string, number], verbose: boolean
    ): Promise<string> {
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
    async function (
      ns: NS, data: [string, string], verbose: boolean
    ): Promise<string> {
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
    async function (
      ns: NS, data: bigint, verbose: boolean
    ): Promise<bigint> {
      const abs = (x: bigint) => x >= 0 ? x : -x;
      let guess = 1n << BigInt(data.toString(4).length);
      if (verbose) ns.tprint(guess);
      let absDiff = data;
      // newton's method
      while (true) {
        const otherGuess = data / guess;
        const nextAbsDiff = abs(guess - otherGuess);
        if (nextAbsDiff >= absDiff) break;
        absDiff = nextAbsDiff;
        guess = (guess + otherGuess) / 2n;
        if (verbose) ns.tprint(guess);
      }
      if (verbose) ns.tprint('--------------');
      // fixup a couple least significant bits
      absDiff = abs(data - guess ** 2n);
      while (true) {
        const nextGuess = guess + 1n;
        const nextAbsDiff = abs(data - nextGuess ** 2n);
        if (nextAbsDiff >= absDiff) break;
        absDiff = nextAbsDiff;
        if (verbose) ns.tprint(guess);
        guess = nextGuess;
      }
      while (true) {
        const nextGuess = guess - 1n;
        const nextAbsDiff = abs(data - nextGuess ** 2n);
        if (nextAbsDiff >= absDiff) break;
        absDiff = nextAbsDiff;
        if (verbose) ns.tprint(guess);
        guess = nextGuess;
      }
      return guess;
    },
};

function isPow2(x: number): boolean {
  return x > 0 && (x & (x - 1)) === 0;
}

async function hammingParity(
  ns: NS, data: string, pos: number
): Promise<boolean> {
  const len = pos ? pos : data.length;
  const skip = pos ? 2 * pos : data.length;
  let res = false;
  const xor = (a: boolean, b: boolean) => a !== b;
  for (let start = pos; data[start]; start += skip) {
    // await ns.asleep(0);
    for (let i = 0; data[start + i] && i < len; ++i) {
      // await ns.asleep(0);
      res = xor(res, data[start + i] === '1');
    }
  }
  return res;
}

function memoize<A, R>(
  key: (arg: A) => string,
  f: (arg: A) => R,
): (arg: A) => R {
  const cache: {
    [k: string]: R,
  } = {};
  return (arg: A) => {
    let res = cache[key(arg)];
    if (res !== undefined) {
      return res;
    }
    res = f(arg);
    cache[key(arg)] = res;
    return res;
  }
}
