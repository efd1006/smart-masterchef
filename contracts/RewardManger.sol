// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract RewardManager is Ownable {
	address public operator;
	address public masterchef;
	address public multisig;

	uint256 constant MAX_INT = 115792089237316195423570985008687907853269984665640564039457584007913129639935;

	constructor(address _masterchef, address _multisig) {
		operator = msg.sender;
		masterchef = _masterchef;
		multisig = _multisig;
	}

	modifier onlyOperator() {
		require(msg.sender == operator, "onlyOperator: not allowed");
		_;
	}

	modifier onlyAllowed() {
		require(msg.sender == owner() || msg.sender == operator, "onlyAllowed: not allowed");
		_;
	}

	modifier onlyMultisig() {
		require(msg.sender == multisig, "onlyMultisig: not allowed");
		_;
	}

	function setOperator(address _newOperator) public onlyAllowed {
		operator = _newOperator;
	}

	function setMasterchef(address _newMasterchef) public onlyAllowed {
		masterchef = _newMasterchef;
	}

	function setApproval(address _token) public onlyAllowed {
		_setApproval(_token);
	}

	function _setApproval(address _token) internal {
		// approve masterchef to take our token
		IERC20(_token).approve(masterchef, MAX_INT);
	}

	function setMultisig(address _newMultisig) public onlyAllowed {
		multisig = _newMultisig;
	}

	function withdrawERC20(
		address _token,
		uint256 _amount
	) public onlyMultisig {
		IERC20(_token).transfer(multisig, _amount);
	}
}
