// npx hardhat verify --constructor-args scripts/arguments/timelock.js DEPLOYED_CONTRACT_ADDRESS
const { ethers } = require("hardhat");
require("dotenv").config();

const admin = process.env.DEPLOYER_ADDRESS
module.exports = [
    admin
]