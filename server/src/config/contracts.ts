/**
 * ABI fragments for Meridian contracts — only the functions we call.
 */

export const MARKET_FACTORY_ABI = [
  'function createMarket(string question, string resolutionCriteria, uint256 expiry, uint256 initialB, address collateral) external returns (address)',
  'function getMarkets() external view returns (address[])',
  'function getMarketCount() external view returns (uint256)',
  'function isMarket(address) external view returns (bool)',
  'function oracle() external view returns (address)',
  'function supportedCollateral(address) external view returns (bool)',
];

export const PREDICTION_MARKET_ABI = [
  'function question() external view returns (string)',
  'function collateralToken() external view returns (address)',
  'function collateralDecimals() external view returns (uint8)',
  'function b() external view returns (uint256)',
  'function qYes() external view returns (uint256)',
  'function qNo() external view returns (uint256)',
  'function isResolved() external view returns (bool)',
  'function outcome() external view returns (bool)',
  'function oracle() external view returns (address)',
  'function getCost(bool isYes, uint256 shares) external view returns (uint256)',
  'function getCostInternal(bool isYes, uint256 shares) external view returns (uint256)',
  'function buy(bool isYes, uint256 shares) external',
  'function resolve(bool outcome) external',
  'function claim() external',
];

export const AGENT_VAULT_ABI = [
  'function collateralToken() external view returns (address)',
  'function agent() external view returns (address)',
  'function totalDeployed() external view returns (uint256)',
  'function totalReturned() external view returns (uint256)',
  'function marketsWon() external view returns (uint256)',
  'function marketsLost() external view returns (uint256)',
  'function getAvailableCapital() external view returns (uint256)',
  'function getUsycBalance() external view returns (uint256)',
  'function getCalibrationScore() external view returns (uint256 winRate, uint256 totalMarkets)',
  'function deployCapital(address market, uint256 amount, bool isYes) external',
  'function recordOutcome(address market, bool won, uint256 payout) external',
  'function depositToUsyc(uint256 amount) external',
  'function redeemFromUsyc(uint256 amount) external',
];

export const RESOLUTION_ORACLE_ABI = [
  'function configureOracle(address market, uint8 tier, address feedAddress, uint8 comparison, int256 threshold, uint256 expiry) external',
  'function resolveFromFeed(address market) external',
  'function resolveAdmin(address market, bool outcome) external',
  'function setVerifier(address verifier, bool authorized) external',
  'function verifiers(address) external view returns (bool)',
];

export const ERC20_ABI = [
  'function balanceOf(address) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
];
