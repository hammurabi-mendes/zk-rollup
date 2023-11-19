import fs from 'fs'
import { ethers } from 'ethers'

// If you create a project on Infura, change below to your project ID
// You can also change the network identifier between testnest <-> mainnet
export function getProviderInfura() {
	const provider = new ethers.InfuraProvider("homestead", 'fc0ce324e349457ba615cbaba69ef5a1')

	return provider
}

export function getProvider(location) {
	const provider = new ethers.JsonRpcProvider(location)

	return provider
}

export function getSignerEmbedded(provider, index) {
	return provider.getSigner(index)
}

export function getSigner(provider, mnemonic) {
	return new ethers.Wallet.fromMnemonic(mnemonic)
}

export function readJSON(jsonFilename) {
	var jsonContents = fs.readFileSync(jsonFilename, 'utf-8')

	return JSON.parse(jsonContents)
}

export function getContractFactory(jsonFilename, signer) {
	var jsonContents = fs.readFileSync(jsonFilename, 'utf-8')

	return ethers.ContractFactory.fromSolidity(jsonContents, signer)
}

// ABI can be obtained from compiled JSON or from contractABI.mjs in human-readable form
// Bytecode can be obtained from compiled JSON
export function getContractFactory2(contractAbi, contractBytecode, signer) {
	return new ethers.ContractFactory(contractAbi, contractBytecode, signer)	
}

export async function deployContract(contractFactory, ...args) {
	var contract = await contractFactory.deploy(...args)

	// Wait until the contract is mined
	await contract.deployTransaction.wait()

	return contract
}

export function getContract(provider, address, contractInterface) {
	return new ethers.Contract(address, contractInterface, provider)
}