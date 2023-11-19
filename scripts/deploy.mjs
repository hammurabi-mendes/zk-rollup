import * as ethers from 'ethers'

import * as blockchainInterface from '../blockchainInterface.mjs'

const PROVIDER = "http://127.0.0.1:8545/"

// Deploy contracts

// JSON RPC endpoint of a node
let provider = blockchainInterface.getProvider(PROVIDER)

let wallet = await provider.getSigner(0)
// The second parameter immediately connects the wallet to provider
// let wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider)
// No second parameter accepted, so connect to provider manually
// let wallet = new ethers.Wallet.fromMnemonic("word1 word2 ...")

let contractJson
let receipt

contractJson = blockchainInterface.readJSON("Poseidon2.json")
let Hasher2 = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet)
let hasher2 = await Hasher2.deploy()
// Wait until the transaction is mined and gets the receipt
receipt  = await hasher2.deploymentTransaction().wait()
console.log(receipt)

contractJson = blockchainInterface.readJSON("Poseidon3.json")
let Hasher3 = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet)
let hasher3 = await Hasher3.deploy()
// Wait until the transaction is mined and gets the receipt
receipt  = await hasher3.deploymentTransaction().wait()
console.log(receipt)

contractJson = blockchainInterface.readJSON("./artifacts/contracts/TestToken.sol/TestToken.json")
let TestToken = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet)
let testToken = await TestToken.deploy()
// Wait until the transaction is mined and gets the receipt
receipt  = await testToken.deploymentTransaction().wait()
console.log(receipt)

contractJson = blockchainInterface.readJSON("./artifacts/contracts/Rollup.sol/Rollup.json")
let Rollup = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet)
let rollup = await Rollup.deploy(await testToken.getAddress(), await hasher2.getAddress(), await hasher3.getAddress())
// Wait until the transaction is mined and gets the receipt
receipt  = await rollup.deploymentTransaction().wait()
console.log(receipt)

console.log("const TEST_TOKEN_ADDRESS = \"" + await testToken.getAddress() + "\";")
console.log("const ROLLUP_ADDRESS = \"" + await rollup.getAddress() + "\";")