#!/bin/sh
  
if [ $# -lt 1 ]; then
  echo "Must provide Circom filename prefix (without the .circom extension)"
  exit 1
fi

# Method can be plonk or groth16
SIZE=19
METHOD=groth16

NAME=$1
ZKEY_NAME=$(echo "$NAME" | tr '[:upper:]' '[:lower:]')
PTAU_FINAL="../ptau/pot${SIZE}_final.ptau"
DIRECTORY="circuits"

# Circuit-specific for Groth16:
#  - Generate proving/verification keys
#  - *_0000.zkey has zero contributions, so we add one contribution into *_0001

circom ${DIRECTORY}/${NAME}.circom --r1cs --wasm --sym && \
cd ${NAME}_js && \

if [ ${METHOD} = "plonk" ]; then
  snarkjs plonk setup ../${NAME}.r1cs $PTAU_FINAL ${ZKEY_NAME}_final.zkey
fi

if [ ${METHOD} = "groth16" ]; then
  snarkjs groth16 setup ../${NAME}.r1cs $PTAU_FINAL ${ZKEY_NAME}_0000.zkey && \
  snarkjs zkey contribute ${ZKEY_NAME}_0000.zkey ${ZKEY_NAME}_0001.zkey --name="First contributor" -v -e && \
  snarkjs zkey contribute ${ZKEY_NAME}_0001.zkey ${ZKEY_NAME}_final.zkey --name="Second contributor" -v -e
fi

snarkjs zkey export verificationkey ${ZKEY_NAME}_final.zkey verification_key.json