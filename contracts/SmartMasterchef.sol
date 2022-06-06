// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Masterchef.sol";
import "./Ganap.sol";
import "./strategies/AaveStrategy.sol";
import "./interfaces/IAaveStrategy.sol";

contract SmartMasterchef is Masterchef {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	// aave strategy
	address public aaveStrategy;

	// Array of supported aave token as collateral
	mapping(address => AaveCollateralToken) public aaveCollateralList;

	constructor(
		Ganap _ganap,
		address _devAddress,
		address _treasuryAddress,
		uint256 _ganapPerSecond,
		uint256 _startTime,
		uint256 _endTime,
		address _rewardManager
	) Masterchef(_ganap, _devAddress, _treasuryAddress, _ganapPerSecond, _startTime, _endTime, _rewardManager) {}

	function setAaveStrategy(address _newAaveStrategy) public onlyOwner {
		aaveStrategy = _newAaveStrategy;
	}

	function whitelistAaveCollateral(address _token, address _aToken) public onlyOwner {
		bool whitelisted = isAaveCollateralWhitelisted(_token);
		require(!whitelisted, "whitelistAaveCollateral: aave collateral token is already whitelisted.");
		aaveCollateralList[_token] = AaveCollateralToken(_token, _aToken);
	}

	function isAaveCollateralWhitelisted(address _token) internal view returns (bool) {
		if (aaveCollateralList[_token].token == _token) {
			return true;
		}
		return false;
	}

	// Deposit LP tokens to MasterChef for Ganap allocation.
	function deposit(uint256 _pid, uint256 _amount) public override nonReentrant {
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
			// stake to aave logic
			bool whitelisted = isAaveCollateralWhitelisted(address(pool.lpToken));
			if (whitelisted) {
				AaveCollateralToken memory aaveCollateralToken = aaveCollateralList[address(pool.lpToken)];
				IERC20(aaveCollateralToken.token).approve(aaveStrategy, user.amount);
				IAaveStrategy(aaveStrategy).stake(aaveCollateralToken.token, user.amount);
			}
		}

		user.rewardDebt = user.amount.mul(pool.accGanapPerShare).div(1e12);
		emit Deposit(_msgSender(), _pid, _amount);
	}

	// Withdraw LP tokens from MasterChef.
	function withdraw(uint256 _pid, uint256 _amount) public override nonReentrant {
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

			// insert aave unstake logic here
			bool whitelisted = isAaveCollateralWhitelisted(address(pool.lpToken));
			if (whitelisted) {
				AaveCollateralToken memory aaveCollateralToken = aaveCollateralList[address(pool.lpToken)];
				IERC20(aaveCollateralToken.token).approve(aaveStrategy, _amount);
				IAaveStrategy(aaveStrategy).unstake(aaveCollateralToken.token, aaveCollateralToken.aToken, _amount);
			}

			pool.lpToken.safeTransfer(_msgSender(), _amount);
		}

		user.rewardDebt = user.amount.mul(pool.accGanapPerShare).div(1e12);
		emit Withdraw(_msgSender(), _pid, _amount);
	}
}
