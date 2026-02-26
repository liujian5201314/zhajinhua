// Firebase配置
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// 初始化Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

class Player {
    constructor(name, isAI = false) {
        this.name = name;
        this.isAI = isAI;
        this.chips = 1000;
        this.bet = 0;
        this.hand = [];
        this.folded = false;
        this.handVisible = !isAI;
        this.seatIndex = -1;
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
    
    toJSON() {
        return {
            name: this.name,
            isAI: this.isAI,
            chips: this.chips,
            bet: this.bet,
            hand: this.hand.map(card => ({ suit: card.suit, rank: card.rank })),
            folded: this.folded,
            handVisible: this.handVisible,
            seatIndex: this.seatIndex
        };
    }
    
    static fromJSON(data) {
        const player = new Player(data.name, data.isAI);
        player.chips = data.chips;
        player.bet = data.bet;
        player.hand = data.hand.map(cardData => new Card(cardData.suit, cardData.rank));
        player.folded = data.folded;
        player.handVisible = data.handVisible;
        player.seatIndex = data.seatIndex;
        return player;
    }
}

class Game {
    constructor() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.pot = 0;
        this.currentBet = 0;
        this.baseBet = 10;
        this.deck = null;
        this.gameActive = false;
        this.roomId = null;
        this.roomName = '';
        this.currentPlayer = null;
        this.turnCount = 0;
        
        this.initializeElements();
        this.bindEvents();
        this.initializeRoomSystem();
    }
    
    initializeElements() {
        this.elements = {
            // 房间管理界面
            roomContainer: document.getElementById('room-container'),
            gameContainer: document.getElementById('game-container'),
            roomNameInput: document.getElementById('room-name'),
            roomAmountInput: document.getElementById('room-amount'),
            createRoomBtn: document.getElementById('create-room-btn'),
            joinRoomCodeInput: document.getElementById('join-room-code'),
            joinRoomBtn: document.getElementById('join-room-btn'),
            roomsContainer: document.getElementById('rooms-container'),
            roomNameDisplay: document.getElementById('room-name-display'),
            roomCodeDisplay: document.getElementById('room-code-display'),
            leaveRoomBtn: document.getElementById('leave-room-btn'),
            
            // 游戏界面
            pot: document.getElementById('pot'),
            currentBet: document.getElementById('current-bet'),
            baseBet: document.getElementById('base-bet'),
            playerCards: document.getElementById('player-cards'),
            playerHandType: document.getElementById('player-hand-type'),
            gameMessage: document.getElementById('game-message'),
            bet10: document.getElementById('bet-10'),
            bet50: document.getElementById('bet-50'),
            bet100: document.getElementById('bet-100'),
            check: document.getElementById('check'),
            fold: document.getElementById('fold'),
            compare: document.getElementById('compare')
        };
    }
    
    bindEvents() {
        // 房间管理事件
        this.elements.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.elements.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.elements.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        
        // 游戏操作事件
        this.elements.bet10.addEventListener('click', () => this.placeBet(10));
        this.elements.bet50.addEventListener('click', () => this.placeBet(50));
        this.elements.bet100.addEventListener('click', () => this.placeBet(100));
        this.elements.check.addEventListener('click', () => this.check());
        this.elements.fold.addEventListener('click', () => this.fold());
        this.elements.compare.addEventListener('click', () => this.showdown());
    }
    
    initializeRoomSystem() {
        this.loadRooms();
        setInterval(() => this.loadRooms(), 5000);
    }
    
    loadRooms() {
        database.ref('rooms').once('value', (snapshot) => {
            const rooms = snapshot.val();
            this.elements.roomsContainer.innerHTML = '';
            
            if (rooms) {
                Object.entries(rooms).forEach(([roomId, roomData]) => {
                    if (!roomData.gameActive) {
                        const roomElement = document.createElement('div');
                        roomElement.className = 'room-item';
                        roomElement.innerHTML = `
                            <div>
                                <div><strong>${roomData.name}</strong></div>
                                <div>底注: ${roomData.baseBet} | 玩家: ${roomData.players ? Object.keys(roomData.players).length : 0}/4</div>
                            </div>
                            <button onclick="game.joinRoomWithCode('${roomId}')">加入</button>
                        `;
                        this.elements.roomsContainer.appendChild(roomElement);
                    }
                });
            }
        });
    }
    
    createRoom() {
        const roomName = this.elements.roomNameInput.value || '新房间';
        const baseBet = parseInt(this.elements.roomAmountInput.value) || 10;
        const roomId = this.generateRoomCode();
        
        this.roomId = roomId;
        this.roomName = roomName;
        this.baseBet = baseBet;
        
        const roomData = {
            id: roomId,
            name: roomName,
            baseBet: baseBet,
            gameActive: false,
            players: {},
            created_at: firebase.database.ServerValue.TIMESTAMP
        };
        
        database.ref('rooms/' + roomId).set(roomData).then(() => {
            this.joinRoomWithCode(roomId);
        });
    }
    
    joinRoom() {
        const roomCode = this.elements.joinRoomCodeInput.value.trim();
        if (roomCode) {
            this.joinRoomWithCode(roomCode);
        }
    }
    
    joinRoomWithCode(roomId) {
        database.ref('rooms/' + roomId).once('value', (snapshot) => {
            const roomData = snapshot.val();
            if (roomData) {
                this.roomId = roomId;
                this.roomName = roomData.name;
                this.baseBet = roomData.baseBet;
                
                const playerName = '玩家' + Math.floor(Math.random() * 1000);
                const playerId = 'player_' + Date.now();
                
                this.currentPlayer = new Player(playerName);
                
                const playerData = this.currentPlayer.toJSON();
                database.ref('rooms/' + roomId + '/players/' + playerId).set(playerData).then(() => {
                    this.setupRoomListeners();
                    this.showGameInterface();
                });
            }
        });
    }
    
    setupRoomListeners() {
        database.ref('rooms/' + this.roomId + '/players').on('value', (snapshot) => {
            const playersData = snapshot.val();
            if (playersData) {
                this.players = Object.values(playersData).map(Player.fromJSON);
                this.assignSeats();
                this.updateUI();
            }
        });
        
        database.ref('rooms/' + this.roomId + '/gameActive').on('value', (snapshot) => {
            this.gameActive = snapshot.val() || false;
        });
        
        database.ref('rooms/' + this.roomId + '/pot').on('value', (snapshot) => {
            this.pot = snapshot.val() || 0;
            this.updateUI();
        });
        
        database.ref('rooms/' + this.roomId + '/currentBet').on('value', (snapshot) => {
            this.currentBet = snapshot.val() || 0;
            this.updateUI();
        });
    }
    
    assignSeats() {
        this.players.forEach((player, index) => {
            player.seatIndex = index;
        });
    }
    
    showGameInterface() {
        this.elements.roomContainer.style.display = 'none';
        this.elements.gameContainer.style.display = 'block';
        this.elements.roomNameDisplay.textContent = this.roomName;
        this.elements.roomCodeDisplay.textContent = '房间代码: ' + this.roomId;
        this.elements.baseBet.textContent = this.baseBet;
        
        this.updateUI();
        this.updateMessage('等待其他玩家加入...');
    }
    
    leaveRoom() {
        if (this.roomId) {
            database.ref('rooms/' + this.roomId + '/players').off();
            database.ref('rooms/' + this.roomId + '/gameActive').off();
            database.ref('rooms/' + this.roomId + '/pot').off();
            database.ref('rooms/' + this.roomId + '/currentBet').off();
            
            this.roomId = null;
            this.roomName = '';
            this.players = [];
            this.gameActive = false;
            
            this.elements.gameContainer.style.display = 'none';
            this.elements.roomContainer.style.display = 'block';
        }
    }
    
    startGame() {
        this.deck = new Deck();
        this.pot = 0;
        this.currentBet = this.baseBet;
        this.gameActive = true;
        
        this.players.forEach(player => {
            player.hand = this.deck.dealHand(3);
            player.resetBet();
            player.folded = false;
            player.handVisible = false;
        });
        
        // 打底
        this.players.forEach(player => {
            if (player.placeBet(this.baseBet)) {
                this.pot += this.baseBet;
            }
        });
        
        this.currentPlayerIndex = 0;
        
        this.saveGameState();
        this.updateUI();
        this.updateMessage('游戏开始！请下注或过牌。');
    }
    
    saveGameState() {
        if (this.roomId) {
            const gameState = {
                gameActive: this.gameActive,
                pot: this.pot,
                currentBet: this.currentBet,
                currentPlayerIndex: this.currentPlayerIndex
            };
            
            database.ref('rooms/' + this.roomId).update(gameState);
            
            this.players.forEach((player, index) => {
                database.ref('rooms/' + this.roomId + '/players/player_' + index).set(player.toJSON());
            });
        }
    }
    
    updateUI() {
        this.elements.pot.textContent = this.pot;
        this.elements.currentBet.textContent = this.currentBet;
        
        // 更新座位显示
        for (let i = 0; i < 4; i++) {
            const seatElement = document.getElementById('seat-' + i);
            const player = this.players.find(p => p.seatIndex === i);
            
            if (player) {
                seatElement.innerHTML = `
                    <div class="seat-player-name">${player.name}</div>
                    <div class="seat-player-chips">筹码: ${player.chips}</div>
                    <div class="seat-player-bet">下注: ${player.bet}</div>
                    <div class="seat-cards">
                        ${player.hand.map(card => {
                            const visible = player.handVisible || player === this.currentPlayer;
                            return `<div class="seat-card ${visible ? card.getColor() : 'back'}">${visible ? card.rank : '?'}</div>`;
                        }).join('')}
                    </div>
                `;
            } else {
                seatElement.innerHTML = '<div class="seat-player-name">空</div>';
            }
        }
        
        // 更新玩家手牌
        const player = this.players.find(p => p === this.currentPlayer);
        if (player) {
            this.renderCards(this.elements.playerCards, player.hand, true);
            const handEval = HandEvaluator.evaluate(player.hand);
            this.elements.playerHandType.textContent = handEval.type;
        }
        
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
        const player = this.players.find(p => p === this.currentPlayer);
        const canAct = this.gameActive && player && !player.folded && this.currentPlayerIndex === this.players.indexOf(player);
        
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
            
            this.saveGameState();
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
        this.saveGameState();
        this.updateUI();
        this.updateMessage(`${player.name}弃牌了。`);
        
        this.checkGameEnd();
        this.nextPlayer();
    }
    
    nextPlayer() {
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        } while (this.players[this.currentPlayerIndex].folded && this.getActivePlayers().length > 1);
        
        this.saveGameState();
        
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
            this.saveGameState();
            this.updateUI();
            this.updateMessage(`${winner.name}获胜，赢得了 ${this.pot} 筹码！`);
        } else {
            const winner = this.determineWinner(activePlayers);
            winner.chips += this.pot;
            this.saveGameState();
            this.updateUI();
            this.updateMessage(`${winner.name}获胜，赢得了 ${this.pot} 筹码！`);
        }
        
        this.gameActive = false;
        this.saveGameState();
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
            this.saveGameState();
            this.updateUI();
            this.updateMessage(`${activePlayers[0].name}获胜，赢得了 ${this.pot} 筹码！`);
        }
    }
    
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
}

let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new Game();
    window.game = game;
});