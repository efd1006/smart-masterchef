// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../interfaces/aave/v2/ILendingPoolAddressesProvider.sol";
import "../interfaces/aave/v2/ILendingPool.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract AaveStrategy is Initializable {
	IERC20 public usdcToken;
	IERC20 public aUsdcToken;

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

	function setTokens(address _usdcToken, address _aUsdcToken) external onlyAdmin {
		require(_usdcToken != address(0), "Zero address not allowed");
		require(_aUsdcToken != address(0), "Zero address not allowed");
		usdcToken = IERC20(_usdcToken);
		aUsdcToken = IERC20(_aUsdcToken);
	}

	function setAaveProvider(address _aaveProvider) external onlyAdmin {
		require(_aaveProvider != address(0), "Zero address not allowed");
		aaveProvider = ILendingPoolAddressesProvider(_aaveProvider);
	}

	function stake(address _asset, uint256 _amount) public onlyOperatorOrAdmin {
		require(_asset == address(usdcToken), "token not compatible");

        IERC20(_asset).transferFrom(vault, address(this), _amount);

		ILendingPool pool = ILendingPool(aaveProvider.getLendingPool());
		usdcToken.approve(address(pool), _amount);

		pool.deposit(address(usdcToken), _amount, address(this), 0);
	}

	function unstake(
		address _asset,
		uint256 _amount
	) public onlyOperatorOrAdmin {
		require(_asset == address(usdcToken), "token not compatible");

		ILendingPool pool = ILendingPool(aaveProvider.getLendingPool());
		aUsdcToken.approve(address(pool), _amount);

		pool.withdraw(_asset, _amount, vault);
	}

	function unstakeFull(address _asset) public onlyOperatorOrAdmin {
		require(_asset == address(usdcToken), "token not compatible");

		uint256 _amount = aUsdcToken.balanceOf(address(this));

		ILendingPool pool = ILendingPool(aaveProvider.getLendingPool());
		aUsdcToken.approve(address(pool), _amount);

		pool.withdraw(_asset, _amount, vault);
	}

	function netAssetValue() external view returns (uint256) {
		return aUsdcToken.balanceOf(address(this));
	}

	function liquidationValue() external view returns (uint256) {
		return aUsdcToken.balanceOf(address(this));
	}
}
