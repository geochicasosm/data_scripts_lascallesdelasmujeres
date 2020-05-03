const processCity = require('./clip_street').processCity;
const fs = require('fs');

console.log('test');

processCity('madrid', 5326784).then(() => console.log('finish test'));
