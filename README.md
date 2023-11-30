# A simple ZK-Rollup

This application is an example of a simple ZK-rollup application for Ethereum meant to help learner-practitioners of zero-knowledge applications. We use the [Circom](https://docs.circom.io/circom-language/signals/) and [SnarkJS](https://github.com/iden3/snarkjs).

 **DO NOT USE IT IN PRODUCTION**: the main goal here is to document the implementation with a **clean, well-organized code, meant for learning**, making the topic more **accessible to beginners**. In addition, the [scripts](scripts) subdirectory has useful scripts for the ZK-proof pipeline in Javascript (we only use two of them, but other useful tools are provided). If you need anything in production, do not use this code and do not "roll your own crypto": find another implementation, one that has been instead subject to auditing and written specifically for that purpose.

***NOTE***: I also published a meant-to-be-learned Javascript project for threshold signatures, blind signatures, ring signatures, KZG polynomial commitments, verifiable random functions (VRFs), etc in "[Learning Cryptography with Javascript](https://github.com/hammurabi-mendes/learn-crypto-javascript)".

## Support
- If you think this repository is useful, please consider supporting it here:
	- Bitcoin: ```bc1qwjunpsdhtsmcwt7m8enpwepgc6yngk82apeus3```
	- Ethereum: ```0xcFD3F755e853AD1C3568ebF74ce5619D743c9b17```
	- Dogecoin: ```DDHuFi8im3qF3ma3NhG87fx9uADQuLxHhV```
	- Solana: ```6tiWSNnWA4GXdAbbxMjXpfLGjpvqufi3zBjdV3vgcAXv```
	- Polkadot: ```13EnQE9BKT5Ys5woLxbmoouez8RExv8y5H9zDkyMjfdqxYdT```
	- Cardano: ```addr1q98njwcme5spxtayqax4vcmw3etku0367azujs4ry5dlhpq29zq6wh60s8j3s6jnzclhgfncewffj33eamdn5swav5xsqqsyg4```
	- Algorand: ```FNTPKB6TSAW626J3SJJFM4DIJ4XG2J6WU2NX2DIKOR4ZOUUZQKFRNKOGQA```
	- Tezos: ```tz1NuFTzK5Gq7ekCwdSV7NZrhaBVjdJgY5qg```
	- NEAR: ```681243cea225318e97b1dc06cf9d81912e163992f67b1b2697e29ffcd4123cec```

- I am considering implementing the Sumcheck, GKR, and Plonk protocols from scratch, with the same mindset of making the contents more accessible for beginners.

## Running the Example

### Install dependencies

We first install dependencies related to [Hardhat](https://hardhat.org/docs), the development environment we use here. We also install [Ethers](https://docs.ethers.org/v6/) to allow our Javascript ```index.mjs``` interact with the local blockchain created/executed by Hardhat. We install [circomlib](https://github.com/iden3/circomlib) to provide useful components to design circuits in the [circuits](circuits/) subdirectory. We also install [circomlibjs](https://github.com/iden3/circomlibjs) that provides matching functionality to be used within Javascript applications. Finally, we install [snarkjs](https://github.com/iden3/snarkjs) to allow us to generate proofs in Javascript and generate Solidity contracts using a circom description of our computation to be proved in zero-knowledge.
```
npm install
```

### Setup ZK

We need to generate our [trusted setup data](https://a16zcrypto.com/posts/article/on-chain-trusted-setup-ceremony/) and essentially follow the procedure described [here](https://github.com/iden3/snarkjs). A set of scripts in the [scripts](scripts/) directory makes that task simpler. You can easily change in the scripts the size of the trusted setup, the target curve, and the proof system (Groth16 or Plonk).

Generate the powers of tau (can take a while):
```
sh -x scripts/snark1-ptau.sh 
```

Compile the circuit using circom and generate the data used by the verifier to check the proof. This also generates subdirectories [BatchVerifier_js](BatchVerifier_js) and [WithdrawVerifier_js](WithdrawVerifier_js) along with a few executables that will allow the prover to generate the witness and the proof of knowledge for both circuits. Think of those, respectively, as the internal states of the computation using the inputs and as many polynomial commitments and verifications that attest that these internal states of computation must involve the right private and public inputs.
```
sh -x scripts/snark2-compile-genverification.sh BatchVerifier
```
and
```
sh -x scripts/snark2-compile-genverification.sh WithdrawVerifier
```

Generate the verifier contracts that will be deployed on chain. These contracts will do the mathematical verification in zero-knowledge of the claim that the prover has the private inputs that satisfy the computational condition (which also involve the public inputs).
```
# (from the top directory)
cd BatchVerifier_js
snarkjs zkey export solidityverifier batchverifier_final.zkey ../contracts/BatchVerifier.sol
```
and
```
# (from the top directory)
cd WithdrawVerifier_js
snarkjs zkey export solidityverifier withdrawverifier_final.zkey ../contracts/WithdrawVerifier.sol
```

Note: edit [contracts/BatchVerifier.sol](contracts/BatchVerifier.sol) and [contracts/WithdrawVerifier.sol](contracts/WithdrawVerifier.sol) and change the name of the contracts, respectively, to "BatchVerifier" and "WithdrawVerifier" (and not something like ```Groth16Verifier``` or ```PlonkVerifier```).

We need hashers that will calculate outputs deployed on chain. The libraries circomlib/circomlibjs allow us to generate many such Poseidon hashers.
```
node scripts/generateHasher.mjs
```

Compile contracts
```
npx hardhat compile
```

Launch the blockchain
```
npx hardhat node
```

Deploy the contracts
```
node scripts/deploy.mjs
```

Run the example
```
node index.mjs
```

## License and Closing Remarks

This code is licensed under the 3-Clause BSD License. Please maintain the donation addresses if you fork the repository. Do not use this code in production. If you need anything in production, do not use this code and do not "roll your own crypto": find **another** implementation, one that has been instead subject to auditing and written specifically for that purpose.
