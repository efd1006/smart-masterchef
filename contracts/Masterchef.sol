// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Ganap.sol";

import 'hardhat/console.sol';

contract MasterChef is Ownable, ReentrancyGuard {
	using SafeERC20 for IERC20;

	// Info of each user.
	struct UserInfo {
		uint256 amount; // How many LP tokens the user has provided.
		uint256 rewardDebt; // Reward debt. See explanation below.
		//
		// We do some fancy math here. Basically, any point in time, the amount of Ganap
		// entitled to a user but is pending to be distributed is:
		//
		//   pending reward = (user.amount * pool.ganapPerShare) - user.rewardDebt
		//
		// Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
		//   1. The pool's `ganapPerShare` (and `lastRewardBlock`) gets updated.
		//   2. User receives the pending reward sent to his/her address.
		//   3. User's `amount` gets updated.
		//   4. User's `rewardDebt` gets updated.
	}

	// Info of each pool.
	struct PoolInfo {
		IERC20 lpToken; // Address of LP token contract.
		uint256 allocPoint; // How many allocation points assigned to this pool. Ganap to distribute per block.
		uint256 lastRewardBlock; // Last block number that ganap distribution occurs.
		uint256 accGanapPerShare; // Accumulated ganap per share, times 1e12. See below.
		uint16 depositFeeBP; // Deposit fee in basis points
	}

	// The Ganap TOKEN!
	Ganap public ganap;
	// Dev address.
	address public devAddress;
	// Deposit/Withdraw Fee address
	address public treasuryAddress;
	// Ganap tokens created per block.
	uint256 public ganapPerBlock;

	// Deposit Fee MAX CAP
	uint16 DEPOSIT_FEE_CAP = 400; // 400 -> 4%

	// Info of each pool.
	PoolInfo[] public poolInfo;
	// Exist a pool with that token?
	mapping(IERC20 => bool) public poolExistence;
	// Info of each user that stakes LP tokens.
	mapping(uint256 => mapping(address => UserInfo)) public userInfo;
	// Total allocation points. Must be the sum of all allocation points in all pools.
	uint256 public totalAllocPoint;
	// The block number when Ganap mining starts.
	uint256 public startBlock;

	/*****************
        MODIFIERS
    *****************/
	modifier nonDuplicated(IERC20 _lpToken) {
		require(!poolExistence[_lpToken], "MasterChef: nonDuplicated: duplicated token");
		_;
	}

	/*****************
        EVENTS
    *****************/
	event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
	event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
	event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
	event SetTreasuryAddress(address indexed user, address indexed newAddress);
	event SetDevAddress(address indexed user, address indexed newAddress);

	constructor(
		Ganap _ganap,
		address _devAddress,
		address _treasuryAddress,
		uint256 _ganapPerBlock,
		uint256 _startBlock
	) {
		ganap = _ganap;
		devAddress = _devAddress;
		treasuryAddress = _treasuryAddress;
		ganapPerBlock = _ganapPerBlock;
		// ganapPerBlock = ((5 * (10**ganap.decimals())) / 100); // 0.05 Ganap per block
		startBlock = _startBlock;
		// startBlock = block.number + 43200; // start block 1 days after deploy, initial date.. might change
	}

	function poolLength() external view returns (uint256) {
		return poolInfo.length;
	}

	// Add a new lp to the pool. Can only be called by the owner.
	function add(
		uint256 _allocPoint,
		IERC20 _lpToken,
		uint16 _depositFeeBP,
		bool _withUpdate
	) public onlyOwner nonDuplicated(_lpToken) {
		require(_depositFeeBP <= DEPOSIT_FEE_CAP, "MasterChef: Add: Invalid deposit fee basis points, must be [0-400]"); //deposit Fee capped at 400 -> 4%
		if (_withUpdate) {
			massUpdatePools();
		}
		uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
		totalAllocPoint += _allocPoint;
		poolExistence[_lpToken] = true;
		poolInfo.push(PoolInfo({ lpToken: _lpToken, allocPoint: _allocPoint, lastRewardBlock: lastRewardBlock, accGanapPerShare: 0, depositFeeBP: _depositFeeBP }));
	}

	// Update the given pool's Ganap allocation point and deposit fee. Can only be called by the owner.
	function set(
		uint256 _pid,
		uint256 _allocPoint,
		uint16 _depositFeeBP,
		bool _withUpdate
	) public onlyOwner {
		require(_depositFeeBP <= DEPOSIT_FEE_CAP, "MasterChef: Set: Invalid deposit fee basis points, must be [0-400]"); //deposit Fee capped at 400 -> 4%
		if (_withUpdate) {
			massUpdatePools();
		}
		totalAllocPoint = ((totalAllocPoint + _allocPoint) - poolInfo[_pid].allocPoint);
		poolInfo[_pid].allocPoint = _allocPoint;
		poolInfo[_pid].depositFeeBP = _depositFeeBP;
	}

	// Return reward multiplier over the given _from to _to block.
	function getMultiplier(uint256 _from, uint256 _to) public pure returns (uint256) {
		return _to - _from;
	}

	// View function to see pending reward on frontend.
	function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
		PoolInfo storage pool = poolInfo[_pid];
		UserInfo storage user = userInfo[_pid][_user];
		uint256 accGanapPerShare = pool.accGanapPerShare;
		uint256 lpSupply = pool.lpToken.balanceOf(address(this));
		if (block.number > pool.lastRewardBlock && lpSupply != 0) {
			uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
			uint256 ganapReward = ((multiplier * ganapPerBlock * pool.allocPoint) / totalAllocPoint);
			accGanapPerShare += ((ganapReward * 1e12) / lpSupply);
		}
		return (((user.amount * accGanapPerShare) / 1e12) - user.rewardDebt);
	}

	// Update reward variables for all pools. Be careful of gas spending!
	function massUpdatePools() public {
		for (uint256 pid = 0; pid < poolInfo.length; ++pid) {
			updatePool(pid);
		}
	}

	// Update reward variables of the given pool to be up-to-date.
	function updatePool(uint256 _pid) public {
		PoolInfo storage pool = poolInfo[_pid];
		if (block.number <= pool.lastRewardBlock) {
			return;
		}
		uint256 lpSupply = pool.lpToken.balanceOf(address(this));
		if (lpSupply == 0 || pool.allocPoint == 0) {
			pool.lastRewardBlock = block.number;
			return;
		}
		uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
		uint256 ganapReward = ((multiplier * ganapPerBlock * pool.allocPoint) / totalAllocPoint);
		ganap.mint(devAddress, ganapReward / 10);
		ganap.mint(address(this), ganapReward);
		pool.accGanapPerShare += ((ganapReward * 1e12) / lpSupply);
		pool.lastRewardBlock = block.number;
	}

	// Deposit LP tokens to MasterChef for Ganap allocation.
	function deposit(uint256 _pid, uint256 _amount) public nonReentrant {
		PoolInfo storage pool = poolInfo[_pid];
		UserInfo storage user = userInfo[_pid][_msgSender()];
		updatePool(_pid);
		if (user.amount > 0) {
			uint256 pending = (((user.amount * pool.accGanapPerShare) / 1e12) - user.rewardDebt);
			if (pending > 0) {
				safeGanapTransfer(_msgSender(), pending);
			}
		}
		if (_amount > 0) {
			pool.lpToken.safeTransferFrom(_msgSender(), address(this), _amount);
			if (pool.depositFeeBP > 0) {
				uint256 depositFee = ((_amount * pool.depositFeeBP) / 10000);
				pool.lpToken.safeTransfer(treasuryAddress, depositFee);
				user.amount = (user.amount + _amount) - depositFee;
			} else {
				user.amount += _amount;
			}
		}
		user.rewardDebt = ((user.amount * pool.accGanapPerShare) / 1e12);
		emit Deposit(_msgSender(), _pid, _amount);
	}

	// Withdraw LP tokens from MasterChef.
	function withdraw(uint256 _pid, uint256 _amount) public nonReentrant {
		PoolInfo storage pool = poolInfo[_pid];
		UserInfo storage user = userInfo[_pid][_msgSender()];
		require(user.amount >= _amount, "MasterChef: Withdraw: not enough to withdraw");
		updatePool(_pid);
		uint256 pending = (((user.amount * pool.accGanapPerShare) / 1e12) - user.rewardDebt);
		if (pending > 0) {
			safeGanapTransfer(_msgSender(), pending);
		}
		if (_amount > 0) {
			user.amount -= _amount;
			pool.lpToken.safeTransfer(_msgSender(), _amount);
		}
		user.rewardDebt = ((user.amount * pool.accGanapPerShare) / 1e12);
		emit Withdraw(_msgSender(), _pid, _amount);
	}

	// Withdraw without caring about rewards. EMERGENCY ONLY.
	function emergencyWithdraw(uint256 _pid) public nonReentrant {
		PoolInfo storage pool = poolInfo[_pid];
		UserInfo storage user = userInfo[_pid][_msgSender()];
		uint256 amount = user.amount;
		user.amount = 0;
		user.rewardDebt = 0;
		pool.lpToken.safeTransfer(_msgSender(), amount);
		emit EmergencyWithdraw(_msgSender(), _pid, amount);
	}

	// Update dev address by the previous dev.
	function setDevAddress(address _devAddress) public {
		require(_msgSender() == devAddress, "MasterChef: setDevAddress: Only dev can set");
		devAddress = _devAddress;
		emit SetDevAddress(_msgSender(), _devAddress);
	}

	function setTreasuryAddress(address _treasuryAddress) public {
		require(_msgSender() == devAddress, "MasterChef: setTreasuryAddress: Only dev can set");
		treasuryAddress = _treasuryAddress;
		emit SetTreasuryAddress(_msgSender(), _treasuryAddress);
	}

	// Only update before start of farm
	function updateStartBlock(uint256 _startBlock) public onlyOwner {
		require(_startBlock > block.number, "MasterChef: updateStartBlock: No timetravel allowed!");
		startBlock = _startBlock;
	}

	// Safe Ganap transfer function, just in case if rounding error causes pool to not have enough Ganap.
	function safeGanapTransfer(address _to, uint256 _amount) internal {
		uint256 ganapBal = ganap.balanceOf(address(this));
		bool transferSuccess = _amount > ganapBal ? ganap.transfer(_to, ganapBal) : ganap.transfer(_to, _amount);
		require(transferSuccess, "MasterChef: safeGanapTransfer: transfer failed");
	}
}
