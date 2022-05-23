// npx hardhat verify --constructor-args scripts/arguments/1.ganap.js DEPLOYED_CONTRACT_ADDRESS
const { ethers } = require("hardhat");
const c = require('../constants/constants.json')

const initialTokenSupply = ethers.utils.parseEther(`${c.initialTokenSupply}`);

module.exports = [
    initialTokenSupply
]