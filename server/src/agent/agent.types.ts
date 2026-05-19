/**
 * Interfaces for the structured market output from Claude.
 */
export interface StructuredMarket {
  question: string;
  resolutionCriteria: string;
  resolutionDeadline: string; // ISO8601
  oracleTier: 1 | 2;
  pYes: number;
  confidence: number;
  sourceLanguage: string;
  sourceName: string;
  settlementToken: 'USDC' | 'EURC';
  vertical: 'central-bank' | 'fx-direction' | 'trade-policy';
}

export interface DeploymentDecision {
  deploy: boolean;
  reason: string;
  stakeAmount: number; // USDC (6 decimals)
  stakeSide: 'YES' | 'NO';
  bParam: string; // LMSR b parameter (18 decimals as string)
  collateral: string; // contract address
  redeemUsyc: boolean;
  redeemAmount: number;
}
