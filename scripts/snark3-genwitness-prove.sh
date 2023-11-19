#!/bin/sh
  
if [ $# -lt 1 ]; then
  echo "Must provide Circom filename prefix (without the .circom extension)"
  exit 1
fi

INPUT="input.json"
METHOD=groth16

NAME=$1
ZKEY_NAME=$(echo "$NAME" | tr '[:upper:]' '[:lower:]')

cd ${NAME}_js

if [ ! -f "input.json" ]; then
  echo "Edit or link input.json file in ${NAME}_js (check the \"inputs\" directory)"
  exit 1
fi

node generate_witness.js ${NAME}.wasm ${INPUT} ${NAME}.wtns
snarkjs ${METHOD} prove ${ZKEY_NAME}_final.zkey ${NAME}.wtns proof.json public.json
snarkjs ${METHOD} verify verification_key.json public.json proof.json
