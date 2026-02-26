// Firebase配置
const firebaseConfig = {
    apiKey: "AIzaSyB5ni-l335Oc4mJVIiRSsjNcWoJ4YyxQ0U",
    authDomain: "zhajinhua-5e568.firebaseapp.com",
    databaseURL: "https://zhajinhua-5e568-default-rtdb.firebaseio.com",
    projectId: "zhajinhua-5e568",
    storageBucket: "zhajinhua-5e568.firebasestorage.app",
    messagingSenderId: "586482262446",
    appId: "1:586482262446:web:ce190e2cc0bec994f2683f"
};

// 初始化Firebase
let database = null;
let firebaseApp = null;
let firebaseConnected = false;

try {
    console.log('开始初始化Firebase...');
    firebaseApp = firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    
    // 监听Firebase连接状态
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snapshot) => {
        if (snapshot.val() === true) {
            console.log('Firebase连接成功');
            firebaseConnected = true;
        } else {
            console.log('Firebase连接断开');
            firebaseConnected = false;
        }
    });
    
    console.log('Firebase初始化成功');
} catch (error) {
    console.error('Firebase初始化失败:', error);
    alert('Firebase初始化失败，请检查网络连接或Firebase配置');
}

// 全局游戏实例
let currentGame = null;

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
        this.betTime = 30; // 默认下注时间30秒
        this.turnTimer = null; // 回合计时器
        this.deck = null;
        this.gameActive = false;
        this.roomId = null;
        this.roomName = '';
        this.currentPlayer = null;
        this.turnCount = 0;
        this.isRoomCreator = false; // 是否是房间创建者
        
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
            betTimeInput: document.getElementById('bet-time'),
            createRoomBtn: document.getElementById('create-room-btn'),
            joinRoomCodeInput: document.getElementById('join-room-code'),
            joinRoomBtn: document.getElementById('join-room-btn'),
            roomsContainer: document.getElementById('rooms-container'),
            roomNameDisplay: document.getElementById('room-name-display'),
            roomCodeDisplay: document.getElementById('room-code-display'),
            leaveRoomBtn: document.getElementById('leave-room-btn'),
            startGameBtn: document.getElementById('start-game-btn'),
            rulesBtn: document.getElementById('rules-btn'),
            rulesBtnGame: document.getElementById('rules-btn-game'),
            rulesModal: document.getElementById('rules-modal'),
            closeModal: document.querySelector('.close'),
            
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
            compare: document.getElementById('compare'),
            playerCount: document.getElementById('player-count'),
            gameStatus: document.getElementById('game-status')
        };
    }
    
    bindEvents() {
        // 房间管理事件
        if (this.elements.createRoomBtn) {
            this.elements.createRoomBtn.addEventListener('click', () => this.createRoom());
        }
        if (this.elements.joinRoomBtn) {
            this.elements.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        }
        if (this.elements.leaveRoomBtn) {
            this.elements.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        }
        if (this.elements.startGameBtn) {
            this.elements.startGameBtn.addEventListener('click', () => this.startGame());
        }
        
        // 游戏规则模态框事件
        if (this.elements.rulesBtn) {
            this.elements.rulesBtn.addEventListener('click', () => this.showRules());
        }
        if (this.elements.rulesBtnGame) {
            this.elements.rulesBtnGame.addEventListener('click', () => this.showRules());
        }
        if (this.elements.closeModal) {
            this.elements.closeModal.addEventListener('click', () => this.hideRules());
        }
        if (this.elements.rulesModal) {
            this.elements.rulesModal.addEventListener('click', (event) => {
                if (event.target === this.elements.rulesModal) {
                    this.hideRules();
                }
            });
        }
        
        // 游戏操作事件
        if (this.elements.bet10) {
            this.elements.bet10.addEventListener('click', () => this.placeBet(10));
        }
        if (this.elements.bet50) {
            this.elements.bet50.addEventListener('click', () => this.placeBet(50));
        }
        if (this.elements.bet100) {
            this.elements.bet100.addEventListener('click', () => this.placeBet(100));
        }
        if (this.elements.check) {
            this.elements.check.addEventListener('click', () => this.check());
        }
        if (this.elements.fold) {
            this.elements.fold.addEventListener('click', () => this.fold());
        }
        if (this.elements.compare) {
            this.elements.compare.addEventListener('click', () => this.showdown());
        }
    }
    
    initializeRoomSystem() {
        this.loadRooms();
        setInterval(() => this.loadRooms(), 5000);
    }
    
    loadRooms() {
        if (!this.elements.roomsContainer) return;
        
        if (!database) {
            console.error('Firebase未初始化');
            this.elements.roomsContainer.innerHTML = '<div class="error-message">Firebase未初始化，请检查网络连接</div>';
            return;
        }
        
        // Firebase模式
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
        }).catch((error) => {
            console.error('加载房间列表失败:', error);
            this.elements.roomsContainer.innerHTML = '<div class="error-message">加载房间列表失败，请重试</div>';
        });
    }
    
    createRoom() {
        if (!this.elements.roomNameInput || !this.elements.roomAmountInput) return;
        
        if (!database) {
            console.error('Firebase未初始化');
            alert('Firebase未初始化，请检查网络连接');
            return;
        }
        
        const roomName = this.elements.roomNameInput.value || '新房间';
        const baseBet = parseInt(this.elements.roomAmountInput.value) || 10;
        const betTime = parseInt(this.elements.betTimeInput.value) || 30;
        const roomId = this.generateRoomCode();
        
        this.roomId = roomId;
        this.roomName = roomName;
        this.baseBet = baseBet;
        this.betTime = betTime;
        this.isRoomCreator = true; // 设置为房间创建者
        
        const roomData = {
            id: roomId,
            name: roomName,
            baseBet: baseBet,
            betTime: betTime,
            gameActive: false,
            players: {},
            created_at: firebase.database.ServerValue.TIMESTAMP
        };
        
        // Firebase模式
        database.ref('rooms/' + roomId).set(roomData).then(() => {
            this.joinRoomWithCode(roomId);
        }).catch((error) => {
            console.error('创建房间失败:', error);
            alert('创建房间失败，请重试');
        });
    }
    
    joinRoom() {
        if (!this.elements.joinRoomCodeInput) return;
        
        const roomCode = this.elements.joinRoomCodeInput.value.trim();
        if (roomCode) {
            this.joinRoomWithCode(roomCode);
        }
    }
    
    joinRoomWithCode(roomId) {
        if (!database) {
            console.error('Firebase未初始化');
            alert('Firebase未初始化，请检查网络连接');
            return;
        }
        
        // 只使用Firebase模式
        database.ref('rooms/' + roomId).once('value', (snapshot) => {
            const roomData = snapshot.val();
            if (roomData) {
                this.roomId = roomId;
                this.roomName = roomData.name;
                this.baseBet = roomData.baseBet;
                this.betTime = roomData.betTime || 30;
                
                const playerName = '玩家' + Math.floor(Math.random() * 1000);
                const playerId = 'player_' + Date.now();
                
                this.currentPlayer = new Player(playerName);
                
                const playerData = this.currentPlayer.toJSON();
                database.ref('rooms/' + roomId + '/players/' + playerId).set(playerData).then(() => {
                    // 初始化玩家数组
                    this.players = [this.currentPlayer];
                    this.assignSeats();
                    this.setupRoomListeners();
                    this.showGameInterface();
                }).catch((error) => {
                    console.error('添加玩家失败:', error);
                    alert('加入房间失败，请重试');
                });
            } else {
                console.error('房间不存在');
                alert('房间不存在，请检查房间代码');
            }
        }).catch((error) => {
            console.error('获取房间信息失败:', error);
            alert('获取房间信息失败，请检查网络连接');
        });
    }
    
    setupRoomListeners() {
        if (!database) {
            console.error('Firebase未初始化');
            return;
        }
        
        // Firebase模式监听器
        database.ref('rooms/' + this.roomId + '/players').on('value', (snapshot) => {
            const playersData = snapshot.val();
            if (playersData) {
                this.players = Object.values(playersData).map(Player.fromJSON);
                // 确保当前玩家对象在数组中
                if (this.currentPlayer) {
                    const currentPlayerExists = this.players.some(p => p.name === this.currentPlayer.name);
                    if (!currentPlayerExists) {
                        this.players.push(this.currentPlayer);
                    }
                }
                this.assignSeats();
                this.updateUI();
            }
        });
        
        database.ref('rooms/' + this.roomId + '/gameActive').on('value', (snapshot) => {
            this.gameActive = snapshot.val() || false;
            this.updateUI();
        });
        
        database.ref('rooms/' + this.roomId + '/pot').on('value', (snapshot) => {
            this.pot = snapshot.val() || 0;
            this.updateUI();
        });
        
        database.ref('rooms/' + this.roomId + '/currentBet').on('value', (snapshot) => {
            this.currentBet = snapshot.val() || 0;
            this.updateUI();
        });
        
        database.ref('rooms/' + this.roomId + '/currentPlayerIndex').on('value', (snapshot) => {
            this.currentPlayerIndex = snapshot.val() || 0;
            this.updateUI();
        });
    }
    
    assignSeats() {
        this.players.forEach((player, index) => {
            player.seatIndex = index;
        });
    }
    
    showGameInterface() {
        if (!this.elements.roomContainer || !this.elements.gameContainer) return;
        
        this.elements.roomContainer.style.display = 'none';
        this.elements.gameContainer.style.display = 'block';
        
        if (this.elements.roomNameDisplay) {
            this.elements.roomNameDisplay.textContent = this.roomName;
        }
        if (this.elements.roomCodeDisplay) {
            this.elements.roomCodeDisplay.textContent = '房间代码: ' + this.roomId;
        }
        if (this.elements.baseBet) {
            this.elements.baseBet.textContent = this.baseBet;
        }
        
        this.updateUI();
        this.updateMessage('等待其他玩家加入...');
    }
    
    leaveRoom() {
        if (this.roomId) {
            if (database) {
                // Firebase模式
                // 从房间中移除当前玩家
                database.ref('rooms/' + this.roomId + '/players').once('value', (snapshot) => {
                    const playersData = snapshot.val();
                    if (playersData) {
                        Object.keys(playersData).forEach(playerId => {
                            if (playersData[playerId].name === this.currentPlayer.name) {
                                database.ref('rooms/' + this.roomId + '/players/' + playerId).remove().catch((error) => {
                                    console.error('移除玩家失败:', error);
                                });
                            }
                        });
                        
                        // 如果房间为空，自动解散
                        if (Object.keys(playersData).length === 1) { // 只有当前玩家一个
                            database.ref('rooms/' + this.roomId).remove().catch((error) => {
                                console.error('解散房间失败:', error);
                            });
                        }
                    } else {
                        // 房间为空，自动解散
                        database.ref('rooms/' + this.roomId).remove().catch((error) => {
                            console.error('解散房间失败:', error);
                        });
                    }
                }).catch((error) => {
                    console.error('获取玩家信息失败:', error);
                });
                
                // 移除监听器
                database.ref('rooms/' + this.roomId + '/players').off();
                database.ref('rooms/' + this.roomId + '/gameActive').off();
                database.ref('rooms/' + this.roomId + '/pot').off();
                database.ref('rooms/' + this.roomId + '/currentBet').off();
                database.ref('rooms/' + this.roomId + '/currentPlayerIndex').off();
            }
            
            this.roomId = null;
            this.roomName = '';
            this.players = [];
            this.gameActive = false;
            this.isRoomCreator = false;
            
            if (this.elements.gameContainer && this.elements.roomContainer) {
                this.elements.gameContainer.style.display = 'none';
                this.elements.roomContainer.style.display = 'block';
            }
        }
    }
    
    startGame() {
        if (!database) {
            console.error('Firebase未初始化');
            alert('Firebase未初始化，请检查网络连接');
            return;
        }
        
        // 只有房间创建者可以开始游戏
        if (!this.isRoomCreator) {
            this.updateMessage('只有房间创建者可以开始游戏');
            return;
        }
        
        // 检查是否有至少2名玩家
        if (this.players.length < 2) {
            this.updateMessage('房间中至少需要2名玩家才能开始游戏');
            return;
        }
        
        // 初始化牌局
        this.deck = new Deck();
        this.pot = 0;
        this.currentBet = this.baseBet;
        this.gameActive = true;
        
        // 分配手牌并重置玩家状态
        this.players.forEach(player => {
            player.hand = this.deck.dealHand(3);
            player.resetBet();
            player.folded = false;
            player.handVisible = true; // 所有玩家的牌对自己可见
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
        
        // 开始游戏回合
        this.nextPlayer();
    }
    
    saveGameState() {
        if (this.roomId && database) {
            const gameState = {
                gameActive: this.gameActive,
                pot: this.pot,
                currentBet: this.currentBet,
                currentPlayerIndex: this.currentPlayerIndex
            };
            
            // Firebase模式
            database.ref('rooms/' + this.roomId).update(gameState).catch((error) => {
                console.error('保存游戏状态失败:', error);
            });
            
            // 先清空现有玩家，然后重新添加所有玩家
            database.ref('rooms/' + this.roomId + '/players').set({}).then(() => {
                this.players.forEach((player, index) => {
                    database.ref('rooms/' + this.roomId + '/players/player_' + index).set(player.toJSON()).catch((error) => {
                        console.error('保存玩家数据失败:', error);
                    });
                });
            }).catch((error) => {
                console.error('清空玩家数据失败:', error);
            });
        }
    }
    
    updateUI() {
        if (this.elements.pot) {
            this.elements.pot.textContent = this.pot;
        }
        if (this.elements.currentBet) {
            this.elements.currentBet.textContent = this.currentBet;
        }
        
        // 更新状态信息
        if (this.elements.playerCount) {
            this.elements.playerCount.textContent = this.players.length;
        }
        if (this.elements.gameStatus) {
            this.elements.gameStatus.textContent = this.gameActive ? '游戏中' : '等待中';
        }
        
        // 更新座位显示
        for (let i = 0; i < 4; i++) {
            const seatElement = document.getElementById('seat-' + i);
            if (seatElement) {
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
        }
        
        // 更新玩家手牌
        const player = this.players.find(p => p === this.currentPlayer);
        if (player) {
            this.renderCards(this.elements.playerCards, player.hand, true);
            const handEval = HandEvaluator.evaluate(player.hand);
            if (this.elements.playerHandType) {
                this.elements.playerHandType.textContent = handEval.type;
            }
        }
        
        this.updateButtons();
    }
    
    showRules() {
        if (this.elements.rulesModal) {
            this.elements.rulesModal.style.display = 'block';
        }
    }
    
    hideRules() {
        if (this.elements.rulesModal) {
            this.elements.rulesModal.style.display = 'none';
        }
    }
    
    renderCards(container, hand, visible) {
        if (!container) return;
        
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
        
        if (this.elements.bet10) {
            this.elements.bet10.disabled = !canAct || player.chips < 10;
        }
        if (this.elements.bet50) {
            this.elements.bet50.disabled = !canAct || player.chips < 50;
        }
        if (this.elements.bet100) {
            this.elements.bet100.disabled = !canAct || player.chips < 100;
        }
        if (this.elements.check) {
            this.elements.check.disabled = !canAct;
        }
        if (this.elements.fold) {
            this.elements.fold.disabled = !canAct;
        }
        if (this.elements.compare) {
            this.elements.compare.disabled = !canAct;
        }
    }
    
    updateMessage(message) {
        if (this.elements.gameMessage) {
            this.elements.gameMessage.textContent = message;
        }
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
        // 清除之前的计时器
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
        
        // 检查游戏是否结束
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length <= 1) {
            this.checkGameEnd();
            return;
        }
        
        // 寻找下一个未弃牌的玩家
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        } while (this.players[this.currentPlayerIndex].folded && this.getActivePlayers().length > 1);
        
        this.saveGameState();
        
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (currentPlayer && this.gameActive) {
            // 为真实玩家设置下注计时器
            this.updateMessage(`轮到 ${currentPlayer.name} 行动，剩余时间: ${this.betTime}秒`);
            let timeLeft = this.betTime;
            
            this.turnTimer = setInterval(() => {
                timeLeft--;
                this.updateMessage(`轮到 ${currentPlayer.name} 行动，剩余时间: ${timeLeft}秒`);
                
                if (timeLeft <= 0) {
                    clearInterval(this.turnTimer);
                    this.turnTimer = null;
                    this.updateMessage(`${currentPlayer.name} 超时，自动弃牌`);
                    this.fold();
                }
            }, 1000);
        }
    }
    
    showdown() {
        // 显示所有玩家的手牌
        this.players.forEach(player => {
            player.handVisible = true;
        });
        
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length === 1) {
            // 只有一名玩家未弃牌，直接获胜
            const winner = activePlayers[0];
            winner.chips += this.pot;
            this.saveGameState();
            this.updateUI();
            this.updateMessage(`${winner.name}获胜，赢得了 ${this.pot} 筹码！`);
        } else if (activePlayers.length > 1) {
            // 比较手牌确定获胜者
            const winner = this.determineWinner(activePlayers);
            winner.chips += this.pot;
            this.saveGameState();
            this.updateUI();
            this.updateMessage(`${winner.name}获胜，赢得了 ${this.pot} 筹码！`);
        } else {
            // 没有活跃玩家，游戏结束
            this.updateMessage('没有活跃玩家，游戏结束');
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