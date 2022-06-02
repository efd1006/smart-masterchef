// npx hardhat verify --constructor-args scripts/arguments/3.reward-manager.js DEPLOYED_CONTRACT_ADDRESS
const { ethers } = require("hardhat");
const c = require('../constants/constants.json')

const masterchefAddress = c.masterchefAddress
const multisigAddress = c.multisigAddress

module.exports = [
    masterchefAddress,
    multisigAddress
]