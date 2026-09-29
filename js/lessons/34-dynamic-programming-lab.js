/* Lesson 34 · lab problem definitions: code (pseudocode, JavaScript, Python) with shared line labels, legends and
   variable colours. The step generators live in js/algos/34-dynamic-programming.js; every `line` label they use
   exists in every language below (tests/algos/34-dynamic-programming.test.js checks the label sets). */
(function () {
  'use strict';
  var V = window.VDSA;
  V.dp34 = V.dp34 || {};

  V.dp34.PROBLEMS = {
    stairs: {
      label: 'Climbing stairs', short: 'Stairs', title: 'climbStairs',
      code: {
        pseudo: [
          'function climbStairs(n)',
          '  ways ← array of n + 1 zeros',
          '  ways[0] ← 1                          // @base',
          '  for i ← 1 to n                       // @loop',
          '    ways[i] ← ways[i − 1] + (i ≥ 2 ? ways[i − 2] : 0)   // @rec',
          '  return ways[n]                       // @ret'
        ].join('\n'),
        js: [
          'function climbStairs(n) {',
          '  const ways = new Array(n + 1).fill(0);',
          '  ways[0] = 1;                                   // @base',
          '  for (let i = 1; i <= n; i++) {                 // @loop',
          '    ways[i] = ways[i - 1] + (i >= 2 ? ways[i - 2] : 0);   // @rec',
          '  }',
          '  return ways[n];                                // @ret',
          '}'
        ].join('\n'),
        py: [
          'def climb_stairs(n):',
          '    ways = [0] * (n + 1)',
          '    ways[0] = 1                                   # @base',
          '    for i in range(1, n + 1):                     # @loop',
          '        ways[i] = ways[i - 1] + (ways[i - 2] if i >= 2 else 0)   # @rec',
          '    return ways[n]                                # @ret'
        ].join('\n')
      },
      legend: [{ state: 'active', label: 'Cell being filled' }, { state: 'compare', label: 'Cells it reads' }, { state: 'key', shape: 'line', label: 'Dependency (both add)' }, { state: 'visited', label: 'Filled' }, { state: 'found', label: 'Answer' }],
      varStates: { i: 'active', 'ways[i]': 'active', 'ways[i-1]': 'compare', 'ways[i-2]': 'compare' }
    },
    coinMin: {
      label: 'Fewest coins', short: 'Fewest coins', title: 'minCoins',
      code: {
        pseudo: [
          'function minCoins(coins, amount)',
          '  dp ← array of amount + 1 values, all ∞',
          '  dp[0] ← 0                                   // @base',
          '  for a ← 1 to amount                         // @loop',
          '    for each coin c in coins                  // @coin',
          '      if c ≤ a and dp[a − c] + 1 < dp[a]      // @cmp',
          '        dp[a] ← dp[a − c] + 1; choice[a] ← c  // @take',
          '  return dp[amount]      // ∞ means impossible  @ret'
        ].join('\n'),
        js: [
          'function minCoins(coins, amount) {',
          '  const dp = new Array(amount + 1).fill(Infinity);',
          '  const choice = new Array(amount + 1).fill(null);',
          '  dp[0] = 0;                                        // @base',
          '  for (let a = 1; a <= amount; a++) {               // @loop',
          '    for (const c of coins) {                        // @coin',
          '      if (c <= a && dp[a - c] + 1 < dp[a]) {        // @cmp',
          '        dp[a] = dp[a - c] + 1; choice[a] = c;       // @take',
          '      }',
          '    }',
          '  }',
          '  return dp[amount] === Infinity ? -1 : dp[amount]; // @ret',
          '}'
        ].join('\n'),
        py: [
          'def min_coins(coins, amount):',
          '    INF = float("inf")',
          '    dp = [INF] * (amount + 1)',
          '    choice = [None] * (amount + 1)',
          '    dp[0] = 0                                       # @base',
          '    for a in range(1, amount + 1):                  # @loop',
          '        for c in coins:                             # @coin',
          '            if c <= a and dp[a - c] + 1 < dp[a]:    # @cmp',
          '                dp[a], choice[a] = dp[a - c] + 1, c # @take',
          '    return -1 if dp[amount] == INF else dp[amount]  # @ret'
        ].join('\n')
      },
      legend: [{ state: 'active', label: 'Cell being filled' }, { state: 'compare', label: 'Candidates' }, { state: 'key', label: 'Best candidate' }, { state: 'visited', label: 'Filled' }, { state: 'muted', label: '∞: impossible' }, { state: 'path', label: 'Coins used' }],
      varStates: { a: 'active', 'dp[a]': 'active', 'choice[a]': 'key' }
    },
    coinWays: {
      label: 'Coin combinations', short: 'Combinations', title: 'countWays',
      code: {
        pseudo: [
          'function countWays(coins, amount)       // k coin types',
          '  W ← table of (k + 1) × (amount + 1) zeros',
          '  W[0][0] ← 1                                   // @base',
          '  for i ← 1 to k                                // @loop',
          '    for a ← 0 to amount',
          '      W[i][a] ← W[i − 1][a]                     // @skip',
          '      if coins[i] ≤ a: W[i][a] ← W[i][a] + W[i][a − coins[i]]   // @use',
          '  return W[k][amount]                           // @ret'
        ].join('\n'),
        js: [
          'function countWays(coins, amount) {',
          '  const k = coins.length;',
          '  const W = Array.from({ length: k + 1 }, () => new Array(amount + 1).fill(0));',
          '  W[0][0] = 1;                                      // @base',
          '  for (let i = 1; i <= k; i++) {                    // @loop',
          '    const c = coins[i - 1];',
          '    for (let a = 0; a <= amount; a++) {',
          '      W[i][a] = W[i - 1][a];                        // @skip',
          '      if (c <= a) W[i][a] += W[i][a - c];           // @use',
          '    }',
          '  }',
          '  return W[k][amount];                              // @ret',
          '}'
        ].join('\n'),
        py: [
          'def count_ways(coins, amount):',
          '    k = len(coins)',
          '    W = [[0] * (amount + 1) for _ in range(k + 1)]',
          '    W[0][0] = 1                                     # @base',
          '    for i in range(1, k + 1):                       # @loop',
          '        c = coins[i - 1]',
          '        for a in range(amount + 1):',
          '            W[i][a] = W[i - 1][a]                   # @skip',
          '            if c <= a: W[i][a] += W[i][a - c]       # @use',
          '    return W[k][amount]                             # @ret'
        ].join('\n')
      },
      legend: [{ state: 'active', label: 'Cell being filled' }, { state: 'compare', label: 'Cells it adds' }, { state: 'key', shape: 'line', label: 'Dependency' }, { state: 'visited', label: 'Filled' }, { state: 'found', label: 'Answer' }],
      varStates: { i: 'active', a: 'active', 'W[i][a]': 'active', coin: 'key' }
    },
    robber: {
      label: 'House robber', short: 'House robber', title: 'rob',
      code: {
        pseudo: [
          'function rob(h)                     // houses h[1..n]',
          '  best[0] ← 0                                  // @base',
          '  for i ← 1 to n                               // @loop',
          '    skip ← best[i − 1]                         // @skip',
          '    rob ← (i ≥ 2 ? best[i − 2] : 0) + h[i]     // @rob',
          '    best[i] ← max(skip, rob)                   // @take',
          '  return best[n]                               // @ret'
        ].join('\n'),
        js: [
          'function rob(h) {                   // h[0..n-1] is house 1..n',
          '  const n = h.length, best = new Array(n + 1).fill(0);',
          '  best[0] = 0;                                     // @base',
          '  for (let i = 1; i <= n; i++) {                   // @loop',
          '    const skip = best[i - 1];                      // @skip',
          '    const take = (i >= 2 ? best[i - 2] : 0) + h[i - 1];  // @rob',
          '    best[i] = Math.max(skip, take);                // @take',
          '  }',
          '  return best[n];                                  // @ret',
          '}'
        ].join('\n'),
        py: [
          'def rob(h):                          # h[0..n-1] is house 1..n',
          '    n = len(h)',
          '    best = [0] * (n + 1)                            # @base',
          '    for i in range(1, n + 1):                       # @loop',
          '        skip = best[i - 1]                          # @skip',
          '        take = (best[i - 2] if i >= 2 else 0) + h[i - 1]  # @rob',
          '        best[i] = max(skip, take)                   # @take',
          '    return best[n]                                  # @ret'
        ].join('\n')
      },
      legend: [{ state: 'active', label: 'Cell being filled' }, { state: 'compare', label: 'Cells it reads' }, { state: 'key', label: 'Winning choice' }, { state: 'visited', label: 'Filled' }, { state: 'path', label: 'Robbed / chosen' }],
      varStates: { i: 'active', 'best[i]': 'active', 'h[i]': 'compare', skip: 'compare', rob: 'compare' }
    },
    lis: {
      label: 'Longest increasing subsequence', short: 'LIS', title: 'lis',
      code: {
        pseudo: [
          'function lis(a)',
          '  for i ← 0 to n − 1                           // @loop',
          '    len[i] ← 1; prev[i] ← none                 // @init',
          '    for j ← 0 to i − 1                         // @inner',
          '      if a[j] < a[i] and len[j] + 1 > len[i]   // @cmp',
          '        len[i] ← len[j] + 1; prev[i] ← j       // @take',
          '  return max(len)                              // @ret'
        ].join('\n'),
        js: [
          'function lis(a) {',
          '  const n = a.length, len = [], prev = [];',
          '  for (let i = 0; i < n; i++) {                    // @loop',
          '    len[i] = 1; prev[i] = -1;                      // @init',
          '    for (let j = 0; j < i; j++) {                  // @inner',
          '      if (a[j] < a[i] && len[j] + 1 > len[i]) {    // @cmp',
          '        len[i] = len[j] + 1; prev[i] = j;          // @take',
          '      }',
          '    }',
          '  }',
          '  return n ? Math.max(...len) : 0;                 // @ret',
          '}'
        ].join('\n'),
        py: [
          'def lis(a):',
          '    n = len(a)',
          '    length, prev = [1] * n, [-1] * n',
          '    for i in range(n):                              # @loop',
          '        length[i], prev[i] = 1, -1                  # @init',
          '        for j in range(i):                          # @inner',
          '            if a[j] < a[i] and length[j] + 1 > length[i]:  # @cmp',
          '                length[i], prev[i] = length[j] + 1, j      # @take',
          '    return max(length, default=0)                   # @ret'
        ].join('\n')
      },
      legend: [{ state: 'active', label: 'Index i' }, { state: 'compare', label: 'Smaller a[j] before it' }, { state: 'key', label: 'Best j' }, { state: 'visited', label: 'Filled' }, { state: 'path', label: 'The subsequence' }],
      varStates: { i: 'active', 'a[i]': 'active', 'len[i]': 'active', 'prev[i]': 'key' }
    }
  };
}());
