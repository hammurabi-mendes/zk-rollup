#!/bin/sh
  
if [ $# -lt 1 ]; then
  echo "Must provide Circom filename prefix (without the .circom extension)"
  exit 1
fi

NAME=$1
ZKEY_NAME=$(echo "$NAME" | tr '[:upper:]' '[:lower:]')
DIRECTORY="contracts"

cd ${NAME}_js
snarkjs zkey export solidityverifier ${ZKEY_NAME}_final.zkey ../${DIRECTORY}/Verifier.sol
snarkjs generatecall --proof=proof.json --public=public.json
