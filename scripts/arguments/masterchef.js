// npx hardhat verify --constructor-args arguments.js DEPLOYED_CONTRACT_ADDRESS
const { ethers } = require("hardhat");
const c = require('../constants/constants.json')

const ganapTokenAddress = c.ganapTokenAddress
const devAddress = c.devAddress
const treasuryAddress = c.devAddress
const ganapPerBlock = ethers.utils.parseEther(`${c.ganapPerBlock}`)
const startBlock = c.startBlock
module.exports = [
    ganapTokenAddress,
    devAddress,
    treasuryAddress,
    ganapPerBlock,
    startBlock
]