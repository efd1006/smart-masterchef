// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./Ganap.sol";

contract MasterChef is Ownable, ReentrancyGuard {
	using SafeMath for uint256;
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
	// Ganap tokens created per second.
	uint256 public ganapPerSecond;

	// Deposit Fee MAX CAP
	uint16 DEPOSIT_FEE_CAP = 400; // 400 -> 4%

	// Max Allocation Point Cap
	uint256 public ALLOC_POINT_CAP = 4000;

	// Info of each pool.
	PoolInfo[] public poolInfo;
	// Exist a pool with that token?
	mapping(IERC20 => bool) public poolExistence;
	// Info of each user that stakes LP tokens.
	mapping(uint256 => mapping(address => UserInfo)) public userInfo;
	// Total allocation points. Must be the sum of all allocation points in all pools.
	uint256 public totalAllocPoint;
	// The block.timestamp when Ganap mining starts.
	uint256 public startTime;
	// The block.timestamp when Ganap mining ends.
	uint256 public endTime;

	// STAKING REWARD CONTRACT THAT HOLDS THE REWARD
	address public stakingRewardAddress;

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
		uint256 _ganapPerSecond,
		uint256 _startTime,
		uint256 _endTime,
		address _stakingRewardAddress
	) {
		ganap = _ganap;
		devAddress = _devAddress;
		treasuryAddress = _treasuryAddress;
		// 18 decimals
		ganapPerSecond = _ganapPerSecond;
		startTime = _startTime;
		endTime = _endTime;
		stakingRewardAddress = _stakingRewardAddress;
	}

	function setStakingRewardAddress(address _stakingRewardAddress) external onlyOwner {
		stakingRewardAddress = _stakingRewardAddress;
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
		require(_allocPoint <= ALLOC_POINT_CAP, "Masterchef: set: alloc point exceeds hte maximum cap");
		if (_withUpdate) {
			massUpdatePools();
		}
		uint256 lastRewardBlock = block.timestamp > startTime ? block.timestamp : startTime;
		totalAllocPoint = totalAllocPoint.add(_allocPoint);
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
		require(_allocPoint <= ALLOC_POINT_CAP, "Masterchef: set: alloc point exceeds hte maximum cap");
		if (_withUpdate) {
			massUpdatePools();
		}
		//totalAllocPoint = ((totalAllocPoint + _allocPoint) - poolInfo[_pid].allocPoint);
		totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
		poolInfo[_pid].allocPoint = _allocPoint;
		poolInfo[_pid].depositFeeBP = _depositFeeBP;
	}

	// Return reward multiplier over the given _from to _to timestamp.
	function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
		_from = _from > startTime ? _from : startTime;
		if (_to < startTime || _from >= endTime) {
			return 0;
		} else if (_to <= endTime) {
			return _to.sub(_from);
		} else {
			return endTime.sub(_from);
		}
	}

	// View function to see pending reward on frontend.
	function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
		PoolInfo storage pool = poolInfo[_pid];
		UserInfo storage user = userInfo[_pid][_user];
		uint256 accGanapPerShare = pool.accGanapPerShare;
		uint256 lpSupply = pool.lpToken.balanceOf(address(this));
		if (block.timestamp > pool.lastRewardBlock && lpSupply != 0) {
			uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.timestamp);
			uint256 ganapReward = multiplier.mul(ganapPerSecond).mul(pool.allocPoint).div(totalAllocPoint);
			accGanapPerShare = accGanapPerShare.add(ganapReward.mul(1e12).div(lpSupply));
		}
		return user.amount.mul(accGanapPerShare).div(1e12).sub(user.rewardDebt);
	}

	// get all the users pool balance deposits
	function poolBalances(address _user) external view returns (uint256[] memory) {
		uint256 length = poolInfo.length;
		uint256[] memory poolBalanceData = new uint256[](length);
		for (uint256 _pid = 0; _pid < length; ++_pid) {
			UserInfo storage user = userInfo[_pid][_user];
			poolBalanceData[_pid] = user.amount;
		}
		return poolBalanceData;
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
		if (block.timestamp <= pool.lastRewardBlock) {
			return;
		}
		uint256 lpSupply = pool.lpToken.balanceOf(address(this));
		if (lpSupply == 0) {
			pool.lastRewardBlock = block.timestamp;
			return;
		}
		uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.timestamp);
		uint256 ganapReward = multiplier.mul(ganapPerSecond).mul(pool.allocPoint).div(totalAllocPoint);
		// ganap.mint(devAddress, ganapReward / 10);
		// ganap.mint(address(this), ganapReward);
		pool.accGanapPerShare += ((ganapReward * 1e12) / lpSupply);
		pool.accGanapPerShare = pool.accGanapPerShare.add(ganapReward.mul(1e12).div(lpSupply));
		pool.lastRewardBlock = block.timestamp;
	}

	// Deposit LP tokens to MasterChef for Ganap allocation.
	function deposit(uint256 _pid, uint256 _amount) public nonReentrant {
		PoolInfo storage pool = poolInfo[_pid];
		UserInfo storage user = userInfo[_pid][_msgSender()];
		updatePool(_pid);

		if (user.amount > 0) {
			uint256 pending = user.amount.mul(pool.accGanapPerShare).div(1e12).sub(user.rewardDebt);
			if (pending > 0) {
				safeGanapTransfer(_msgSender(), pending);
			}
		}

		if (_amount > 0) {
			pool.lpToken.safeTransferFrom(_msgSender(), address(this), _amount);
			if (pool.depositFeeBP > 0) {
				uint256 depositFee = _amount.mul(pool.depositFeeBP).div(10000);
				pool.lpToken.safeTransfer(treasuryAddress, depositFee);
				user.amount = user.amount.add(_amount).sub(depositFee);
			} else {
				user.amount = user.amount.add(_amount);
			}
		}

		user.rewardDebt = user.amount.mul(pool.accGanapPerShare).div(1e12);
		emit Deposit(_msgSender(), _pid, _amount);
	}

	// Withdraw LP tokens from MasterChef.
	function withdraw(uint256 _pid, uint256 _amount) public nonReentrant {
		PoolInfo storage pool = poolInfo[_pid];
		UserInfo storage user = userInfo[_pid][_msgSender()];

		require(user.amount >= _amount, "MasterChef: Withdraw: not enough to withdraw");

		updatePool(_pid);

		uint256 pending = user.amount.mul(pool.accGanapPerShare).div(1e12).sub(user.rewardDebt);

		if (pending > 0) {
			safeGanapTransfer(_msgSender(), pending);
		}

		if (_amount > 0) {
			user.amount = user.amount.sub(_amount);
			pool.lpToken.safeTransfer(_msgSender(), _amount);
		}

		user.rewardDebt = user.amount.mul(pool.accGanapPerShare).div(1e12);
		emit Withdraw(_msgSender(), _pid, _amount);
	}

	// harvest all pending rewards on all pools
	function harvestAll() public {
		uint256 length = poolInfo.length;
		uint256 calc;
		uint256 pending;
		UserInfo storage user;
		PoolInfo storage pool;
		uint256 totalPending;
		for (uint256 pid = 0; pid < length; ++pid) {
			user = userInfo[pid][msg.sender];
			if (user.amount > 0) {
				pool = poolInfo[pid];
				updatePool(pid);

				calc = user.amount.mul(pool.accGanapPerShare).div(1e12);
				pending = calc.sub(user.rewardDebt);
				user.rewardDebt = calc;

				if (pending > 0) {
					totalPending += pending;
				}
			}
		}
		if (totalPending > 0) {
			safeGanapTransfer(msg.sender, totalPending);
		}
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
	function updatestartTime(uint256 _startTime) public onlyOwner {
		require(_startTime > block.timestamp, "MasterChef: updatestartTime: No timetravel allowed!");
		startTime = _startTime;
	}

	// Safe Ganap transfer function, reverts if staking reward doesn't have enough funds
	function safeGanapTransfer(address _to, uint256 _amount) internal {
		uint256 ganapBal = ganap.balanceOf(address(this));
		uint256 ganapAllowance = ganap.allowance(stakingRewardAddress, address(this));
		require(ganapBal >= _amount, "Insufficient funds.");
		require(ganapAllowance >= _amount, "Insufficient approval");
		ganap.transferFrom(stakingRewardAddress, address(this), _amount);
		ganap.transfer(_to, _amount);
	}

	function setStartTime(uint256 _newStartTime) external onlyOwner {
		require(startTime > block.timestamp, "Already started");
		require(_newStartTime > block.timestamp, "New time already passed");

		startTime = _newStartTime;
	}

	function setEndime(uint256 _newEndTime) external onlyOwner {
		require(endTime > block.timestamp, "Already ended");
		require(_newEndTime > block.timestamp, "New end time already passed");

		endTime = _newEndTime;
	}
}
