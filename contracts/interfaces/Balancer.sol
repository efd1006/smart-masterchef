//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAsset {
	//solhint-disable-previous-line no-empty-blocks
}

struct JoinPoolRequest {
  IAsset[] assets;
  uint256[] maxAmountsIn;
  bytes userData;
  bool fromInternalBalance;
}

struct ExitPoolRequest {
  IAsset[] assets;
  uint256[] minAmountsOut;
  bytes userData;
  bool toInternalBalance;
}

interface Balancer {
	function joinPool(
		bytes32 poolId,
		address sender,
		address recipient,
		JoinPoolRequest memory request
	) external payable;

	function exitPool(
		bytes32 poolId,
		address sender,
		address payable recipient,
		ExitPoolRequest memory request
	) external;
}