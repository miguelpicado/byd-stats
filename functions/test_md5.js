const crypto = require('crypto');

const password = "iO$o$L7Ogq8Yq5Y";

function md5Hex(str) {
    return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

console.log("JS md5(md5(pw)):");
console.log(md5Hex(md5Hex(password)));
