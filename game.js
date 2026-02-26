class Player {
    constructor(name, isAI = false) {
        this.name = name;
        this.isAI = isAI;
        this.chips = 1000;
        this.bet = 0;
        this.hand = [];
        this.folded = false;
        this.handVisible = !isAI;
    }
    
    placeBet(amount) {
        if (this.chips >= amount) {
            this.chips -= amount;
            this.bet += amount;
            return true;
        }
        return false;
    }
    
    resetBet() {
        this.bet = 0;
    }
    
    fold() {
        this.folded = true;
    }
    
    getHandStrength() {
        return HandEvaluator.evaluate(this.hand).strength;
    }
}

class Game {
    constructor() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.pot = 0;
        this.currentBet = 0;
        this.deck = null;
        this.gameActive = false;
        
        this.initializeElements();
        this.bindEvents();
        this.startGame();
    }
    
    initializeElements() {
        this.elements = {
            playerChips: document.getElementById('player-chips'),
            dealerChips: document.getElementById('dealer-chips'),
            playerBet: document.getElementById('player-bet'),
            dealerBet: document.getElementById('dealer-bet'),
            pot: document.getElementById('pot'),
            currentBet: document.getElementById('current-bet'),
            playerCards: document.getElementById('player-cards'),
            dealerCards: document.getElementById('dealer-cards'),
            playerHandType: document.getElementById('player-hand-type'),
            dealerHandType: document.getElementById('dealer-hand-type'),
            gameMessage: document.getElementById('game-message'),
            bet10: document.getElementById('bet-10'),
            bet50: document.getElementById('bet-50'),
            bet100: document.getElementById('bet-100'),
            check: document.getElementById('check'),
            fold: document.getElementById('fold'),
            compare: document.getElementById('compare'),
            restart: document.getElementById('restart')
        };
    }
    
    bindEvents() {
        this.elements.bet10.addEventListener('click', () => this.placeBet(10));
        this.elements.bet50.addEventListener('click', () => this.placeBet(50));
        this.elements.bet100.addEventListener('click', () => this.placeBet(100));
        this.elements.check.addEventListener('click', () => this.check());
        this.elements.fold.addEventListener('click', () => this.fold());
        this.elements.compare.addEventListener('click', () => this.showdown());
        this.elements.restart.addEventListener('click', () => this.startGame());
    }
    
    startGame() {
        this.players = [
            new Player('玩家'),
            new Player('庄家', true),
            new Player('玩家2', true),
            new Player('玩家3', true)
        ];
        this.currentPlayerIndex = 0;
        this.pot = 0;
        this.currentBet = 0;
        this.gameActive = true;
        
        this.deck = new Deck();
        this.players.forEach(player => {
            player.hand = this.deck.dealHand(3);
            player.resetBet();
            player.folded = false;
        });
        
        this.updateUI();
        this.updateMessage('游戏开始！请下注或过牌。');
    }
    
    updateUI() {
        this.elements.pot.textContent = this.pot;
        this.elements.currentBet.textContent = this.currentBet;
        
        // 动态生成玩家信息
        const gameInfoContainer = document.getElementById('game-info');
        gameInfoContainer.innerHTML = '';
        
        this.players.forEach((player, index) => {
            const playerInfoDiv = document.createElement('div');
            playerInfoDiv.className = index === 0 ? 'player-info' : 'dealer-info';
            playerInfoDiv.innerHTML = `
                <h2>${player.name}</h2>
                <div class="chips">筹码: <span>${player.chips}</span></div>
                <div class="bet">当前下注: <span>${player.bet}</span></div>
                ${player.folded ? '<div class="folded">已弃牌</div>' : ''}
            `;
            gameInfoContainer.appendChild(playerInfoDiv);
        });
        
        // 动态生成玩家牌
        const cardsAreaContainer = document.getElementById('cards-area');
        cardsAreaContainer.innerHTML = '';
        
        this.players.forEach((player, index) => {
            const playerCardsDiv = document.createElement('div');
            playerCardsDiv.className = index === 0 ? 'player-cards' : 'dealer-cards';
            
            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'cards';
            this.renderCards(cardsContainer, player.hand, player.handVisible);
            
            const handTypeDiv = document.createElement('div');
            handTypeDiv.className = 'hand-type';
            if (player.handVisible) {
                const handEval = HandEvaluator.evaluate(player.hand);
                handTypeDiv.textContent = handEval.type;
            } else {
                handTypeDiv.textContent = '???';
            }
            
            playerCardsDiv.innerHTML = `<h3>${player.name}的牌</h3>`;
            playerCardsDiv.appendChild(cardsContainer);
            playerCardsDiv.appendChild(handTypeDiv);
            cardsAreaContainer.appendChild(playerCardsDiv);
        });
        
        this.updateButtons();
    }
    
    renderCards(container, hand, visible) {
        container.innerHTML = '';
        hand.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            
            if (visible) {
                cardElement.classList.add(card.getColor());
                cardElement.innerHTML = `
                    <div>${card.rank}</div>
                    <div>${card.suit}</div>
                `;
            } else {
                cardElement.classList.add('back');
                cardElement.textContent = '?';
            }
            
            container.appendChild(cardElement);
        });
    }
    
    updateButtons() {
        const player = this.players[0];
        const canAct = this.gameActive && !player.folded && this.currentPlayerIndex === 0;
        
        this.elements.bet10.disabled = !canAct || player.chips < 10;
        this.elements.bet50.disabled = !canAct || player.chips < 50;
        this.elements.bet100.disabled = !canAct || player.chips < 100;
        this.elements.check.disabled = !canAct;
        this.elements.fold.disabled = !canAct;
        this.elements.compare.disabled = !canAct;
    }
    
    updateMessage(message) {
        this.elements.gameMessage.textContent = message;
    }
    
    placeBet(amount) {
        const player = this.players[this.currentPlayerIndex];
        if (!this.gameActive || player.folded || player.chips < amount) return;
        
        const betAmount = Math.max(amount, this.currentBet - player.bet);
        if (player.placeBet(betAmount)) {
            this.pot += betAmount;
            this.currentBet = Math.max(this.currentBet, player.bet);
            
            this.updateUI();
            this.updateMessage(`${player.name}下注了 ${betAmount} 筹码。`);
            
            this.nextPlayer();
        }
    }
    
    check() {
        const player = this.players[this.currentPlayerIndex];
        if (!this.gameActive || player.folded || player.bet < this.currentBet) return;
        
        this.updateMessage(`${player.name}选择了过牌。`);
        this.nextPlayer();
    }
    
    fold() {
        const player = this.players[this.currentPlayerIndex];
        if (!this.gameActive || player.folded) return;
        
        player.fold();
        this.updateUI();
        this.updateMessage(`${player.name}弃牌了。`);
        
        this.checkGameEnd();
        this.nextPlayer();
    }
    
    nextPlayer() {
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        } while (this.players[this.currentPlayerIndex].folded && this.getActivePlayers().length > 1);
        
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (currentPlayer.isAI && this.gameActive) {
            setTimeout(() => this.aiAction(), 1000);
        }
    }
    
    aiAction() {
        const aiPlayer = this.players[this.currentPlayerIndex];
        const handStrength = aiPlayer.getHandStrength();
        const requiredBet = this.currentBet - aiPlayer.bet;
        
        if (handStrength >= 7) {
            const betAmount = Math.min(100, aiPlayer.chips);
            this.placeBet(betAmount);
        } else if (handStrength >= 5) {
            if (requiredBet <= 50 && aiPlayer.chips >= requiredBet) {
                this.placeBet(requiredBet);
            } else {
                this.fold();
            }
        } else if (handStrength >= 3) {
            if (requiredBet <= 10 && aiPlayer.chips >= requiredBet) {
                this.placeBet(requiredBet);
            } else {
                this.fold();
            }
        } else {
            this.fold();
        }
    }
    
    showdown() {
        this.players.forEach(player => {
            player.handVisible = true;
        });
        
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length === 1) {
            const winner = activePlayers[0];
            winner.chips += this.pot;
            this.updateUI();
            this.updateMessage(`${winner.name}获胜，赢得了 ${this.pot} 筹码！`);
        } else {
            const winner = this.determineWinner(activePlayers);
            winner.chips += this.pot;
            this.updateUI();
            this.updateMessage(`${winner.name}获胜，赢得了 ${this.pot} 筹码！`);
        }
        
        this.gameActive = false;
    }
    
    getActivePlayers() {
        return this.players.filter(player => !player.folded);
    }
    
    determineWinner(players) {
        let bestPlayer = players[0];
        let bestHand = bestPlayer.hand;
        
        for (let i = 1; i < players.length; i++) {
            const currentPlayer = players[i];
            const result = HandEvaluator.compareHands(currentPlayer.hand, bestHand);
            if (result > 0) {
                bestPlayer = currentPlayer;
                bestHand = currentPlayer.hand;
            }
        }
        
        return bestPlayer;
    }
    
    checkGameEnd() {
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length === 1) {
            activePlayers[0].chips += this.pot;
            this.gameActive = false;
            this.players.forEach(player => {
                player.handVisible = true;
            });
            this.updateUI();
            this.updateMessage(`${activePlayers[0].name}获胜，赢得了 ${this.pot} 筹码！`);
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game();
});