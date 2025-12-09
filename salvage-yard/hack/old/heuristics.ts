/*
 * Estimates how many threads it takes to grow money
 * from 4% (default money in BitNode1) to 100%
 * if we assume the player has no bonuses to growth
 * 
 * Experimentally appears to be between 90% and 110%
 * of the true value
 * 
 * @param hackDifficulty - security just before grow() ends
 */
export function growThreads4to100(
  hackDifficulty: number,
  serverGrowth: number,
): number {
  return 10000 * Math.max(10, hackDifficulty) / serverGrowth
}