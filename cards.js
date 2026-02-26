class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.value = this.getValue();
    }
    
    getValue() {
        const rankValues = {
            '2': 2,
            '3': 3,
            '4': 4,
            '5': 5,
            '6': 6,
            '7': 7,
            '8': 8,
            '9': 9,
            '10': 10,
            'J': 11,
            'Q': 12,
            'K': 13,
            'A': 14
        };
        return rankValues[this.rank];
    }
    
    getDisplay() {
        return `${this.rank}${this.suit}`;
    }
    
    getColor() {
        return ['♥', '♦'].includes(this.suit) ? 'red' : 'black';
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.createDeck();
        this.shuffle();
    }
    
    createDeck() {
        const suits = ['♥', '♦', '♣', '♠'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        for (const suit of suits) {
            for (const rank of ranks) {
                this.cards.push(new Card(suit, rank));
            }
        }
    }
    
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    
    deal() {
        return this.cards.pop();
    }
    
    dealHand(size) {
        const hand = [];
        for (let i = 0; i < size; i++) {
            hand.push(this.deal());
        }
        return hand;
    }
}

class HandEvaluator {
    static evaluate(hand) {
        if (hand.length !== 3) {
            return { type: '无效牌型', strength: 0 };
        }
        
        const sortedHand = hand.sort((a, b) => b.value - a.value);
        const ranks = sortedHand.map(card => card.value);
        const suits = sortedHand.map(card => card.suit);
        
        if (this.isStraightFlush(sortedHand)) {
            return { type: '同花顺', strength: 9, highCard: ranks[0] };
        }
        
        if (this.isThreeOfAKind(ranks)) {
            return { type: '豹子', strength: 8, highCard: ranks[0] };
        }
        
        if (this.isStraight(ranks)) {
            return { type: '顺子', strength: 5, highCard: ranks[0] };
        }
        
        if (this.isFlush(suits)) {
            return { type: '同花', strength: 4, highCard: ranks[0] };
        }
        
        if (this.isPair(ranks)) {
            return { type: '对子', strength: 2, highCard: ranks[0], pairCard: ranks[0] === ranks[1] ? ranks[0] : ranks[1] };
        }
        
        return { type: '单牌', strength: 1, highCard: ranks[0] };
    }
    
    static isStraightFlush(hand) {
        return this.isStraight(hand.map(card => card.value)) && this.isFlush(hand.map(card => card.suit));
    }
    
    static isThreeOfAKind(ranks) {
        return ranks[0] === ranks[1] && ranks[1] === ranks[2];
    }
    
    static isStraight(ranks) {
        if (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2) {
            return true;
        }
        return ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1;
    }
    
    static isFlush(suits) {
        return suits[0] === suits[1] && suits[1] === suits[2];
    }
    
    static isPair(ranks) {
        return ranks[0] === ranks[1] || ranks[1] === ranks[2];
    }
    
    static compareHands(hand1, hand2) {
        const eval1 = this.evaluate(hand1);
        const eval2 = this.evaluate(hand2);
        
        if (eval1.strength > eval2.strength) {
            return 1;
        }
        if (eval1.strength < eval2.strength) {
            return -1;
        }
        
        if (eval1.highCard > eval2.highCard) {
            return 1;
        }
        if (eval1.highCard < eval2.highCard) {
            return -1;
        }
        
        return 0;
    }
}