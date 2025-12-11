// BOORAY CARD GAME

// === GAME STATE ===
let deck, discardPile = [], players = [], dealerIndex = 0;
let trumpCard, trumpSuit, pot = 0, currentAnte = 5, roundsCompleted = 0;
let initialActivePlayers = 0, firstDealerOfRound = null, currentRoundDealer = null;
let gameMode = 'normal';
let skipAnimations = false;

// === INPUT STATE ===
let waitingForPlayerInput = false, playerInputResolver = null, currentInputType = null;
let selectedCardsForDiscard = [], selectedCardForPlay = null, validCardsForPlay = [];

// === CORE GAME LOOP ===
async function startGame(playerName, mode = 'normal') {
  gameMode = mode;
  
  buildDeck();
  updateAnteUI(currentAnte);
  shuffleDeck();
  createPlayers(playerName);
  assignDealer();
  firstDealerOfRound = players[dealerIndex];
  currentRoundDealer = players[dealerIndex];
  initialActivePlayers = getActivePlayers().length;
  
  while (getActivePlayers().length > 1) {
    resetPlayersForNewRound();
    
    const activePlayers = getActivePlayers();
    if (activePlayers.length === 1) {
      return endGameSequence(activePlayers[0]);
    }
    
    displayActivePlayers(activePlayers);
    
    createPot();
    dealCardsToPlayers();
    dealTrump();
    await makePlayDecisions();
    
    const playingPlayers = getPlayingPlayers();
    
    if (playingPlayers.length === 0) {
      await showAllFoldedResults();
      
      if (!advanceRound()) return;
      continue;
    }
    
    if (await handleSinglePlayerPlaying()) {
      if (!advanceRound()) return;
      continue;
    }
    
    await handleDiscards();
    
    if (getPlayingPlayers().length < 2) {
      if (await handleSinglePlayerPlaying() || !advanceRound()) return;
      continue;
    }
    
    const tricksWon = await playTricks();
    const roundResult = determineWinner(tricksWon);
    handleAnteExemptions(roundResult, tricksWon); 
    await handlePayments(tricksWon);
    eliminateAllInPlayersAtEndOfRound(roundResult); 
    
    if (!advanceRound()) return;
  }
  
  const finalWinner = getActivePlayers()[0];
  if (finalWinner) endGameSequence(finalWinner);
}


function advanceRound() {
  const remaining = getActivePlayers();
  if (remaining.length === 1) {
    endGameSequence(remaining[0]);
    return false;
  }
  
  players.forEach(p => { if (p.active) p.allIn = false; });
  
  nextDealer();
  buildDeck();
  shuffleDeck();
  discardPile = [];
  return true;
}

function displayActivePlayers(activePlayers) {
}

// === DECK MANAGEMENT ===
function buildDeck() {
  const values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const suits = ["C", "D", "H", "S"];
  deck = [];
  suits.forEach(suit => values.forEach(val => deck.push(`${val}-${suit}`)));
}

function shuffleDeck() {
  for (let i = 0; i < deck.length; i++) {
    const j = Math.floor(Math.random() * deck.length);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function reshuffleDiscards() {
  if (discardPile.length === 0) return;
  
  const uniqueDiscards = [...new Set(discardPile)];
  
  deck.push(...uniqueDiscards);
  discardPile = [];
  shuffleDeck();
}

// === PLAYER MANAGEMENT ===
function createPlayers(playerName) {
  const opponentNames = ["Mary", "James", "Barbara", "John", "Emma", "Michael", "Robert"];
  
  players = [{
    name: playerName,
    cards: [],
    fiches: 500,
    active: true,
    passed: false,
    allIn: false,
    anteExempt: false,
    cardsToDraw: 0,
    propic: "Player.jpeg"
  }];
  
  for (let i = 0; i < 7; i++) {
    players.push({
      name: opponentNames[i],
      cards: [],
      fiches: 500,
      active: true,
      passed: false,
      allIn: false,
      anteExempt: false,
      cardsToDraw: 0,
      propic: `${opponentNames[i]}.jpeg`
    });
  }
}

function resetPlayersForNewRound() {
  skipAnimations = false;
  players.forEach(p => {
    if (p.fiches > 0) {
      p.active = true;
    } else if (p.fiches <= 0 && !p.anteExempt) {
      p.active = false;
    }

    p.passed = false;
    p.allIn = false;
    p.cardsToDraw = 0;
  });
}

function updatePlayerStatus() {
  players.forEach(p => {
    if (p.fiches <= 0 && p.active && !p.allIn && !p.anteExempt) {
      p.active = false;
    }
  });
}

function eliminateAllInPlayersAtEndOfRound(roundResult = null) {
  players.forEach(p => {
    if (p.active && p.fiches <= 0) {
      // If player tied for most tricks (draw), they survive even if all-in
      if (roundResult?.isSplit && roundResult.tiedPlayers?.includes(p.name)) {
        return;
      }
      
      // Eliminate if all-in
      if (p.allIn) {
        p.active = false;
      }
      // Eliminate if not ante exempt
      else if (!p.anteExempt) {
        p.active = false;
      }
    }
  });
}

function getActivePlayers() {
  updatePlayerStatus();
  return players.filter(p => p.active);
}

function getPlayingPlayers() {
  return getActivePlayers().filter(p => !p.passed);
}

function assignDealer() {
  const activePlayers = getActivePlayers();
  const randomIndex = Math.floor(Math.random() * activePlayers.length);
  dealerIndex = players.indexOf(activePlayers[randomIndex]);
}

function handleAnteExemptions(roundResult, tricksWon) {
  players.forEach(p => p.anteExempt = false);
  
  if (roundResult.boorayPlayers?.length > 0) {
    roundResult.boorayPlayers.forEach(name => {
      const player = players.find(p => p.name === name);
      if (player) {
        player.anteExempt = true;
      }
    });
  }
  
  if (roundResult.isSplit && roundResult.tiedPlayers) {
    roundResult.tiedPlayers.forEach(name => {
      const player = players.find(p => p.name === name);
      if (player) {
        player.anteExempt = true;
      }
    });
  }
}

async function handleSinglePlayerPlaying() {
  const playingPlayers = getPlayingPlayers();
  
  if (playingPlayers.length === 1) {
    const winner = playingPlayers[0];
    
    winner.fiches += pot;
    pot = 0;
    updatePotUI(pot);
    
    await showSinglePlayerWinResults(winner.name);
    
    eliminateAllInPlayersAtEndOfRound(null);
    players.forEach(p => { if (p.active) p.allIn = false; });
    
    return true;
  }
  
  return false;
}

async function showAllFoldedResults() {
  const humanPlayerName = players[0].name;
  const resultsForUI = { results: {} };
  
  getActivePlayers().forEach(p => {
    resultsForUI.results[p.name] = 'Folded';
  });
  
  updateOpponentsUI(players, humanPlayerName, [], null, dealerIndex, resultsForUI);
  await waitForResultsDisplay();
}

async function showSinglePlayerWinResults(winnerName) {
  const humanPlayerName = players[0].name;
  const resultsForUI = { results: {} };
  
  getActivePlayers().forEach(p => {
    if (p.name === winnerName) {
      resultsForUI.results[p.name] = 'Winner';
    } else if (p.passed) {
      resultsForUI.results[p.name] = 'Folded';
    }
  });
  
  updateOpponentsUI(players, humanPlayerName, [], null, dealerIndex, resultsForUI);
  await waitForResultsDisplay();
}

window.enableSkipMode = function() {
  skipAnimations = true;
  clearActionButtons();
};

// === POT & DEALING ===

function createPot() {
  const activePlayers = getActivePlayers();
  let totalAnteCollected = 0;
  
  updateAnteUI(currentAnte);
  
  activePlayers.forEach(p => {
    // console.log(`${p.name}: fiches=${p.fiches}, anteExempt=${p.anteExempt}, active=${p.active}`);
    
    if (p.anteExempt) {
      // console.log(`${p.name} is exempt from ante`);
      if (p.fiches <= 0) {
        p.allIn = true;
      } else {
        p.allIn = false;
      }
    } else {
      const anteToPay = Math.min(currentAnte, p.fiches);
      // console.log(`${p.name} paying ${anteToPay} ante`);
      
      p.fiches -= anteToPay;
      pot += anteToPay;
      totalAnteCollected += anteToPay;
      
      if (p.fiches <= 0) {
        p.allIn = true;
      } else {
        p.allIn = false;
      }
    }
  });
  
  // console.log(`Total pot after antes: ${pot}`);
  updatePotUI(pot);
}

function dealCardsToPlayers() {
  const activePlayers = getActivePlayers();
  const cardsPerPlayer = activePlayers.length < 5 ? 3 : 5;
  
  players.forEach(p => p.cards = []);
  
  const cardsNeeded = cardsPerPlayer * activePlayers.length + 1;
  if (deck.length < cardsNeeded) {
    // console.error('Not enough cards in deck!');
    reshuffleDiscards();
  }
  
  for (let i = 0; i < cardsPerPlayer; i++) {
    for (let j = 0; j < activePlayers.length; j++) {
      const dealerPlayerIndex = activePlayers.findIndex(p => p === players[dealerIndex]);
      const nextActivePlayerIndex = (dealerPlayerIndex + 1 + j) % activePlayers.length;
      const player = activePlayers[nextActivePlayerIndex];
      
      if (deck.length > 0) {
        player.cards.push(deck.pop());
      }
    }
  }
  
  const humanPlayer = players[0];
  if (humanPlayer) {
    document.getElementById('player-hand-section').classList.remove('hidden');
    updatePlayerHandUI(humanPlayer.cards);
  }
  updateOpponentsUI(players, humanPlayer.name, [], null, dealerIndex);
}

function dealTrump() {
  if (deck.length > 0) {
    trumpCard = deck.pop();
    trumpSuit = trumpCard.split("-")[1];
    updateTrumpCardUI(trumpCard);
  }
}

// === DECISION MAKING ===
async function makePlayDecisions() {
  const activePlayers = getActivePlayers();
  const humanPlayerName = players[0].name;
  const humanPlayer = players[0];
  
  if (!humanPlayer.active) {
    showSkipButton();
  }
  
  for (const player of activePlayers) {
    if (player.name === humanPlayerName) {
      if (player.allIn) {
        player.passed = false;
      } else {
        const decision = await waitForPlayerInput(`${player.name}, play this round?`, 'play_decision');
        
        player.passed = decision.toLowerCase() !== 'y';
        if (player.passed) {
          document.getElementById('player-hand-section').classList.add('hidden');
        }
      }
    } else {
      if (player.allIn) {
        player.passed = false;
      } else {
        player.passed = !playOrFold(player);
      }
    }
    
    updateOpponentsUI(players, humanPlayerName, [], null, dealerIndex);
  }
}

function playOrFold(player) {
  const percentage = calculatePlayDecisionWeight(player);
  const randomRoll = Math.floor(Math.random() * 101);
  const willPlay = randomRoll <= percentage;
  
  return willPlay;
}

function calculatePlayDecisionWeight(player) {
  const activePlayers = getActivePlayers();
  const cardsInHand = player.cards.length;
  const highCards = countHighCards(player.cards);
  const trumpCards = countTrumpCards(player.cards);
  
  const highCardsWeight = getHighCardsWeight(highCards, cardsInHand);
  const trumpCardsWeight = getTrumpCardsWeight(trumpCards, cardsInHand);
  const potFichesWeight = getPotFichesWeight(pot, player.fiches);
  const cardsPlayersWeight = getCardsPlayersWeight(cardsInHand, activePlayers.length);
  
  const totalWeight = highCardsWeight + trumpCardsWeight + potFichesWeight + cardsPlayersWeight;
  const percentage = Math.max(0, Math.min(100, 25 + totalWeight));
  
  return percentage;
}

function countHighCards(cards) {
  return cards.filter(c => ["A", "K", "Q", "J"].includes(c.split("-")[0])).length;
}

function countTrumpCards(cards) {
  return cards.filter(c => c.split("-")[1] === trumpSuit).length;
}

function getHighCardsWeight(highCards, totalCards) {
  const ratio = (highCards / totalCards) * 100;
  if (ratio === 0) return 0;
  if (ratio <= 35) return 10;
  if (ratio <= 45) return 20;
  if (ratio <= 70) return 40;
  return 50;
}

function getTrumpCardsWeight(trumpCards, totalCards) {
  const ratio = (trumpCards / totalCards) * 100;
  if (ratio === 0) return -20;
  if (ratio <= 35) return 25;
  if (ratio <= 45) return 50;
  if (ratio <= 70) return 100;
  return 1000;
}

function getPotFichesWeight(pot, playerFiches) {
  if (playerFiches === 0) return 1000;
  
  const ratio = (pot / playerFiches) * 100;
  if (ratio >= 100) return -15;
  if (ratio >= 80) return -10;
  if (ratio >= 50) return -5;
  if (ratio >= 30) return 0;
  if (ratio >= 20) return 25;
  if (ratio >= 15) return 50;
  if (ratio >= 10) return 75;
  if (ratio >= 5) return 90;
  return 100;
}

function getCardsPlayersWeight(cardsInHand, activePlayers) {
  const ratio = (cardsInHand / activePlayers) * 100;
  if (ratio <= 73) return -10;
  if (ratio <= 85) return 0;
  if (ratio <= 100) return 20;
  return 50;
}

// === DISCARD PHASE ===
async function handleDiscards() {
  const playingPlayers = getPlayingPlayers();
  const humanPlayerName = players[0].name;
  
  const passedPlayers = players.filter(p => p.passed && p.cards.length > 0);
  passedPlayers.forEach(p => {
    discardPile.push(...p.cards);
    p.cards = [];
  });
  
  for (const player of playingPlayers) {
    if (player.name === humanPlayerName) {
      await handlePlayerDiscardsImmediate(player);
    } else {
      discardWeakCardsImmediate(player);
    }
  }
}

async function handlePlayerDiscardsImmediate(player) {
  if (deck.length <= 5 && discardPile.length > 0) {
    reshuffleDiscards();
  }
  
  selectedCardsForDiscard = [];
  updatePlayerHandUIForDiscard(player.cards);
  showDiscardButton();
  
  const discardInput = await waitForPlayerInput("Select cards to discard and press Discard, or press Skip", 'discard');
  
  if (discardInput === 'skip' || selectedCardsForDiscard.length === 0) {
    clearActionButtons();
    updatePlayerHandUI(player.cards);
    return;
  }
  
  const cardsToDiscard = [];
  selectedCardsForDiscard.sort((a, b) => b - a).forEach(i => {
    cardsToDiscard.push(player.cards.splice(i, 1)[0]);
  });
  
  const cardsToReplace = cardsToDiscard.length;
  
  const newCards = [];
  for (let i = 0; i < cardsToReplace; i++) {
    if (deck.length === 0 && discardPile.length > 0) {
      reshuffleDiscards();
    }
    
    if (deck.length > 0) {
      const newCard = deck.pop();
      newCards.push(newCard);
    } else {
      break;
    }
  }
  
  player.cards.push(...newCards);
  discardPile.push(...cardsToDiscard);
  
  clearActionButtons();
  updatePlayerHandUI(player.cards);
}

async function handlePlayerDiscardsImmediate(player) {
  if (deck.length <= 5 && discardPile.length > 0) {
    reshuffleDiscards();
  }
  
  selectedCardsForDiscard = [];
  updatePlayerHandUIForDiscard(player.cards);
  showDiscardButton();
  
  const discardInput = await waitForPlayerInput("Select cards to discard and press Discard, or press Skip", 'discard');
  
  if (discardInput === 'skip' || selectedCardsForDiscard.length === 0) {
    clearActionButtons();
    updatePlayerHandUI(player.cards);
    return;
  }
  
  const cardsToDiscard = [];
  selectedCardsForDiscard.sort((a, b) => b - a).forEach(i => {
    cardsToDiscard.push(player.cards.splice(i, 1)[0]);
  });
  
  const cardsToReplace = cardsToDiscard.length;
  
  const newCards = [];
  for (let i = 0; i < cardsToReplace; i++) {
    if (deck.length === 0 && discardPile.length > 0) {
      reshuffleDiscards();
    }
    
    if (deck.length > 0) {
      const newCard = deck.pop();
      newCards.push(newCard);
    } else {
      break;
    }
  }
  
  player.cards.push(...newCards);
  discardPile.push(...cardsToDiscard);
  
  clearActionButtons();
  updatePlayerHandUI(player.cards);
}

function discardWeakCardsImmediate(player) {
  if (deck.length <= 5 && discardPile.length > 0) {
    reshuffleDiscards();
  }
  
  const cardsToDiscard = [];
  const cardsToKeep = [];
  
  player.cards.forEach(card => {
    const [value, suit] = card.split("-");
    if (isCardWeak(value, suit)) {
      cardsToDiscard.push(card);
    } else {
      cardsToKeep.push(card);
    }
  });
  
  if (cardsToDiscard.length > 0) {
    player.cards = cardsToKeep;
    
    const cardsToReplace = cardsToDiscard.length;
    
    for (let i = 0; i < cardsToReplace; i++) {
      if (deck.length === 0 && discardPile.length > 0) {
        reshuffleDiscards();
      }
      
      if (deck.length > 0) {
        player.cards.push(deck.pop());
      } else {
        break;
      }
    }
    
    discardPile.push(...cardsToDiscard);
  }
}
function isCardWeak(value, suit) {
  if (suit === trumpSuit) return false;
  return getCardNumericValue(value) <= 7;
}

function getCardNumericValue(value) {
  const valueMap = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 };
  return valueMap[value] || 0;
}

// === TRICK PLAYING ===
async function playTricks() {
  const playingPlayers = getPlayingPlayers();
  const tricksWon = {};
  
  playingPlayers.forEach(p => tricksWon[p.name] = 0);
  
  let leadPlayerIndex = findNextPlayingPlayer(dealerIndex);
  const totalTricks = playingPlayers.length > 0 ? playingPlayers[0].cards.length : 0;
  
  for (let trick = 1; trick <= totalTricks; trick++) {
    const { winningPlayer: trickWinner, trick: playedCardsOnTrick } = await playTrick(leadPlayerIndex, tricksWon);
    tricksWon[trickWinner.name]++;
    
    const trickForUI = playedCardsOnTrick.map(p => ({ playerName: p.player.name, card: p.card }));
    await handleTrickAnimation(trickForUI, trickWinner.name, tricksWon);
    
    leadPlayerIndex = players.indexOf(trickWinner);
  }
  
  return tricksWon;
}

async function playTrick(leadPlayerIndex, tricksWon) {
  const playingPlayers = getPlayingPlayers();
  const allCards = playingPlayers.flatMap(p => p.cards);
  const duplicates = allCards.filter((card, index) => allCards.indexOf(card) !== index);
  if (duplicates.length > 0) {
    // console.error('DUPLICATE CARDS DETECTED AT START OF TRICK:', duplicates);
    // console.error('Players with cards:', playingPlayers.map(p => ({ name: p.name, cards: p.cards })));
  }
  
  const trick = [];
  let leadSuit = null, highestCard = null, winningPlayer = null;
  const humanPlayerName = players[0].name;
  
  for (let i = 0; i < playingPlayers.length; i++) {
    const currentPlayerIndex = (playingPlayers.indexOf(players[leadPlayerIndex]) + i) % playingPlayers.length;
    const currentPlayer = playingPlayers[currentPlayerIndex];
    
    if (currentPlayer.cards.length === 0) {
      continue;
    }
    
    // console.log(`${currentPlayer.name} choosing card from:`, currentPlayer.cards);
    
    const playedCard = currentPlayer.name === humanPlayerName
      ? await chooseCardToPlayHuman(currentPlayer, leadSuit, highestCard, trick)
      : chooseCardToPlay(currentPlayer, leadSuit, highestCard, trick);
    
    if (playedCard === null) {
      continue;
    }
    
    // console.log(`${currentPlayer.name} played ${playedCard}`);
    
    const play = { player: currentPlayer, card: playedCard };
    trick.push(play);
    
    const cardIndexToRemove = currentPlayer.cards.indexOf(playedCard);
    if (cardIndexToRemove > -1) {
        currentPlayer.cards.splice(cardIndexToRemove, 1);
    } else {
        // console.error(`ERROR: Card ${playedCard} was NOT in ${currentPlayer.name}'s hand! Hand:`, currentPlayer.cards);
    }
    
    // console.log(`${currentPlayer.name} cards after removal:`, currentPlayer.cards);

    if (i === 0) {
      leadSuit = playedCard.split("-")[1];
      highestCard = playedCard;
      winningPlayer = currentPlayer;
    } else if (isCardHigher(playedCard, highestCard, leadSuit)) {
      highestCard = playedCard;
      winningPlayer = currentPlayer;
    }
    
    const trickForUI = trick.map(p => ({ playerName: p.player.name, card: p.card }));
    const animateCard = { playerName: currentPlayer.name, card: playedCard };
    
    updateOpponentsUI(players, humanPlayerName, trickForUI, tricksWon, dealerIndex, null, animateCard);
    await waitForCardAnimation();
  }
  
  return { winningPlayer, trick };
}

async function waitForCardAnimation() {
  if (skipAnimations) return;
  await new Promise(resolve => setTimeout(resolve, 600));
}

async function chooseCardToPlayHuman(player, leadSuit, highestCard, trick) {
  if (player.cards.length === 0) {
    // console.error(`Error: ${player.name} has no cards to play!`);
    return null;
  }
  
  validCardsForPlay = getValidCards(player.cards, leadSuit, highestCard, trick);
  selectedCardForPlay = null;
  
  updatePlayerHandUIForPlay(player.cards, validCardsForPlay, true);
  await waitForPlayerInput("Select a card to play", 'card_play');
  
  if (selectedCardForPlay !== null && selectedCardForPlay >= 0 && selectedCardForPlay < player.cards.length) {
    const selectedCard = player.cards[selectedCardForPlay];
    if (validCardsForPlay.includes(selectedCard)) {
      const remainingCards = player.cards.filter(c => c !== selectedCard);
      updatePlayerHandUIForPlay(remainingCards, [], false);
      return selectedCard;
    }
  }
  
  updatePlayerHandUIForPlay(player.cards, [], false);
  return player.cards[0];
}

function chooseCardToPlay(player, leadSuit, highestCard, trick) {
  if (player.cards.length === 0) {
    // console.error(`Error: ${player.name} has no cards to play!`);
    return null;
  }
  
  const validCards = getValidCards(player.cards, leadSuit, highestCard, trick);
  
  if (validCards.length === 0) {
    // console.error(`Error: ${player.name} has no valid cards to play!`);
    return player.cards[0];
  }
  
  if (validCards.length === 1) return validCards[0];
  
  return chooseCardStrategic(player, leadSuit, highestCard, trick, validCards);
}

function chooseCardStrategic(player, leadSuit, highestCard, trick, validCards) {
  if (!leadSuit) return chooseLeadCard(validCards);
  
  const winningCards = validCards.filter(c => isCardHigher(c, highestCard, leadSuit));
  
  if (winningCards.length > 0) {
    return getLowestWinningCard(winningCards, highestCard, leadSuit);
  } else {
    return getLowestCard(validCards);
  }
}

function chooseLeadCard(validCards) {
  const trumpCards = validCards.filter(c => c.split("-")[1] === trumpSuit);
  
  if (trumpCards.length > 0) {
    if (trumpCards.length === 1) return trumpCards[0];
    const sortedTrumps = sortCardsByValue(trumpCards);
    const middleIndex = Math.min(Math.floor(sortedTrumps.length * 0.6), sortedTrumps.length - 1);
    return sortedTrumps[middleIndex];
  }
  
  const sortedCards = sortCardsByValue(validCards);
  
  if (sortedCards.length >= 3) {
    return sortedCards[Math.floor(sortedCards.length * 0.7)];
  } else if (sortedCards.length === 2) {
    return sortedCards[0];
  }
  
  return sortedCards[0];
}

function getLowestWinningCard(winningCards, highestCard, leadSuit) {
  return winningCards.reduce((weakestWinner, card) => {
    if (isCardHigher(card, highestCard, leadSuit) && isCardHigher(weakestWinner, highestCard, leadSuit)) {
      return compareCardStrength(card, weakestWinner, leadSuit) < 0 ? card : weakestWinner;
    }
    return weakestWinner;
  });
}

function compareCardStrength(card1, card2, leadSuit) {
  const [value1, suit1] = card1.split("-");
  const [value2, suit2] = card2.split("-");
  
  const numValue1 = getCardNumericValue(value1);
  const numValue2 = getCardNumericValue(value2);
  
  const isTrump1 = suit1 === trumpSuit;
  const isTrump2 = suit2 === trumpSuit;
  
  if (isTrump1 && !isTrump2) return 1;
  if (!isTrump1 && isTrump2) return -1;
  
  if (numValue1 < numValue2) return -1;
  if (numValue1 > numValue2) return 1;
  
  return 0;
}

function sortCardsByValue(cards) {
  return cards.sort((a, b) => {
    const [valueA, suitA] = a.split("-");
    const [valueB, suitB] = b.split("-");
    
    const numValueA = getCardNumericValue(valueA);
    const numValueB = getCardNumericValue(valueB);
    
    const isTrumpA = suitA === trumpSuit;
    const isTrumpB = suitB === trumpSuit;
    
    if (isTrumpA && !isTrumpB) return 1;
    if (!isTrumpA && isTrumpB) return -1;
    
    return numValueA - numValueB;
  });
}

function getValidCards(hand, leadSuit, highestCard, trick) {
  if (gameMode === 'no_rules') return hand;
  if (!leadSuit) return hand;
  
  const sameSuitCards = hand.filter(c => c.split("-")[1] === leadSuit);
  if (sameSuitCards.length > 0) return sameSuitCards;
  
  const trumpCards = hand.filter(c => c.split("-")[1] === trumpSuit);
  if (trumpCards.length > 0) return trumpCards;
  
  return hand;
}

function isCardHigher(card1, card2, leadSuit) {
  if (!card1 || !card2) {
    // console.error("Error: comparing null/undefined cards");
    return false;
  }
  
  const [value1, suit1] = card1.split("-");
  const [value2, suit2] = card2.split("-");
  
  if (suit1 === trumpSuit && suit2 !== trumpSuit) return true;
  if (suit2 === trumpSuit && suit1 !== trumpSuit) return false;
  
  if (suit1 === suit2) {
    return getCardNumericValue(value1) > getCardNumericValue(value2);
  }
  
  if (suit1 === leadSuit && suit2 !== leadSuit) return true;
  if (suit2 === leadSuit && suit1 !== leadSuit) return false;
  
  return false;
}

function getLowestCard(cards) {
  if (cards.length === 0) {
    // console.error("Error: finding lowest card in empty array");
    return null;
  }
  
  return cards.reduce((lowest, card) => {
    const [value1] = lowest.split("-");
    const [value2] = card.split("-");
    return getCardNumericValue(value2) < getCardNumericValue(value1) ? card : lowest;
  });
}

function findNextPlayingPlayer(startIndex) {
  const playingPlayers = getPlayingPlayers();
  for (let i = 1; i <= players.length; i++) {
    const playerIndex = (startIndex + i) % players.length;
    if (playingPlayers.includes(players[playerIndex])) {
      return playerIndex;
    }
  }
  return startIndex;
}

// === WINNER & PAYMENTS ===
function determineWinner(tricksWon) {
  const maxTricks = Math.max(...Object.values(tricksWon));
  const winners = Object.entries(tricksWon).filter(([name, tricks]) => tricks === maxTricks);
  
  if (winners.length === 1) {
    return {
      winner: winners[0][0],
      isSplit: false,
      boorayPlayers: getBoorayPlayers(tricksWon)
    };
  } else {
    return {
      winner: null,
      isSplit: true,
      tiedPlayers: winners.map(w => w[0]),
      boorayPlayers: getBoorayPlayers(tricksWon)
    };
  }
}

function getBoorayPlayers(tricksWon) {
  return Object.entries(tricksWon)
    .filter(([name, tricks]) => {
      const player = players.find(p => p.name === name);
      return tricks === 0 && player && !player.passed;
    })
    .map(([name]) => name);
}

async function handlePayments(tricksWon) {
  const result = determineWinner(tricksWon);
  const potBeforePayments = pot;
  
  await showRoundResults(result, tricksWon);
  
  if (result.boorayPlayers.length > 0) {
    const boorayPenalty = potBeforePayments;
    
    result.boorayPlayers.forEach(name => {
      const player = players.find(p => p.name === name);
      const penaltyToPay = Math.min(boorayPenalty, player.fiches);
      
      player.fiches -= penaltyToPay;
      pot += penaltyToPay;
    });
  }
  
  if (!result.isSplit && result.winner) {
    const winnerPlayer = players.find(p => p.name === result.winner);
    winnerPlayer.fiches += potBeforePayments;
    pot = pot - potBeforePayments;
    if (pot < 0) pot = 0;
  }
}

function nextDealer() {
  const activePlayers = getActivePlayers();
  const previousDealer = players[dealerIndex];
  const previousDealerIndexInActive = activePlayers.findIndex(p => p === previousDealer);
  
  const nextDealerIndexInActive = (previousDealerIndexInActive + 1) % activePlayers.length;
  const nextDealerPlayer = activePlayers[nextDealerIndexInActive];
  
  dealerIndex = players.indexOf(nextDealerPlayer);
  
  if (firstDealerOfRound && !firstDealerOfRound.active) {
      firstDealerOfRound = nextDealerPlayer;
  }

  if (nextDealerPlayer === firstDealerOfRound) {
    roundsCompleted++;
    currentAnte *= 2;
    updateAnteUI(currentAnte);
  }
}

// === INPUT HANDLING ===
function waitForPlayerInput(message, inputType) {
  return new Promise(resolve => {
    waitingForPlayerInput = true;
    playerInputResolver = resolve;
    currentInputType = inputType;
    
    if (inputType === 'play_decision') {
      showPlayDecisionButtons();
    }
  });
}

window.playerInput = function(input) {
  if (!waitingForPlayerInput || !playerInputResolver) {
    return;
  }
  
  waitingForPlayerInput = false;
  const resolver = playerInputResolver;
  playerInputResolver = null;
  resolver(input);
};

window.selectCardForDiscard = function(cardIndex) {
  const index = selectedCardsForDiscard.indexOf(cardIndex);
  if (index > -1) {
    selectedCardsForDiscard.splice(index, 1);
  } else {
    selectedCardsForDiscard.push(cardIndex);
  }
  
  const humanPlayer = players.find(p => p.name === players[0].name);
  if (humanPlayer) {
    updatePlayerHandUIForDiscard(humanPlayer.cards);
  }
};

window.selectCardForPlay = function(cardIndex) {
  const humanPlayer = players.find(p => p.name === players[0].name);
  if (humanPlayer && humanPlayer.cards[cardIndex] && validCardsForPlay.includes(humanPlayer.cards[cardIndex])) {
    selectedCardForPlay = cardIndex;
    updatePlayerHandUIForPlay(humanPlayer.cards, validCardsForPlay);
  }
};

window.processDiscard = function() {
  if (waitingForPlayerInput && currentInputType === 'discard' && playerInputResolver) {
    waitingForPlayerInput = false;
    const resolver = playerInputResolver;
    playerInputResolver = null;
    resolver('discard_selected');
  }
};

window.skipDiscard = function() {
  if (waitingForPlayerInput && currentInputType === 'discard' && playerInputResolver) {
    selectedCardsForDiscard = [];
    waitingForPlayerInput = false;
    const resolver = playerInputResolver;
    playerInputResolver = null;
    resolver('skip');
  }
};

window.playSelectedCard = function() {
  if (waitingForPlayerInput && currentInputType === 'card_play' && playerInputResolver && selectedCardForPlay !== null) {
    waitingForPlayerInput = false;
    const resolver = playerInputResolver;
    playerInputResolver = null;
    resolver('card_selected');
  }
};

// === GAME END ===
function resetGame() {
  deck = [];
  discardPile = [];
  players = [];
  dealerIndex = 0;
  trumpCard = null;
  trumpSuit = null;
  pot = 0;
  currentAnte = 5;
  roundsCompleted = 0;
  initialActivePlayers = 0;
  firstDealerOfRound = null;
  currentRoundDealer = null;
  gameMode = 'normal';
  
  waitingForPlayerInput = false;
  playerInputResolver = null;
  currentInputType = null;
  selectedCardsForDiscard = [];
  selectedCardForPlay = null;
  validCardsForPlay = [];
  
  updatePotUI(0);
  updateAnteUI(5);
  updateTrumpCardUI('');
  
  const playerHandSection = document.getElementById('player-hand-section');
  if (playerHandSection) playerHandSection.innerHTML = '';
  
  const playersSectionContainer = document.getElementById('players-section-container');
  if (playersSectionContainer) playersSectionContainer.innerHTML = '';
  
  showPreGameUI();
}

function endGameSequence(finalWinner) {
  if (pot > 0) {
    finalWinner.fiches += pot;
    pot = 0;
  }
  
  updatePotUI(0);
  updateAnteUI(0);
  updateTrumpCardUI('');
  
  showGameEndUI(finalWinner.name);
  
  const humanPlayerName = players.length > 0 ? players[0].name : 'Player1';
  const finalResultsForUI = {
    results: {
      [finalWinner.name]: 'Winner'
    }
  };
  
  updateOpponentsUI(players, humanPlayerName, [], null, dealerIndex, finalResultsForUI);
}