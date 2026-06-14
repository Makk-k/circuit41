const jwt = require('jsonwebtoken');
const fs = require('fs');

const teamId = 'XRB5U52F27';
const clientId = 'com.circuit40s.auth';
const keyId = '29QSA49B7C';

// paste your .p8 file path here
const privateKey = fs.readFileSync('./AuthKey.p8');

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  expiresIn: '180d',
  issuer: teamId,
  audience: 'https://appleid.apple.com',
  subject: clientId,
  keyid: keyId,
});

console.log(token);

