import React, { useState, useEffect, useRef, useCallback } from 'react';
import './PVPMode.css';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, update, remove, onDisconnect, query, orderByChild, equalTo } from 'firebase/database';
import { CHARACTERS } from './data/characters.js';
import playerLogo from './assets/player-logo.png';
import opponentLogo from './assets/opponent-logo.png';
import noHintLogo from './assets/nohint-logo.png';
import timerLogo from './assets/timer-logo.png';
import pvpLogo from './assets/pvp-logo.png';
import winnerLogo from './assets/winner-logo.png';

// ============================================
// FIREBASE CONFIGURATION
// ============================================
const firebaseConfig = {
    apiKey: import.meta.env.VITE_APP_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_APP_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_APP_DATABASE_URL,
    projectId: import.meta.env.VITE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_APP_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_APP_MESSAGING_SENDER,
    appId: import.meta.env.VITE_APP_ID,
    measurementId: import.meta.env.VITE_APP_MEASUREMENT_ID,
};

// Initialize Firebase
let firebaseApp;
let database;

const initFirebase = () => {
    if (!firebaseApp) {
        const existingApps = getApps();
        if (existingApps.length > 0) {
            firebaseApp = getApp();
        } else {
            firebaseApp = initializeApp(firebaseConfig);
        }
        database = getDatabase(firebaseApp);
    }
    return database;
};

// ============================================
// PVP CONSTANTS
// ============================================
const TURN_TIME = 20;
const GUESS_TIME = 5;
const PVP_BOSS_PRESET_CHANCE = 0.2;
const WINS_NEEDED = 3;

const PASSWORD_POOL = [
    'STRAWBERRY', 'BLUEBERRY', 'WATERMELON', 'PINEAPPLE', 'TANGERINE',
    'BENJAMIN', 'ALEXANDER', 'NAPOLEON', 'CLEOPATRA', 'SHAKESPEARE',
    'TELESCOPE', 'MICROSCOPE', 'COMPASS', 'BINOCULARS', 'CALCULATOR',
    'MONGOOSE', 'ELEPHANT', 'PENGUIN', 'GIRAFFE', 'KANGAROO',
    'UMBRELLA', 'BACKPACK', 'SUITCASE', 'BRIEFCASE', 'WALLET',
    'KEYBOARD', 'MONITOR', 'PRINTER', 'SCANNER', 'HEADPHONES',
    'MERCURY', 'JUPITER', 'SATURN', 'NEPTUNE', 'VENUS',
    'COLUMBUS', 'GALILEO', 'EDISON', 'EINSTEIN', 'DARWIN',
    'DINOSAUR', 'MAMMOTH', 'TRILOBITE', 'PTERODACTYL', 'VELOCIRAPTOR',
    'MOUNTAIN', 'VOLCANO', 'GLACIER', 'CANYON', 'WATERFALL',
    'LIGHTHOUSE', 'CASTLE', 'PYRAMID', 'CATHEDRAL', 'TEMPLE',
    'DIAMOND', 'EMERALD', 'SAPPHIRE', 'RUBY', 'TOPAZ',
    'GUITAR', 'VIOLIN', 'TRUMPET', 'SAXOPHONE', 'HARMONICA',
    'PHOENIX', 'DRAGON', 'UNICORN', 'GRIFFIN', 'PEGASUS',
    'TORNADO', 'HURRICANE', 'BLIZZARD', 'AVALANCHE', 'EARTHQUAKE',
    'OCTOPUS', 'DOLPHIN', 'SEAHORSE', 'JELLYFISH', 'STARFISH',
    'CACTUS', 'BAMBOO', 'ORCHID', 'SUNFLOWER', 'LAVENDER',
    'TREASURE', 'ANCHOR', 'CAPTAIN', 'VOYAGE', 'PIRATE',
    'THUNDER', 'LIGHTNING', 'RAINBOW', 'METEOR', 'COMET',
    'MYSTERY', 'FORTUNE', 'MIRACLE', 'DESTINY', 'SERENITY'
];

const createPVPBoss = () => {
    const usePresetBoss = Math.random() < PVP_BOSS_PRESET_CHANCE;
    if (usePresetBoss) {
        const presetBoss = CHARACTERS[Math.floor(Math.random() * 10)];
        return { ...presetBoss, hasHint: true };
    } else {
        const baseChar = CHARACTERS[Math.floor(Math.random() * 10)];
        return {
            ...baseChar,
            name: `${baseChar.name} (PVP)`,
            hasHint: false,
            hint: undefined
        };
    }
};

const getRandomPassword = () => PASSWORD_POOL[Math.floor(Math.random() * PASSWORD_POOL.length)];

const reconstructBoss = (serializableBoss) => {
    if (!serializableBoss) return null;
    const originalChar = CHARACTERS.find(c => c.id === serializableBoss.id);
    return {
        ...serializableBoss,
        systemPrompt: originalChar ? originalChar.systemPrompt : (p) => `You are ${serializableBoss.name}. Password: ${p}.`,
        avatar: originalChar ? originalChar.avatar : serializableBoss.avatar
    };
};

// ============================================
// API SERVICE
// ============================================
class GeminiService {
    static async callAPI(apiKey, character, password, history, message) {
        if (!apiKey) return "Please enter your Gemini API key.";

        const historyText = history
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
            .join('\n\n');

        const prompt = `${character.systemPrompt(password)}\n\n${historyText}\n\nUser: ${message}\nAssistant:`;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey.trim()}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 200,
                            topP: 0.8,
                            topK: 10
                        }
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error('Invalid API response');
            }

            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            return `Error: ${error.message}. Please verify your API key`;
        }
    }
}

// ============================================
// COMPONENTS
// ============================================
const Timer = ({ time, isActive, label }) => (
    <div className={`pvp-timer ${isActive ? 'active' : ''}`}>
        <div className="timer-label">{label}</div>
        <div className="timer-value">{time}s</div>
    </div>
);

const ScoreBoard = ({ player1Score, player2Score, currentRound, player1Name, player2Name, myPlayerNumber }) => (
    <div className="score-board">
        <div className="score-item">
            <div className="player-icon">
                <img src={myPlayerNumber === 1 ? playerLogo : opponentLogo} alt="Player" />
            </div>
            <div className="player-name">{player1Name || 'Player 1'}</div>
            <div className="player-score">{player1Score}</div>
        </div>
        <div className="round-indicator">
            <div className="round-text">Round {currentRound}/5</div>
            <div className="round-subtitle">Best of 5</div>
        </div>
        <div className="score-item">
            <div className="player-icon">
                <img src={myPlayerNumber === 2 ? playerLogo : opponentLogo} alt="Player" />
            </div>
            <div className="player-name">{player2Name || 'Player 2'}</div>
            <div className="player-score">{player2Score}</div>
        </div>
    </div>
);

const ChatMessage = ({ msg, char, player1Name, player2Name, myPlayerNumber }) => {
    const isUser = msg.role === 'user';
    const playerNum = msg.player;

    return (
        <div className={`pvp-chat-message ${isUser ? 'user' : 'assistant'}`}>
            <div className="chat-avatar">
                {isUser ? (
                    <img src={playerNum === myPlayerNumber ? playerLogo : opponentLogo} alt="Player" />
                ) : (
                    shouldRenderAsImage(char.avatar) ? <img src={char.avatar} alt={char.name} /> : <span style={{ fontSize: '32px' }}>{char.avatar}</span>
                )}
            </div>
            <div className={`chat-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
                <p className="chat-author">
                    {isUser ? (playerNum === 1 ? (player1Name || 'Player 1') : (player2Name || 'Player 2')) : char.name}
                </p>
                <p className="chat-content">{msg.content}</p>
            </div>
        </div>
    );
};

const shouldRenderAsImage = (avatar) => {
    if (typeof avatar !== 'string') return true;
    if (avatar.includes('/') || avatar.startsWith('http') || avatar.startsWith('data:') || avatar.includes('.png')) return true;
    return false;
};

const CharacterDisplay = ({ char, showHint }) => (
    <div className="pvp-character-display">
        <div className="character-avatar-large">
            {shouldRenderAsImage(char.avatar) ? <img src={char.avatar} alt={char.name} /> : char.avatar}
        </div>
        <h3 className="character-name">{char.name}</h3>
        <p className="character-role">{char.role}</p>
        <div className="vulnerability-badge">{char.vulnerability}</div>
        {showHint && char.hasHint && char.hint && (
            <div className="hint-display">
                <div className="hint-icon">💡</div>
                <p className="hint-text">{Array.isArray(char.hint) ? char.hint[0] : char.hint}</p>
            </div>
        )}
        {!char.hasHint && (
            <div className="no-hint-badge">
                <img src={noHintLogo} alt="No Hint" style={{ width: '28px', height: '28px', marginRight: '8px', verticalAlign: 'middle' }} />
                No Hint - Expert Mode
            </div>
        )}
    </div>
);

// ============================================
// MAIN MULTIPLAYER PVP COMPONENT
// ============================================
export default function PVPModeMultiplayer({ onBack, geminiApiKey, username }) {
    const [gameState, setGameState] = useState('lobby');
    const [roomCode, setRoomCode] = useState('');
    const [roomCodeInput, setRoomCodeInput] = useState('');
    const [myPlayerNumber, setMyPlayerNumber] = useState(null);
    const [gameData, setGameData] = useState(null);
    const [opponentLeft, setOpponentLeft] = useState(false);
    const [isSearchingMatch, setIsSearchingMatch] = useState(false);

    const chatContainerRef = useRef(null);
    const gameRoomRef = useRef(null);
    const db = useRef(null);
    const disconnectRef = useRef(null);
    const matchmakingUnsubscribe = useRef(null);

    useEffect(() => {
        db.current = initFirebase();
    }, []);

    const setupDisconnectHandler = (playerNumber) => {
        if (!gameRoomRef.current) return;
        const playerConnectedField = playerNumber === 1 ? 'player1Connected' : 'player2Connected';
        const playerRef = ref(db.current, `rooms/${roomCode}/${playerConnectedField}`);
        disconnectRef.current = onDisconnect(playerRef);
        disconnectRef.current.set(false);
    };

    // ============================================
    // MATCHMAKING SYSTEM
    // ============================================
    const startMatchmaking = async () => {
        setIsSearchingMatch(true);

        const matchmakingRef = ref(db.current, 'matchmaking');

        // Listen for available matchmaking rooms
        matchmakingUnsubscribe.current = onValue(matchmakingRef, async (snapshot) => {
            const data = snapshot.val();

            if (data) {
                const availableRooms = Object.entries(data).filter(([id, room]) =>
                    room.status === 'waiting' && room.player1Name !== username
                );

                if (availableRooms.length > 0) {
                    // Join the first available room
                    const [matchId, matchData] = availableRooms[0];
                    await joinMatchmakingRoom(matchData.roomId);

                    // Remove from matchmaking queue
                    await remove(ref(db.current, `matchmaking/${matchId}`));

                    if (matchmakingUnsubscribe.current) {
                        matchmakingUnsubscribe.current();
                        matchmakingUnsubscribe.current = null;
                    }
                    setIsSearchingMatch(false);
                }
            }
        });

        // If no room found after listening, create one
        setTimeout(async () => {
            if (isSearchingMatch) {
                await createMatchmakingRoom();
            }
        }, 1000);
    };

    const createMatchmakingRoom = async () => {
        try {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            const boss = createPVPBoss();
            const password = getRandomPassword();

            const serializableBoss = {
                id: boss.id,
                name: boss.name,
                role: boss.role,
                avatar: typeof boss.avatar === 'string' ? boss.avatar : boss.avatar?.toString(),
                owasp: boss.owasp,
                vulnerability: boss.vulnerability,
                difficulty: boss.difficulty,
                hasHint: boss.hasHint
            };

            if (boss.hint !== undefined) {
                serializableBoss.hint = Array.isArray(boss.hint) ? boss.hint[0] : boss.hint;
            }

            const initialGameData = {
                roomId,
                currentPlayer: 1,
                player1Score: 0,
                player2Score: 0,
                currentRound: 1,
                currentBoss: serializableBoss,
                currentPassword: password,
                chatHistory: [],
                turnTimer: TURN_TIME,
                guessTimer: 0,
                isGuessingPhase: false,
                gameState: 'waiting',
                player1Connected: true,
                player2Connected: false,
                player1Name: username || 'Player 1',
                player2Name: null,
                lastUpdate: Date.now()
            };

            const roomRef = ref(db.current, `rooms/${roomId}`);
            await set(roomRef, initialGameData);

            // Add to matchmaking queue
            const matchmakingEntry = {
                roomId,
                player1Name: username || 'Player 1',
                status: 'waiting',
                createdAt: Date.now()
            };
            await push(ref(db.current, 'matchmaking'), matchmakingEntry);

            setRoomCode(roomId);
            setMyPlayerNumber(1);
            setGameState('searching');
            gameRoomRef.current = roomRef;
            setupDisconnectHandler(1);
        } catch (error) {
            console.error('Error creating matchmaking room:', error);
            setIsSearchingMatch(false);
            alert('Failed to start matchmaking. Please try again.');
        }
    };

    const joinMatchmakingRoom = async (roomId) => {
        const roomRef = ref(db.current, `rooms/${roomId}`);

        onValue(roomRef, (snapshot) => {
            const data = snapshot.val();

            if (data && !data.player2Connected) {
                update(roomRef, {
                    player2Connected: true,
                    player2Name: username || 'Player 2',
                    gameState: 'playing'
                });

                setRoomCode(roomId);
                setMyPlayerNumber(2);
                setGameState('playing');
                gameRoomRef.current = roomRef;
                setupDisconnectHandler(2);
            }
        }, { onlyOnce: true });
    };

    const cancelMatchmaking = async () => {
        setIsSearchingMatch(false);

        if (matchmakingUnsubscribe.current) {
            matchmakingUnsubscribe.current();
            matchmakingUnsubscribe.current = null;
        }

        // Remove from matchmaking queue
        const matchmakingRef = ref(db.current, 'matchmaking');
        onValue(matchmakingRef, async (snapshot) => {
            const data = snapshot.val();
            if (data) {
                for (const [id, match] of Object.entries(data)) {
                    if (match.roomId === roomCode) {
                        await remove(ref(db.current, `matchmaking/${id}`));
                        break;
                    }
                }
            }
        }, { onlyOnce: true });

        // Clean up room if created
        if (gameRoomRef.current) {
            await remove(gameRoomRef.current);
        }

        setGameState('lobby');
        setRoomCode('');
        setMyPlayerNumber(null);
    };

    // ============================================
    // ROOM MANAGEMENT (Private Rooms)
    // ============================================
    const createRoom = async () => {
        try {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            const boss = createPVPBoss();
            const password = getRandomPassword();

            const serializableBoss = {
                id: boss.id,
                name: boss.name,
                role: boss.role,
                avatar: typeof boss.avatar === 'string' ? boss.avatar : boss.avatar?.toString(),
                owasp: boss.owasp,
                vulnerability: boss.vulnerability,
                difficulty: boss.difficulty,
                hasHint: boss.hasHint
            };

            if (boss.hint !== undefined) {
                serializableBoss.hint = Array.isArray(boss.hint) ? boss.hint[0] : boss.hint;
            }

            const initialGameData = {
                roomId,
                currentPlayer: 1,
                player1Score: 0,
                player2Score: 0,
                currentRound: 1,
                currentBoss: serializableBoss,
                currentPassword: password,
                chatHistory: [],
                turnTimer: TURN_TIME,
                guessTimer: 0,
                isGuessingPhase: false,
                gameState: 'waiting',
                player1Connected: true,
                player2Connected: false,
                player1Name: username || 'Player 1',
                player2Name: null,
                lastUpdate: Date.now()
            };

            const roomRef = ref(db.current, `rooms/${roomId}`);
            await set(roomRef, initialGameData);

            setRoomCode(roomId);
            setMyPlayerNumber(1);
            setGameState('waiting');
            gameRoomRef.current = roomRef;
            setupDisconnectHandler(1);
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Failed to create room. Please try again.');
        }
    };

    const joinRoom = async () => {
        const roomId = roomCodeInput.trim().toUpperCase();

        if (!roomId) {
            alert('Please enter a room code!');
            return;
        }

        const roomRef = ref(db.current, `rooms/${roomId}`);

        onValue(roomRef, (snapshot) => {
            const data = snapshot.val();

            if (data && !data.player2Connected) {
                update(roomRef, {
                    player2Connected: true,
                    player2Name: username || 'Player 2',
                    gameState: 'playing'
                });

                setRoomCode(roomId);
                setMyPlayerNumber(2);
                setGameState('playing');
                gameRoomRef.current = roomRef;
                setupDisconnectHandler(2);
            } else if (!data) {
                alert('Room not found!');
            } else {
                alert('Room is full!');
            }
        }, { onlyOnce: true });
    };

    // ============================================
    // SYNC GAME STATE & DETECT DISCONNECTIONS
    // ============================================
    useEffect(() => {
        if (!gameRoomRef.current) return;

        const unsubscribe = onValue(gameRoomRef.current, (snapshot) => {
            const data = snapshot.val();

            if (data) {
                if (!data.chatHistory || !Array.isArray(data.chatHistory)) {
                    data.chatHistory = [];
                }

                setGameData(data);

                if (data.gameState === 'playing' && myPlayerNumber) {
                    const opponentConnected = myPlayerNumber === 1 ? data.player2Connected : data.player1Connected;

                    if (!opponentConnected) {
                        setOpponentLeft(true);
                        const winnerScore = myPlayerNumber === 1 ? 'player1Score' : 'player2Score';
                        update(gameRoomRef.current, {
                            [winnerScore]: WINS_NEEDED,
                            gameState: 'opponent_left'
                        });
                        setGameState('opponent_left');
                    }
                }

                if (data.gameState === 'playing' && (gameState === 'waiting' || gameState === 'searching')) {
                    setGameState('playing');
                    setIsSearchingMatch(false);
                }
            }
        });

        return () => unsubscribe();
    }, [gameRoomRef.current, gameState, myPlayerNumber]);

    // ============================================
    // TIMER SYNC
    // ============================================
    useEffect(() => {
        if (!gameData || gameState !== 'playing' || !gameRoomRef.current) return;

        const interval = setInterval(async () => {
            if (myPlayerNumber === 1) {
                const now = Date.now();
                const elapsed = Math.floor((now - gameData.lastUpdate) / 1000);

                if (gameData.isGuessingPhase) {
                    const newGuessTimer = Math.max(0, gameData.guessTimer - elapsed);

                    if (newGuessTimer <= 0) {
                        await update(gameRoomRef.current, {
                            currentPlayer: gameData.currentPlayer === 1 ? 2 : 1,
                            turnTimer: TURN_TIME,
                            guessTimer: 0,
                            isGuessingPhase: false,
                            lastUpdate: Date.now()
                        });
                    } else if (elapsed > 0) {
                        await update(gameRoomRef.current, {
                            guessTimer: newGuessTimer,
                            lastUpdate: now
                        });
                    }
                } else {
                    const newTurnTimer = Math.max(0, gameData.turnTimer - elapsed);

                    if (newTurnTimer <= 0) {
                        await update(gameRoomRef.current, {
                            currentPlayer: gameData.currentPlayer === 1 ? 2 : 1,
                            turnTimer: TURN_TIME,
                            lastUpdate: Date.now()
                        });
                    } else if (elapsed > 0) {
                        await update(gameRoomRef.current, {
                            turnTimer: newTurnTimer,
                            lastUpdate: now
                        });
                    }
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [gameData, gameState, myPlayerNumber]);

    // ============================================
    // GAME ACTIONS
    // ============================================
    const handleSubmit = async (userInput) => {
        if (!userInput || !gameData || gameData.isGuessingPhase) return;
        if (gameData.currentPlayer !== myPlayerNumber) return;

        const userMessage = {
            role: 'user',
            content: userInput,
            player: myPlayerNumber
        };

        const newHistory = [...(gameData.chatHistory || []), userMessage];
        await update(gameRoomRef.current, {
            chatHistory: newHistory
        });

        const fullBoss = reconstructBoss(gameData.currentBoss);

        const response = await GeminiService.callAPI(
            geminiApiKey,
            fullBoss,
            gameData.currentPassword,
            gameData.chatHistory || [],
            userInput
        );

        const aiMessage = { role: 'assistant', content: response };
        await update(gameRoomRef.current, {
            chatHistory: [...newHistory, aiMessage],
            isGuessingPhase: true,
            guessTimer: GUESS_TIME,
            lastUpdate: Date.now()
        });
    };

    const handlePasswordGuess = async (passwordGuess) => {
        if (!gameData || !gameData.isGuessingPhase) return;
        if (gameData.currentPlayer !== myPlayerNumber) return;

        if (passwordGuess.trim().toUpperCase() === gameData.currentPassword.toUpperCase()) {
            const winner = myPlayerNumber;
            const newP1Score = winner === 1 ? gameData.player1Score + 1 : gameData.player1Score;
            const newP2Score = winner === 2 ? gameData.player2Score + 1 : gameData.player2Score;

            if (newP1Score >= WINS_NEEDED || newP2Score >= WINS_NEEDED) {
                await update(gameRoomRef.current, {
                    player1Score: newP1Score,
                    player2Score: newP2Score,
                    gameState: 'game_end'
                });
                setGameState('game_end');
            } else {
                const boss = createPVPBoss();
                const password = getRandomPassword();

                const serializableBoss = {
                    id: boss.id,
                    name: boss.name,
                    role: boss.role,
                    avatar: typeof boss.avatar === 'string' ? boss.avatar : boss.avatar?.toString(),
                    owasp: boss.owasp,
                    vulnerability: boss.vulnerability,
                    difficulty: boss.difficulty,
                    hasHint: boss.hasHint
                };

                if (boss.hint !== undefined) {
                    serializableBoss.hint = Array.isArray(boss.hint) ? boss.hint[0] : boss.hint;
                }

                await update(gameRoomRef.current, {
                    player1Score: newP1Score,
                    player2Score: newP2Score,
                    currentRound: gameData.currentRound + 1,
                    currentPlayer: winner === 1 ? 2 : 1,
                    currentBoss: serializableBoss,
                    currentPassword: password,
                    chatHistory: [],
                    turnTimer: TURN_TIME,
                    guessTimer: 0,
                    isGuessingPhase: false,
                    lastUpdate: Date.now()
                });
            }
        } else {
            await update(gameRoomRef.current, {
                currentPlayer: gameData.currentPlayer === 1 ? 2 : 1,
                turnTimer: TURN_TIME,
                guessTimer: 0,
                isGuessingPhase: false,
                lastUpdate: Date.now()
            });
        }
    };

    const leaveRoom = async () => {
        if (disconnectRef.current) {
            disconnectRef.current.cancel();
        }

        if (gameRoomRef.current && myPlayerNumber) {
            const playerConnectedField = myPlayerNumber === 1 ? 'player1Connected' : 'player2Connected';
            await update(gameRoomRef.current, {
                [playerConnectedField]: false
            });

            if (gameState === 'lobby' || gameState === 'waiting' || gameState === 'searching') {
                await remove(gameRoomRef.current);
            }
        }

        setGameState('lobby');
        setRoomCode('');
        setMyPlayerNumber(null);
        setGameData(null);
        setOpponentLeft(false);
        setIsSearchingMatch(false);
    };

    // Auto-scroll chat
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [gameData?.chatHistory]);

    // ============================================
    // RENDER: LOBBY
    // ============================================
    if (gameState === 'lobby') {
        return (
            <div className="pvp-container">
                <div className="pvp-setup">
                    <h1 className="pvp-title">
                        <img src={pvpLogo} alt="PVP" style={{ width: '70px', height: '70px', verticalAlign: 'middle', marginRight: '12px' }} />
                        <span className="pvp-title-red">Multiplayer</span> <span className="pvp-title-white">PVP</span>
                    </h1>
                    <p className="pvp-subtitle">Challenge players in real-time prompt battles!</p>

                    <div className="pvp-mode-selector">
                        {/* Matchmaking Option */}
                        <div className="mode-card featured">
                            <div className="mode-header">
                                <span className="mode-icon">🎯</span>
                                <h3>Quick Match</h3>
                                <span className="featured-badge">Popular</span>
                            </div>
                            <p className="mode-description">
                                Get matched with an opponent instantly. Fast and competitive!
                            </p>
                            <button onClick={startMatchmaking} className="mode-button primary">
                                🔍 Find Opponent
                            </button>
                        </div>

                        {/* Private Room Option */}
                        <div className="mode-card">
                            <div className="mode-header">
                                <span className="mode-icon">🔒</span>
                                <h3>Private Room</h3>
                            </div>
                            <p className="mode-description">
                                Create a private room and share the code with a friend.
                            </p>
                            <button onClick={createRoom} className="mode-button">
                                ➕ Create Room
                            </button>
                        </div>

                        {/* Join Room Option */}
                        <div className="mode-card">
                            <div className="mode-header">
                                <span className="mode-icon">🚪</span>
                                <h3>Join Room</h3>
                            </div>
                            <p className="mode-description">
                                Enter a room code to join your friend's game.
                            </p>
                            <div className="join-room-form">
                                <input
                                    type="text"
                                    value={roomCodeInput}
                                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                                    placeholder="Enter code..."
                                    className="room-code-input"
                                    maxLength={6}
                                />
                                <button onClick={joinRoom} className="mode-button">
                                    Join
                                </button>
                            </div>
                        </div>
                    </div>

                    <button onClick={onBack} className="pvp-back-button">
                        ← Back to Menu
                    </button>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER: SEARCHING FOR MATCH
    // ============================================
    if (gameState === 'searching') {
        return (
            <div className="pvp-container">
                <div className="pvp-setup">
                    <div className="searching-animation">
                        <div className="search-spinner"></div>
                        <h1 className="searching-title">
                            <img src={timerLogo} alt="Timer" style={{ width: '40px', height: '40px', verticalAlign: 'middle', marginRight: '12px' }} />
                            Finding Opponent...
                        </h1>
                        <p className="searching-subtitle">Searching for a worthy challenger</p>
                        <div className="loading-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>

                    <div className="pvp-button-group">
                        <button onClick={cancelMatchmaking} className="pvp-back-button">
                            Cancel Search
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER: WAITING FOR PLAYER 2
    // ============================================
    if (gameState === 'waiting') {
        return (
            <div className="pvp-container">
                <div className="pvp-setup">
                    <h1 className="pvp-title">
                        <img src={timerLogo} alt="Timer" style={{ width: '40px', height: '40px', verticalAlign: 'middle', marginRight: '12px' }} />
                        Waiting for Player 2...
                    </h1>
                    <div className="room-code-display">
                        <p className="room-code-label">Share this code:</p>
                        <div className="room-code-box">{roomCode}</div>
                    </div>
                    <p className="waiting-instruction">Send this code to your friend to start the game!</p>

                    <div className="pvp-button-group">
                        <button onClick={leaveRoom} className="pvp-back-button">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER: OPPONENT LEFT
    // ============================================
    if (gameState === 'opponent_left') {
        return (
            <div className="pvp-container">
                <div className="pvp-game-end">
                    <div className="winner-announcement">
                        <div className="trophy-icon">
                            <img src={winnerLogo} alt="Winner" style={{ width: '150px', height: '150px' }} />
                        </div>
                        <h1>You Win!</h1>
                        <p style={{ fontSize: '24px', marginTop: '20px', color: '#fbbf24' }}>
                            Your opponent left the game
                        </p>
                        <p style={{ fontSize: '18px', marginTop: '10px' }}>
                            Victory by default!
                        </p>
                    </div>

                    <div className="pvp-button-group">
                        <button onClick={leaveRoom} className="pvp-back-button">
                            Back to Lobby
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER: GAME END
    // ============================================
    if (gameState === 'game_end' && gameData) {
        const winner = gameData.player1Score >= WINS_NEEDED ? 1 : 2;
        const winnerName = winner === 1 ? (gameData.player1Name || 'Player 1') : (gameData.player2Name || 'Player 2');
        return (
            <div className="pvp-container">
                <div className="pvp-game-end">
                    <div className="winner-announcement">
                        <div className="trophy-icon">
                            <img src={winnerLogo} alt="Winner" style={{ width: '150px', height: '150px' }} />
                        </div>
                        <h1>{winnerName} Wins!</h1>
                        <div className="final-score">
                            <div className="final-score-item">
                                <span>{gameData.player1Name || 'Player 1'}</span>
                                <span className="score-number">{gameData.player1Score}</span>
                            </div>
                            <div className="vs-divider">-</div>
                            <div className="final-score-item">
                                <span>{gameData.player2Name || 'Player 2'}</span>
                                <span className="score-number">{gameData.player2Score}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pvp-button-group">
                        <button onClick={leaveRoom} className="pvp-back-button">
                            Back to Lobby
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER: LOADING
    // ============================================
    if (!gameData) {
        return (
            <div className="pvp-container">
                <div className="pvp-setup">
                    <p>Loading game data...</p>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER: PLAYING GAME
    // ============================================
    return (
        <div className="pvp-container">
            <div className="pvp-game">
                <div className="pvp-header">
                    <button onClick={leaveRoom} className="pvp-back-small">← Leave</button>
                    <h2 className="pvp-mode-title">
                        <img src={pvpLogo} alt="PVP" style={{ width: '48px', height: '48px', verticalAlign: 'middle', marginRight: '8px' }} />
                        Room: {roomCode} | Player: {myPlayerNumber === 1 ? (gameData.player1Name || 'Player 1') : (gameData.player2Name || 'Player 2')}
                    </h2>
                </div>

                <ScoreBoard
                    player1Score={gameData.player1Score}
                    player2Score={gameData.player2Score}
                    currentRound={gameData.currentRound}
                    player1Name={gameData.player1Name}
                    player2Name={gameData.player2Name}
                    myPlayerNumber={myPlayerNumber}
                />

                <div className={`turn-indicator player-${gameData.currentPlayer}-turn`}>
                    <div className="turn-content">
                        {gameData.isGuessingPhase ? (
                            <>
                                <span className="turn-icon">🔐</span>
                                <span className="turn-text">
                                    {(gameData.currentPlayer === 1 ? (gameData.player1Name || 'Player 1') : (gameData.player2Name || 'Player 2'))}'s Guessing Time
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="turn-icon">
                                    <img src={gameData.currentPlayer === myPlayerNumber ? playerLogo : opponentLogo} alt="Player" />
                                </span>
                                <span className="turn-text">{(gameData.currentPlayer === 1 ? (gameData.player1Name || 'Player 1') : (gameData.player2Name || 'Player 2'))}'s Turn</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="pvp-game-grid">
                    <div className="pvp-left-panel">
                        {gameData.currentBoss && (
                            <CharacterDisplay
                                char={reconstructBoss(gameData.currentBoss)}
                                showHint={gameData.currentBoss.hasHint}
                            />
                        )}

                        {gameData.isGuessingPhase && gameData.currentPlayer === myPlayerNumber && (
                            <PasswordGuesserComponent onGuess={handlePasswordGuess} guessTimer={gameData.guessTimer} />
                        )}

                        {!gameData.isGuessingPhase ? (
                            <Timer time={gameData.turnTimer} isActive={true} label="Time to Ask Question" />
                        ) : (
                            <Timer time={gameData.guessTimer} isActive={true} label="Time to Guess Password" />
                        )}
                    </div>

                    <ChatPanelComponent
                        gameData={{
                            ...gameData,
                            currentBoss: reconstructBoss(gameData.currentBoss)
                        }}
                        myPlayerNumber={myPlayerNumber}
                        onSubmit={handleSubmit}
                        chatContainerRef={chatContainerRef}
                        player1Name={gameData.player1Name}
                        player2Name={gameData.player2Name}
                    />
                </div>
            </div>
        </div>
    );
}

// ============================================
// HELPER COMPONENTS
// ============================================
const PasswordGuesserComponent = ({ onGuess, guessTimer }) => {
    const [passwordGuess, setPasswordGuess] = useState('');

    return (
        <div className="pvp-password-guesser">
            <h4 className="guess-title">🔓 Enter Password</h4>
            <p className="priority-notice">
                <img src={timerLogo} alt="Timer" style={{ width: '20px', height: '20px', verticalAlign: 'middle', marginRight: '8px' }} />
                You have {guessTimer}s to guess
            </p>
            <div className="password-input-group">
                <input
                    type="text"
                    value={passwordGuess}
                    onChange={(e) => setPasswordGuess(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            onGuess(passwordGuess);
                            setPasswordGuess('');
                        }
                    }}
                    placeholder="Enter password..."
                    className="password-input"
                    autoFocus
                />
                <button
                    onClick={() => {
                        onGuess(passwordGuess);
                        setPasswordGuess('');
                    }}
                    className="password-button"
                >
                    Guess
                </button>
            </div>
        </div>
    );
};

const ChatPanelComponent = ({ gameData, myPlayerNumber, onSubmit, chatContainerRef, player1Name, player2Name }) => {
    const [userInput, setUserInput] = useState('');

    const handleSend = () => {
        if (userInput.trim()) {
            onSubmit(userInput);
            setUserInput('');
        }
    };

    if (!gameData || !gameData.currentBoss) {
        return (
            <div className="pvp-chat-panel">
                <div className="pvp-chat-messages">
                    <div className="chat-empty">
                        <p>Loading chat...</p>
                    </div>
                </div>
            </div>
        );
    }

    const reconstructedBoss = reconstructBoss(gameData.currentBoss);
    const chatHistory = Array.isArray(gameData.chatHistory) ? gameData.chatHistory : [];

    return (
        <div className="pvp-chat-panel">
            <div className="pvp-chat-header">
                <div className="chat-header-avatar">
                    {reconstructedBoss?.avatar && (shouldRenderAsImage(reconstructedBoss.avatar) ? <img src={reconstructedBoss.avatar} alt={reconstructedBoss.name} /> : reconstructedBoss.avatar)}
                </div>
                <div>
                    <h3 className="chat-header-name">{reconstructedBoss?.name}</h3>
                    <p className="chat-header-role">{reconstructedBoss?.role}</p>
                </div>
            </div>

            <div className="pvp-chat-messages" ref={chatContainerRef}>
                {chatHistory.length === 0 ? (
                    <div className="chat-empty">
                        <div className="chat-empty-avatar">
                            {reconstructedBoss?.avatar && (shouldRenderAsImage(reconstructedBoss.avatar) ? <img src={reconstructedBoss.avatar} alt={reconstructedBoss.name} /> : reconstructedBoss.avatar)}
                        </div>
                        <p className="chat-empty-title">{(gameData.currentPlayer === 1 ? (player1Name || 'Player 1') : (player2Name || 'Player 2'))}, start the conversation!</p>
                        <p className="chat-empty-subtitle">Extract the password from {reconstructedBoss?.name}</p>
                    </div>
                ) : (
                    chatHistory.map((msg, i) => (
                        <ChatMessage key={i} msg={msg} char={reconstructedBoss} player1Name={player1Name} player2Name={player2Name} myPlayerNumber={myPlayerNumber} />
                    ))
                )}
            </div>

            <div className="pvp-chat-input-container">
                <div className="chat-input-group">
                    <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={`${myPlayerNumber === 1 ? (player1Name || 'Player 1') : (player2Name || 'Player 2')}, type your prompt...`}
                        disabled={gameData.currentPlayer !== myPlayerNumber || gameData.isGuessingPhase}
                        className="chat-input"
                    />
                    <button
                        onClick={handleSend}
                        disabled={gameData.currentPlayer !== myPlayerNumber || gameData.isGuessingPhase}
                        className="chat-send-button"
                    >
                        Send
                    </button>
                </div>
                <p className="chat-tip">
                    {gameData.isGuessingPhase
                        ? '🔐 Guessing phase!'
                        : gameData.currentPlayer === myPlayerNumber
                            ? (
                                <>
                                    <img src={timerLogo} alt="Timer" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} />
                                    Your turn! {gameData.turnTimer}s remaining
                                </>
                            )
                            : (
                                <>
                                    <img src={timerLogo} alt="Timer" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} />
                                    Waiting for {gameData.currentPlayer === 1 ? (player1Name || 'Player 1') : (player2Name || 'Player 2')}...
                                </>
                            )}
                </p>
            </div>
        </div>
    );
};