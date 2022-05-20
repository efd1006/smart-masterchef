// npx hardhat verify --constructor-args arguments.js DEPLOYED_CONTRACT_ADDRESS
const { ethers } = require("hardhat");
const c = require('../constants/constants.json')

const initialTokenSupply = ethers.utils.parseEther(`${c.initialTokenSupply}`);

module.exports = [
    initialTokenSupply
]