import { poseidonContract } from 'circomlibjs';
import fs from 'fs';

function generate(numberInputs) {
  const outputPath = 'Poseidon' + numberInputs + '.json'

  const contract = {
    contractName: 'Poseidon',
    abi: poseidonContract.generateABI(numberInputs),
    bytecode: poseidonContract.createCode(numberInputs)
  }

  fs.writeFileSync(outputPath, JSON.stringify(contract))
}

generate(2)
generate(3)
generate(5)
