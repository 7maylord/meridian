/**
 * ABI fragments for Meridian contracts — only the functions we call.
 */

export const MERIDIAN_MARKET_ABI = [
  'function createMarket(string question, string resolutionCriteria, uint256 expiry, uint256 initialB, address collateral) external returns (uint256)',
  'function marketCount() external view returns (uint256)',
  'function oracle() external view returns (address)',
  'function supportedCollateral(address) external view returns (bool)',
  'function collateralDecimals(address) external view returns (uint8)',
  'function yesBalances(uint256, address) external view returns (uint256)',
  'function noBalances(uint256, address) external view returns (uint256)',
  'function getCost(uint256 marketId, bool isYes, uint256 shares) external view returns (uint256)',
  'function getCostInternal(uint256 marketId, bool isYes, uint256 shares) external view returns (uint256)',
  'function buy(uint256 marketId, bool isYes, uint256 shares) external',
  'function resolve(uint256 marketId, bool outcome) external',
  'function claim(uint256 marketId) external',
  'function getMarket(uint256 marketId) external view returns (string question, string resolutionCriteria, address collateralToken, uint256 qYes, uint256 qNo, uint256 expiry, bool isResolved, bool outcome, address creator, uint256 totalCollateral)',
  'function getUserPosition(uint256 marketId, address user) external view returns (uint256 yesShares, uint256 noShares)',
  'function getPrice(uint256 marketId) external view returns (uint256 yesPrice, uint256 noPrice)',
];

export const PREDICTION_MARKET_ABI = MERIDIAN_MARKET_ABI; // Keep alias to avoid breakage if referenced elsewhere

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
  'function deployCapital(uint256 marketId, bool isYes, uint256 shares) external',
  'function claimWinnings(uint256 marketId) external',
  'function depositToUsyc(uint256 amount) external',
  'function redeemFromUsyc(uint256 amount) external',
];

export const RESOLUTION_ORACLE_ABI = [
  'function configureOracle(uint256 marketId, uint8 tier, address feedAddress, uint8 comparison, int256 threshold, uint256 expiry) external',
  'function resolveFromFeed(uint256 marketId) external',
  'function resolveAdmin(uint256 marketId, bool outcome) external',
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
