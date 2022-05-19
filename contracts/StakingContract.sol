// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.0 (token/ERC20/extensions/ERC20Snapshot.sol)

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ArraysUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./interfaces/Balancer.sol";
import "./interfaces/BalancerGauge.sol";

struct ContractInfo {
  address contractCreator;
  address admin;
  uint256 depositFee;
  uint256 withdrawalFee;
  uint256 performanceFee;
  mapping(address => bool) allowedUsers;
}

struct BalancerInfo {
  bytes32 poolId;
  IAsset[] assets;
  address BPSP;
  address balancerGauge;
}

contract StakingContract is
  Initializable,
  ERC20Upgradeable,
  ReentrancyGuardUpgradeable,
  PausableUpgradeable
{
  using ArraysUpgradeable for uint256[];
  using SafeMathUpgradeable for uint256;
  using SafeERC20Upgradeable for IERC20Upgradeable;

  uint256 constant MAX_INT = 115792089237316195423570985008687907853269984665640564039457584007913129639935;

  // USDC token address
  address internal constant USDC = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174;  
  // DAI token address
  address internal constant DAI = 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063;
  // USDT token address
  address internal constant USDT = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F;
  // MAI token address
  address internal constant MAI = 0xa3Fa99A148fA48D14Ed51d610c367C61876997F1;
  // BAL token address
  address internal constant BAL = 0x9a71012B13CA4d3D0Cdc72A177DF3ef03b0E76A3;
  // balancer address
  address internal constant BALANCER = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
  
  ContractInfo internal contractInfo;
  BalancerInfo internal balancerInfo;

  constructor(
    uint256 _depositFee,
    uint256 _withdrawalFee,
    uint256 _performanceFee,
    bytes32 _poolId,
    address _BPSP,
    address _balancerGauge
  ) {
    contractInfo.contractCreator = msg.sender;
    contractInfo.admin = msg.sender;
    contractInfo.depositFee = _depositFee;
    contractInfo.withdrawalFee = _withdrawalFee;
    contractInfo.performanceFee = _performanceFee;

    balancerInfo.poolId = _poolId;
    balancerInfo.BPSP = _BPSP;
    balancerInfo.balancerGauge = _balancerGauge;
    balancerInfo.assets = [
      IAsset(USDC),
      IAsset(DAI),
      IAsset(MAI),
      IAsset(USDT)
    ];

    approveAllowanceForBalancerInternally();
  }

  /**********
  * Modifiers
  ***********/
  modifier onlyAdmin() {
    require(msg.sender == contractInfo.admin, "onlyAdmin: not allowed");
    _;
  }
  modifier onlyAllowed() {
    require(msg.sender == contractInfo.admin || contractInfo.allowedUsers[msg.sender], "onlyAdmin: not allowed");
    _;
  }

  /********************
  * Getters and Setters
  *********************/
  function getContractCreator() public view returns (address) {
    return contractInfo.contractCreator;
  }

  function getAdmin() public view returns (address) {
    return contractInfo.admin;
  }

  function setAdmin(address newAdmin) public onlyAdmin {
    contractInfo.admin = newAdmin;
  }

  function getDepositFee() public view returns (uint256) {
    return contractInfo.depositFee;
  }

  function setDepositFee(uint256 newFee) public onlyAdmin {
    contractInfo.depositFee = newFee;
  }

  function getWithdrawalFee() public view returns (uint256) {
    return contractInfo.withdrawalFee;
  }

  function setWithdrawalFee(uint256 newFee) public onlyAdmin {
    contractInfo.withdrawalFee = newFee;
  }

  function getPerformanceFee() public view returns (uint256) {
    return contractInfo.performanceFee;
  }

  function setPerformanceFee(uint256 newFee) public onlyAdmin {
    contractInfo.performanceFee = newFee;
  }

  function setAllowed(address _user, bool _approval) public onlyAdmin {
    contractInfo.allowedUsers[_user] = _approval;
  }

  function isAllowed(address _user) public view returns (bool) {
    bool _isAllowed = contractInfo.allowedUsers[_user];
    return _isAllowed;
  }

  function approveAllowanceForBalancerInternally() internal {
    //approve balancer to take DAI
    IERC20Upgradeable(DAI).approve(BALANCER, MAX_INT);
    
    //approve balancer to take USDC
    IERC20Upgradeable(USDC).approve(BALANCER, MAX_INT);

    //approve balancer to take USDT
    IERC20Upgradeable(USDT).approve(BALANCER, MAX_INT);

    //approve balancer to take Mai
    IERC20Upgradeable(MAI).approve(BALANCER, MAX_INT);

    //approve balancer to take Bal
    IERC20Upgradeable(BAL).approve(BALANCER, MAX_INT);

    //approve balancer to take BPSP
    IERC20Upgradeable(balancerInfo.BPSP).approve(BALANCER, MAX_INT);

    // approve balancer gauge to take BPSP
    IERC20Upgradeable(balancerInfo.BPSP).approve(balancerInfo.balancerGauge, MAX_INT);

  }

  function setAllowanceApproval() public onlyAdmin {
    approveAllowanceForBalancerInternally();
  }

  function joinDAIPoolInternal(uint256 _amount) internal {
    // mapping of IAssets[] from balancerInfo.assets
    uint256[] memory amountsIn = new uint256[](4);
    amountsIn[1] = _amount; // dai 

    bytes memory userDataEncoded = abi.encode(1, amountsIn, 0);

    JoinPoolRequest memory request;
    request.assets = balancerInfo.assets;
    request.maxAmountsIn = amountsIn;
    request.userData = userDataEncoded;
    request.fromInternalBalance = false;

    // join pool, this will give us receipt token (BPSP)
    Balancer(BALANCER).joinPool(balancerInfo.poolId, address(this), address(this), request);

    // once we got the BPSP token, stake BPSP token on balancer gauge
    uint256 bpspBalance = IERC20Upgradeable(balancerInfo.BPSP).balanceOf(address(this));
    BalancerGauge(balancerInfo.balancerGauge).deposit(bpspBalance);
  }

  function joinDAIPool(uint256 _amount) public onlyAllowed {
    joinDAIPoolInternal(_amount);
  }

  function leaveDAIPoolExactAmountInternal(uint256 _amount) internal {
    BalancerGauge(balancerInfo.balancerGauge).withdraw(_amount);

    uint256[] memory amountsOut = new uint256[](4);
    amountsOut[1] = _amount;

    bytes memory userDataEncoded = abi.encode(2, amountsOut, IERC20Upgradeable(balancerInfo.BPSP).balanceOf(address(this)));

    ExitPoolRequest memory request;
    request.assets = balancerInfo.assets;
    request.minAmountsOut = amountsOut;
    request.userData = userDataEncoded;
    request.toInternalBalance = false;

    // exit exact amount
    Balancer(BALANCER).exitPool(balancerInfo.poolId, address(this), payable(address(this)), request);

    // redeposit to gauge if there are BPSP left
    uint256 bpspBalance = IERC20Upgradeable(balancerInfo.BPSP).balanceOf(address(this));
    BalancerGauge(balancerInfo.balancerGauge).deposit(bpspBalance);
  }

  function leaveDAIPool(uint256 _amount) public onlyAllowed {
    leaveDAIPoolExactAmountInternal(_amount);
  }

  function claimGaugeRewards() public onlyAllowed {
    BalancerGauge(balancerInfo.balancerGauge).claim_rewards();
  }

  function claimableBalancerReward(address _addr, address _token) public view returns(uint256) {
    uint256 amount = BalancerGauge(balancerInfo.balancerGauge).claimable_reward(_addr, _token);
    return amount;
  }

  // for dev purposes only retain or remove
  function withdrawERC20(address _token, uint256 _amount) public onlyAllowed
  {
    IERC20Upgradeable(_token).transfer(contractInfo.admin, _amount);
  }

}
