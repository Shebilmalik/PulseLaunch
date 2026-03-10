const { JSONRpcProvider } = require('opnet');

const contracts = {
  PULSE_TOKEN: 'tb1ppulselaunchtoken2024opnettestnet3v1',
  STAKING:     'tb1ppulselaunchstaking2024opnettestnet3',
  FACTORY:     'tb1ppulselaunchfactory2024opnettestnet3'
};

console.log('Contract Addresses:');
console.log('PULSE_TOKEN:', contracts.PULSE_TOKEN);
console.log('STAKING:', contracts.STAKING);
console.log('FACTORY:', contracts.FACTORY);
