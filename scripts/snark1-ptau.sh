SIZE=19
CURVE=bn128

mkdir -p ptau
cd ptau
snarkjs powersoftau new ${CURVE} ${SIZE} pot${SIZE}_0000.ptau -v
snarkjs powersoftau contribute pot${SIZE}_0000.ptau pot${SIZE}_0001.ptau --name="First contribution" -v -e
snarkjs powersoftau contribute pot${SIZE}_0001.ptau pot${SIZE}_0002.ptau --name="Second contribution" -v -e
snarkjs powersoftau contribute pot${SIZE}_0002.ptau pot${SIZE}_0003.ptau --name="Third contribution" -v -e
snarkjs powersoftau prepare phase2 pot${SIZE}_0003.ptau pot${SIZE}_final.ptau -v
snarkjs powersoftau export json pot${SIZE}_final.ptau pot${SIZE}_final.json
