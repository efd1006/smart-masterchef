// npx hardhat verify --constructor-args scripts/arguments/2.masterchef.js DEPLOYED_CONTRACT_ADDRESS
const { ethers } = require("hardhat");
const c = require('../constants/constants.json')

const ganapTokenAddress = c.ganapTokenAddress
const devAddress = c.devAddress
const treasuryAddress = c.treasuryAddress
const ganapPerBlock = ethers.utils.parseEther(`${c.ganapPerBlock}`)
const startTime = c.startTime
const endTime = c.endTime
const rewardManagerAddress = c.rewardManagerAddress

module.exports = [
    ganapTokenAddress,
    devAddress,
    treasuryAddress,
    ganapPerBlock,
    startTime,
    endTime,
    rewardManagerAddress
]