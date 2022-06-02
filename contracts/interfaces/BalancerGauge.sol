//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface BalancerGauge{
    function deposit(uint256 _amount) external;
    function withdraw(uint256 rawAmount) external;
    function claim_rewards() external;
    function claimable_reward(address _addr, address _token) external view returns(uint256);
}