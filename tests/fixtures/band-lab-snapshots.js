// Build a valid TurdSpades snapshot (phase 'bidding' is live, not 'matchEnd')
function makeSpadeCard(id, suit, rank) {
    return { id: 'c' + id, suit, rank };
}

function makeSpadesSnapshot() {
    // Minimal valid TurdSpades state: 4 players, 13 cards each dealt, bidding phase
    const suits = ['S', 'H', 'D', 'C'];
    const hands = [[], [], [], []];
    let cardId = 1;
    for (let r = 2; r <= 14; r++) {
        for (let s = 0; s < 4; s++) {
            hands[s].push(makeSpadeCard(cardId++, suits[s], r));
        }
    }
    return {
        kind: 'turdspades',
        v: 1,
        round: 1,
        dealer: 0,
        leader: 1,
        currentPlayer: 1,
        bidTurn: 1,
        bidChoice: 3,
        phase: 'bidding',
        scores: [0, 0],
        bags: [0, 0],
        bids: [3, null, null, null],
        tricks: [0, 0, 0, 0],
        hands,
        trick: [],
        spadesBroken: false,
        selected: null,
        sortMode: 'suit',
        msg: 'Bidding',
        summary: '',
        lastRoundTone: 'neutral'
    };
}

// Build a valid Crappy Eights snapshot (roundActive: true is live)
function makeEightsCard(id, suit, rank) {
    return { id, suit, rank };
}

function makeEightsSnapshot() {
    const suits = ['S', 'H', 'D', 'C'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    let cardId = 1;
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push(makeEightsCard(cardId++, suit, rank));
        }
    }
    // Deal 5 cards to each player, rest in deck
    const p0Hand = deck.splice(0, 5);
    const p1Hand = deck.splice(0, 5);
    const p2Hand = deck.splice(0, 5);
    const p3Hand = deck.splice(0, 5);
    const discard = [deck.shift()];
    return {
        kind: 'crapeights',
        v: 1,
        players: [
            { name: 'You', human: true, hand: p0Hand, score: 0 },
            { name: 'Bot A', human: false, hand: p1Hand, score: 0 },
            { name: 'Bot B', human: false, hand: p2Hand, score: 0 },
            { name: 'Bot C', human: false, hand: p3Hand, score: 0 }
        ],
        deck,
        discard,
        roundNumber: 1,
        currentPlayer: 0,
        direction: 1,
        activeSuit: discard[0].suit,
        pendingDrawCards: 0,
        pendingSkips: 0,
        roundActive: true,
        hasDrawnThisTurn: false,
        selectedCardId: null,
        pendingWildCard: null,
        historyLog: [],
        nextCardId: 53,
        overlay: null
    };
}


module.exports = { makeSpadesSnapshot, makeEightsSnapshot };
