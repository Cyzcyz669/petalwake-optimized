// Parcel stories: every parcel is for somebody, and has something in it. Who lives at a pad is
// fixed (hashed from its id, so the island's people stay put between visits); what they are sent
// changes with each parcel. Pure words - nothing here touches the world.

const FIRST = ['Ama', 'Bram', 'Cress', 'Dov', 'Edda', 'Finch', 'Gale', 'Hob', 'Ines', 'Jory', 'Kit', 'Linnet', 'Marl', 'Nell',
  'Oriel', 'Pell', 'Quill', 'Rook', 'Sorrel', 'Tamsin', 'Ulla', 'Vane', 'Wren', 'Yarrow', 'Zinnia', 'Hester', 'Corin', 'Maud', 'Ivo', 'Petra'];
const LAST = ['Pellow', 'Tregear', 'Hollis', 'Marrack', 'Penhale', 'Bosanko', 'Carne', 'Nancarrow', 'Trewin', 'Vosper', 'Rowe',
  'Kitto', 'Lanyon', 'Jago', 'Opie', 'Sennen', 'Trethewey', 'Polglase'];

// what they do, guessed from where they live
const TRADE = [
  [/observ|star/i, 'the star-gazer', ['a new brass eyepiece', 'a tin of lens wax', 'a chart of the autumn sky']],
  [/gate/i, 'the gate warden', ['a fresh lantern wick', 'the new watch roster', 'a pair of wool mittens']],
  [/courier/i, 'the guild clerk', ['a stack of blank waybills', 'a stamp that went astray', 'the guild\'s new seal']],
  [/town ?hall|belfry/i, 'the mayor\'s secretary', ['the minutes of the harbour board', 'a crate of ribbon for the fair', 'a reply from Cairnwick']],
  [/chapel|bell/i, 'the bell-ringer', ['a rope for the tenor bell', 'a jar of beeswax', 'the hymn sheets']],
  [/harbour ?master/i, 'the harbourmaster', ['the tide tables', 'a bundle of signal flags', 'a fisher\'s complaint, in triplicate']],
  [/huer|lookout|crow|whale/i, 'the lookout', ['a spyglass back from mending', 'a flask of hot cocoa', 'a new pair of field glasses']],
  [/customs/i, 'the customs officer', ['a ledger, very heavy', 'a sealed tin of tea', 'a list of what the last ship forgot']],
  [/tea/i, 'the tea house owner', ['a pound of smoky lapsang', 'three dozen paper doilies', 'a recipe for lavender scones']],
  [/shot/i, 'the shot-maker', ['a sack of lead (careful)', 'new tongs', 'an order from the gunsmith']],
  [/dyer|drying/i, 'the dyer', ['a pouch of woad', 'madder root, well wrapped', 'a sample of the new rose pink']],
  [/dove|cote|pippin/i, 'the dove-keeper', ['a sack of seed', 'a ring for a homing bird', 'a letter carried half-way by a pigeon']],
  [/library|scholar/i, 'the librarian', ['an overdue atlas', 'a book of sea-shanties', 'a pot of iron-gall ink']],
  [/lamp|light|lantern|beacon/i, 'the lamp-keeper', ['a can of lamp oil', 'a box of spare mantles', 'a new chimney glass']],
  [/keep|hostel|inn/i, 'the innkeeper', ['a wheel of blue cheese', 'clean linen for the guest room', 'a cask tap']],
  [/cistern|pump/i, 'the water warden', ['a new pump washer', 'a bucket of grease', 'a jar of the spring water, for testing']],
  [/notary/i, 'the notary', ['a deed to be witnessed', 'red sealing wax', 'a pen nib of the finest steel']],
  [/pilot/i, 'the harbour pilot', ['an oilskin coat', 'a corrected chart of the Sisters', 'a tin of ship\'s biscuit']],
  [/signal/i, 'the signaller', ['a new set of shutters', 'the codebook, updated', 'a tin of soot-black paint']],
  [/weather/i, 'the weather-watcher', ['a barometer, very fragile', 'a fresh roll of chart paper', 'a feather for the vane']],
  [/oast/i, 'the hop-farmer', ['hop sacks', 'a new thermometer for the kiln', 'a letter from the brewer']],
  [/mill/i, 'the miller', ['a sail cloth patch', 'a sack of seed corn', 'a jar of the good honey']],
  [/candle|shrine/i, 'the candle-keeper', ['a bundle of tallow candles', 'a pressed flower', 'a quiet note from somebody']],
  [/heron|stilt/i, 'the heron-watcher', ['a sketchbook', 'a waterproof pencil', 'a bag of eel bait']],
];
const ANY = ['a birthday cake (keep it level)', 'a parcel of letters from the mainland', 'a jar of plum jam', 'a knitted scarf, pink',
  'a pair of new boots', 'seeds for the window box', 'a kite, in pieces', 'a music box', 'a ball of very good string', 'a bunch of sweet peas'];
const NOTE = ['they are waiting at the window', 'it was meant to arrive yesterday', 'the label says FRAGILE three times',
  'it smells faintly of cinnamon', 'it rattles when you bank', 'the sender drew a little broom on it', 'it is surprisingly light',
  'the string is tied in a lover\'s knot', 'it is marked URGENT in red', 'someone has written "no peeking"'];
const THANKS = ['"Right on time - you are a star."', '"Oh! You flew all the way out here?"', '"Wonderful. Mind the gulls on your way."',
  '"I had given up on it. Thank you, rider."', '"Have a biscuit for the road."', '"The wind brought you quick today."',
  '"Tell the guild I said thank you."', '"Petals in my hair again - worth it."', '"Bless your broom."', '"Just what I needed."'];
const SLOW = ['"Ah. Well - better late than never."', '"Took the scenic way, did you?"', '"No matter, the kettle\'s still warm."'];

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const pick = (list, n) => list[n % list.length];

/** Who lives at a pad: { name, trade, wants }. */
export function resident(pad) {
  const key = `${pad.id}|${pad.name}`, h = hash(key);
  const hay = `${pad.name} ${pad.spot || ''} ${pad.building || ''}`;
  const t = TRADE.find(([re]) => re.test(hay));
  return {
    name: `${pick(FIRST, h)} ${pick(LAST, h >>> 8)}`,
    trade: t ? t[1] : 'the householder',
    wants: t ? t[2] : ANY,
  };
}

/** A fresh parcel for a pad. `n` is the parcel's number (so the same pad gets different things). */
export function parcel(pad, n) {
  const r = resident(pad), h = hash(`${pad.id}#${n}`);
  const item = (h & 3) === 0 ? pick(ANY, h >>> 3) : pick(r.wants, h >>> 3);
  return { to: r.name, trade: r.trade, item, note: pick(NOTE, h >>> 11), thanks: pick(THANKS, h >>> 17), slow: pick(SLOW, h >>> 21) };
}
