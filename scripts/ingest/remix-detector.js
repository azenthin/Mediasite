const REMIX_TOKENS = ['remix','mix','instrumental','edit','version','radio edit','dub'];

function isRemix(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  return REMIX_TOKENS.some(token => t.includes(token));
}

module.exports = { isRemix };
