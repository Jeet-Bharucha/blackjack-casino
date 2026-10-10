'use strict';

// TiDB/MySQL drivers can return numeric columns as numbers or numeric strings.
// A successful login and the subsequent /api/me request must interpret them
// identically, including just after token_version changes during password reset.
function version(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^(0|[1-9]\d*)$/.test(value)) return null;
  const n=Number(value);
  return Number.isSafeInteger(n) && n>=0 ? n : null;
}
function sessionMatches(account,claims) {
  if(!account || !claims || Number(account.is_banned)!==0) return false;
  const stored=version(account.token_version),issued=version(claims.v);
  return stored!==null && issued!==null && stored===issued;
}
module.exports={version,sessionMatches};
