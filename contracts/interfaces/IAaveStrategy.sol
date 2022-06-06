//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct AaveCollateralToken {
    address token;
    address aToken;
}

interface IAaveStrategy {
	function stake(address _token, uint256 _amount) external;
    function unstake(address _token, address _aToken, uint256 _amount) external;
    function unstakeFull(address _token, address _aToken) external;
    function netAssetValue(address _aToken) external view returns (uint256);
    function liquidationValue(address _aToken) external view returns (uint256);
}