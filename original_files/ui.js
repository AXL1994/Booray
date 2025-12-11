// UI MANAGEMENT

// ===== DOM REFERENCES =====
const DOM = {
  playerHand: document.getElementById('player-hand-section'),
  actionButtons: document.getElementById('action-buttons'),
  trumpCard: document.getElementById('trump-card-img'),
  pot: document.getElementById('pot-amount'),
  ante: document.getElementById('ante-amount'),
  players: document.getElementById('players-section-container'),
  preGame: document.getElementById('pre-game-container'),
  infoCard: document.querySelector('.info-card'),
  gameMode: document.getElementById('game-mode-switch'),
  playersContainer: document.getElementById('players-section-container')
};

// ===== UI STATE =====
const uiState = {
  updateQueue: [],
  isProcessing: false
};

// ===== UTILITY =====
const createEl = (tag, className = '', attrs = {}) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  Object.entries(attrs).forEach(([key, val]) => el[key] = val);
  return el;
};

const clearElement = (el) => { if (el) el.innerHTML = ''; };

// ===== GAME UI VISIBILITY =====
const showGameUI = () => {
  DOM.preGame?.classList.add('hidden');
  DOM.infoCard?.classList.remove('hidden');
  DOM.playersContainer?.classList.remove('hidden');
};

const showPreGameUI = () => {
  DOM.preGame?.classList.remove('hidden');
  DOM.infoCard?.classList.add('hidden');
  DOM.playersContainer?.classList.add('hidden')
  if (DOM.gameMode) DOM.gameMode.checked = false;
};

// ===== PLAYER HAND =====
if ('ontouchstart' in window) {
  document.addEventListener('touchstart', function() {}, { passive: true });
  
  document.addEventListener('touchend', () => {
    document.querySelectorAll('.hand, .selectable-card').forEach(el => {
      el.style.transform = '';
    });
  }, { passive: true });
}


const createCardImg = (card, className = 'hand', clickHandler = null) => {
  const img = createEl('img', className, { 
    src: `cards/${card}.svg`, 
    alt: card 
  });
  if (clickHandler) img.onclick = clickHandler;
  return img;
};

const renderPlayerHand = (cards, config = {}) => {
  clearElement(DOM.playerHand);
  if (cards.length === 0) return;
  
  const container = createEl('div', 'container text-center');
  const row = createEl('div', 'row');
  const col = createEl('div', 'col');
  
  cards.forEach((card, index) => {
    const img = createCardImg(card, config.baseClass || 'hand', config.onClick?.(card, index));
    
    if (config.highlight?.(card, index)) {
      img.classList.add(config.highlightClass);
    }
    
    col.appendChild(img);
  });
  
  row.appendChild(col);
  container.appendChild(row);
  DOM.playerHand.appendChild(container);
};

const updatePlayerHandUI = (cards) => {
  renderPlayerHand(cards);
};

const updatePlayerHandUIForDiscard = (cards) => {
  renderPlayerHand(cards, {
    baseClass: 'hand selectable-card',
    highlight: (_, index) => selectedCardsForDiscard?.includes(index),
    highlightClass: 'selected-for-discard',
    onClick: (_, index) => () => selectCardForDiscard(index)
  });
};

const updatePlayerHandUIForPlay = (cards, validCards, isPlayerTurn = false) => {
  renderPlayerHand(cards, {
    baseClass: 'hand',
    highlight: (card) => isPlayerTurn && validCards.includes(card),
    highlightClass: 'selectable-card',
    onClick: (card, index) => {
      if (!isPlayerTurn || !validCards.includes(card)) {
        return null;
      }
      return () => {
        selectedCardForPlay = index;
        if (waitingForPlayerInput && currentInputType === 'card_play' && playerInputResolver) {
          waitingForPlayerInput = false;
          const resolver = playerInputResolver;
          playerInputResolver = null;
          resolver('card_selected');
        }
      };
    }
  });
  
  if (isPlayerTurn) {
    const imgs = DOM.playerHand.querySelectorAll('img');
    cards.forEach((card, index) => {
      if (!validCards.includes(card)) {
        imgs[index]?.classList.add('non-playable-card');
      }
    });
  }
};

// ===== GAME INFO =====
const updateTrumpCardUI = (card) => {
  if (DOM.trumpCard) {
    if (!card) {
      DOM.trumpCard.style.display = '';
      DOM.trumpCard.src = 'cards/BACK.svg';
    } else {
      DOM.trumpCard.style.display = '';
      DOM.trumpCard.src = `cards/${card}.svg`;
    }
  }
};

const updatePotUI = (amount) => {
  if (DOM.pot) DOM.pot.textContent = `${amount}$`;
};

const updateAnteUI = (amount) => {
  if (DOM.ante) DOM.ante.textContent = `${amount}$`;
};

// ===== ACTION BUTTONS =====
const createButton = ({ text, class: btnClass, onClick }) => {
  const btn = createEl('button', `btn ${btnClass}`, { textContent: text, onclick: onClick });
  return btn;
};

const showDynamicButtons = (buttons) => {
  clearElement(DOM.actionButtons);
  DOM.actionButtons.closest('.info-row').classList.remove('hidden');
  
  if (buttons.length === 1) {
    const btn = createButton(buttons[0]);
    btn.classList.add('btn-lg');
    DOM.actionButtons.appendChild(btn);
  } else if (buttons.length === 2) {
    buttons.forEach(config => {
      const btn = createButton(config);
      DOM.actionButtons.appendChild(btn);
    });
  } else {
    buttons.forEach(config => {
      const btn = createButton(config);
      DOM.actionButtons.appendChild(btn);
    });
  }
};

const showPlayDecisionButtons = () => {
  showDynamicButtons([
    {
      text: 'PLAY',
      class: 'btn-success btn-lg',
      onClick: () => {
        window.playerInput('y');
      }
    },
    {
      text: 'FOLD',
      class: 'btn-danger btn-lg',
      onClick: () => {
        window.playerInput('n');
        showSkipButton();
      }
    }
  ]);
};

const showDiscardButton = () => {
  showDynamicButtons([
    {
      text: 'DISCARD',
      class: 'btn-primary btn-lg',
      onClick: () => {
        processDiscard();
      }
    }
  ]);
};

const showSkipButton = () => {
  showDynamicButtons([
    {
      text: 'SKIP',
      class: 'btn-primary btn-lg',
      onClick: () => {
        window.enableSkipMode();
      }
    }
  ]);
};

const clearActionButtons = () => {
  if (DOM.actionButtons) {
    DOM.actionButtons.innerHTML = '';
    DOM.actionButtons.closest('.info-row')?.classList.add('hidden');
  }
};

// ===== OPPONENTS UI =====
const createPlayerCard = (player, index, config) => {
  const { trickCards, tricksWon, dealerIndex, roundResult, animateCard } = config;
  
  const col = createEl('div', 'col-auto text-center mx-2');
  
  // Card container
  const cardContainer = createEl('div', 'card-container d-flex align-items-center justify-content-center');
  cardContainer.style.height = '100px';
  
  const playedCard = trickCards.find(tc => tc.playerName === player.name);
  if (playedCard) {
    const cardImg = createCardImg(playedCard.card, 'playerCard played-card');
    cardImg.dataset.playerName = player.name;
    
    if (animateCard?.playerName === player.name && animateCard?.card === playedCard.card) {
      cardImg.classList.add('card-moving-to-play');
    }
    
    cardContainer.appendChild(cardImg);
  } else {
    cardContainer.style.minHeight = '100px';
  }
  
  // Profile pic
  const propic = createEl('img', 'propic', { src: `img/${player.propic}` });
  if (index === dealerIndex) propic.classList.add('dealer-border');
  
  // Info
  const name = createEl('div', 'player-info');
  name.innerHTML = `<strong>${player.name}</strong>`;
  const money = createEl('div', 'player-info');
  money.innerHTML = `<strong>${player.fiches}$</strong>`;
  const status = createEl('div', 'player-info');
  
  // Status logic
  if (roundResult?.results?.[player.name]) {
  const result = roundResult.results[player.name];
  status.textContent = result;
  status.className = 'player-info round-result';
  
  const resultClasses = {
    'Winner': 'winner-result',
    'Draw': 'draw-result',
    'Booray': 'booray-result',
    'Loser': 'loser-result',
    'Folded': 'folded-result'
  };
  if (resultClasses[result]) status.classList.add(resultClasses[result]);
  } else if (!player.active) {
    col.style.opacity = '0.5';
    status.textContent = 'Eliminated';
    status.className = 'player-info round-result eliminated-result';
  } else if (player.passed) {
    status.textContent = 'Folded';
    status.className = 'player-info round-result folded-result';
  } else if (tricksWon?.[player.name] !== undefined) {
    const activePlayers = players.filter(p => p.active).length;
    const totalTricks = activePlayers >= 5 ? 5 : 3;
    status.textContent = `${tricksWon[player.name]}/${totalTricks}`;
    status.className = 'player-info round-result tricks-won-result';
  } else {
    status.textContent = 'Playing';
    status.className = 'player-info round-result playing-result';
  }
  
  col.append(propic, name, money, status, cardContainer);
  return col;
};

const _renderOpponentsUI = (players, localPlayerName, trickCards = [], tricksWon = null, dealerIndex = 0, roundResult = null, animateCard = null) => {
    clearElement(DOM.players);

    const container = createEl('div', 'container-fluid text-center');
    const row = createEl('div', 'row justify-content-center align-items-start');

    const config = { trickCards, tricksWon, dealerIndex, roundResult, animateCard };

    players.forEach((player, index) => {
        const playerCardElement = createPlayerCard(player, index, config);
        row.appendChild(playerCardElement);

        if (index === 3) {
            const wrapper = createEl('div', 'w-100 player-row-break');
            row.appendChild(wrapper);
        }
    });
    
    container.appendChild(row);
    DOM.players.appendChild(container);
};


// ===== UPDATE QUEUE =====
const updateOpponentsUI = (players, localPlayerName, trickCards = [], tricksWon = null, dealerIndex = 0, roundResult = null, animateCard = null) => {
  uiState.updateQueue.push({ players, localPlayerName, trickCards, tricksWon, dealerIndex, roundResult, animateCard });
  if (!uiState.isProcessing) processUiQueue();
};

const processUiQueue = async () => {
  uiState.isProcessing = true;
  
  while (uiState.updateQueue.length > 0) {
    const data = uiState.updateQueue.shift();
    _renderOpponentsUI(data.players, data.localPlayerName, data.trickCards, data.tricksWon, data.dealerIndex, data.roundResult, data.animateCard);
    
    if (data.animateCard && typeof skipAnimations !== 'undefined' && !skipAnimations) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  uiState.isProcessing = false;
};

// ===== ANIMATIONS =====
const animateCardToPlay = (playerName, card) => {
  return new Promise(resolve => {
    const cards = document.querySelectorAll('.playerCard');
    const target = Array.from(cards).find(el => 
      el.dataset.playerName === playerName && el.src.includes(card)
    );
    
    if (target) {
      target.classList.add('card-moving-to-play');
      setTimeout(() => {
        target.classList.remove('card-moving-to-play');
        resolve();
      }, 500);
    } else {
      resolve();
    }
  });
};

const animateCardsToWinner = (winnerName, trickCards) => {
  return new Promise(resolve => {
    if (typeof skipAnimations !== 'undefined' && skipAnimations) {
      resolve();
      return;
    }
    
    setTimeout(() => {
      const cards = document.querySelectorAll('.playerCard.played-card');
      const cols = document.querySelectorAll('.col-auto');
      
      let winnerEl = null;
      cols.forEach(col => {
        const nameDiv = col.querySelector('.player-info');
        if (nameDiv?.textContent === winnerName) winnerEl = col;
      });
      
      if (!winnerEl || cards.length === 0) {
        resolve();
        return;
      }
      
      const winnerRect = winnerEl.getBoundingClientRect();
      let completed = 0;
      
      cards.forEach(card => {
        const cardRect = card.getBoundingClientRect();
        const deltaX = winnerRect.left - cardRect.left;
        const deltaY = winnerRect.top - cardRect.top;
        
        card.style.setProperty('--winner-x', `${deltaX}px`);
        card.style.setProperty('--winner-y', `${deltaY}px`);
        card.classList.add('card-moving-to-winner');
        
        setTimeout(() => {
          completed++;
          if (completed === cards.length) resolve();
        }, 1000);
      });
    }, 100);
  });
};

const handleTrickAnimation = async (trickCards, winnerName, tricksWon) => {
  while (uiState.isProcessing) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  await animateCardsToWinner(winnerName, trickCards);
  
  const humanPlayerName = players[0].name;
  updateOpponentsUI(players, humanPlayerName, [], tricksWon || {}, dealerIndex);
};

// ===== ROUND RESULTS =====

const waitForResultsDisplay = async () => {
  await new Promise(resolve => setTimeout(resolve, 5000));
};

const createRoundResultsForUI = (roundResult, tricksWon, playingPlayers) => {
  const results = {};
  
  Object.keys(tricksWon).forEach(name => {
    const player = players.find(p => p.name === name);
    
    if (player && player.passed) {
      return;
    }
    
    if (roundResult.isSplit && roundResult.tiedPlayers?.includes(name)) {
      results[name] = 'Draw';
    } else if (roundResult.winner === name) {
      results[name] = 'Winner';
    } else if (roundResult.boorayPlayers?.includes(name)) {
      results[name] = 'Booray';
    } else {
      results[name] = 'Loser';
    }
  });
  
  return { results };
};

const showRoundResults = async (roundResult, tricksWon) => {
  const humanPlayerName = players[0].name;
  const playingPlayers = getPlayingPlayers();
  const resultsForUI = createRoundResultsForUI(roundResult, tricksWon, playingPlayers);
  
  updateOpponentsUI(players, humanPlayerName, [], tricksWon, dealerIndex, resultsForUI);
  await waitForResultsDisplay();
};

// ===== GAME END =====
const showGameEndUI = (winner) => {
  clearElement(DOM.actionButtons);
  
  const msg = createEl('div', 'alert alert-success text-center mb-2', {
    textContent: `${winner} WINS!`
  });
  Object.assign(msg.style, {
    fontWeight: 'bold',
    fontSize: '1.2rem',
    margin: '10px 0'
  });
  
  DOM.actionButtons.appendChild(msg);
  
  showDynamicButtons([
    {
      text: 'NEW GAME',
      class: 'btn-primary',
      onClick: () => resetGame()
    }
  ]);
};

let gameStarted = false;

window.addEventListener('beforeunload', (e) => {
    if (gameStarted) {
        e.preventDefault();
        e.returnValue = '';
    }
});


// ===== PAGE REFRESH =====
function initializeGame() {
    const playerNameInput = document.getElementById('player-name-input');
    let playerName = playerNameInput.value.trim();
    if (!playerName) {
        playerName = 'Player';
    }
    
    const gameModeSwitch = document.getElementById('game-mode-switch');
    const gameMode = gameModeSwitch.checked ? 'no_rules' : 'normal';
    
    document.getElementById('back-button').classList.remove('hidden');
    
    gameStarted = true;
    
    showGameUI();
    startGame(playerName, gameMode).catch(console.error);
}

function confirmNewGame() {
    location.reload();
}

