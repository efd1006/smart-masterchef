// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../interfaces/aave/v2/ILendingPoolAddressesProvider.sol";
import "../interfaces/aave/v2/ILendingPool.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract AaveStrategy is Initializable {

	ILendingPoolAddressesProvider public aaveProvider;

	address public admin;
	address public operator;

	address public vault; // smart contract address that holds all the funds

	// ---  constructor
	function initialize(address _admin, address _operator, address _vault) public initializer {
		admin = _admin;
		operator = _operator;
		vault = _vault;
	}

	// modifiers
	modifier onlyAdmin() {
		require(msg.sender == admin, "onlyAdmin: not allowed");
		_;
	}

	modifier onlyOperator() {
		require(msg.sender == operator || msg.sender == admin, "onlyOperator: not allowed");
		_;
	}

	modifier onlyOperatorOrAdmin {
		require(msg.sender == operator || msg.sender == admin);
		_;
	}
	
	// --- Setters

	function setAdmin(address _newAdmin) public onlyAdmin {
		admin = _newAdmin;
	}

	function setOperator(address _newOperator) public onlyAdmin {
		operator = _newOperator;
	}


	function setVault (address _newVault) public onlyAdmin {
		vault = _newVault;
	}

	// logic

	function setAaveProvider(address _aaveProvider) external onlyAdmin {
		require(_aaveProvider != address(0), "Zero address not allowed");
		aaveProvider = ILendingPoolAddressesProvider(_aaveProvider);
	}

	function stake(address _token, uint256 _amount) public onlyOperatorOrAdmin {

        IERC20(_token).transferFrom(vault, address(this), _amount);

		ILendingPool pool = ILendingPool(aaveProvider.getLendingPool());
		IERC20(_token).approve(address(pool), _amount);

		pool.deposit(address(_token), _amount, address(this), 0);
	}

	function unstake(
		address _token,
		address _aToken,
		uint256 _amount
	) public onlyOperatorOrAdmin {

		ILendingPool pool = ILendingPool(aaveProvider.getLendingPool());
		IERC20(_aToken).approve(address(pool), _amount);

		pool.withdraw(_token, _amount, vault);
	}

	function unstakeFull(address _token, address _aToken) public onlyOperatorOrAdmin {

		uint256 _amount = IERC20(_aToken).balanceOf(address(this));

		ILendingPool pool = ILendingPool(aaveProvider.getLendingPool());
		IERC20(_aToken).approve(address(pool), _amount);

		pool.withdraw(_token, _amount, vault);
	}

	function netAssetValue(address _aToken) external view returns (uint256) {
		return IERC20(_aToken).balanceOf(address(this));
	}

	function liquidationValue(address _aToken) external view returns (uint256) {
		return IERC20(_aToken).balanceOf(address(this));
	}
}
