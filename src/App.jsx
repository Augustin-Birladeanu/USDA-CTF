import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import redteamLogo from './assets/redteam-logo.png';
import storymodeLogo from './assets/storymode-logo.png';
import endlessmodeLogo from './assets/endlessmode-logo.png';
import builder from './assets/builderbotbutton.webp';
import pvpmodeLogo from './assets/pvpmode-logo.png';
import PVPModeMultiplayer from './PVPModeMultiplayer';
import Leaderboard from './components/Leaderboard';
import GameOverModal from './components/GameOverModal';
import {HintSystem} from "./HintSystem.jsx";
import { CHARACTERS } from './data/characters.js';
import BotBuilder from './BotBuilder';
import { getDatabase, ref, get, set } from 'firebase/database';

// ============================================
// CONSTANTS
// ============================================
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

const getRandomPassword = () => PASSWORD_POOL[Math.floor(Math.random() * PASSWORD_POOL.length)];

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

// eslint-disable-next-line react-refresh/only-export-components
export const hintSystem = new HintSystem(CHARACTERS);

// ============================================
// COMPONENTS
// ============================================

const VulnerabilityModal = ({ isOpen, onClose, character }) => {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>
                        {typeof character.avatar === 'string' && character.avatar.includes('.png') ? (
                            <img src={character.avatar} alt={character.name} className="modal-header-avatar-img" />
                        ) : (
                            character.avatar
                        )}
                        {' '}{character.owasp}
                    </h2>
                    <p>OWASP Top 10 for LLM Applications v2.0</p>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <h3>Description</h3>
                    <p>{character.explanation}</p>
                    <h3>Why It's Dangerous</h3>
                    <p>{character.danger}</p>
                    <h3>Prevention</h3>
                    <p>{character.prevention}</p>
                    <h3>Tips for This Challenge</h3>
                    <p>{character.hint}</p>
                </div>
            </div>
        </div>
    );
};

const HintBox = ({ char }) => {
    const [showExplanation, setShowExplanation] = useState(false);
    const [currentHint, setCurrentHint] = useState("");
    const [showHint, setShowHint] = useState(false);

    const handleShowHint = () => {
        if (!char || !char.id) return;
        const nextHint = hintSystem.getNextHint(char.id);
        setCurrentHint(nextHint);
        setShowHint(true);
    };

    return (
        <div style={{ background: "#1e293b", padding: "16px", borderRadius: "8px", marginTop: "16px" }}>
            <button
                onClick={() => setShowExplanation(!showExplanation)}
                style={{
                    background: "#0891b2",
                    color: "white",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                    width: "100%",
                    marginBottom: "8px",
                }}
            >
                <span>📚</span> Learn About This Vulnerability
            </button>

            {showExplanation && (
                <div style={{
                    marginTop: "12px",
                    fontSize: "13px",
                    color: "#cbd5e1",
                    background: "#0f172a",
                    padding: "12px",
                    borderRadius: "4px",
                    borderLeft: "3px solid #0891b2",
                }}>
                    <h4 style={{ margin: "0 0 8px 0", color: "#0891b2" }}>
                        {char.owasp}: {char.vulnerability}
                    </h4>
                    <p style={{ margin: "0 0 8px 0", lineHeight: "1.6" }}>
                        {char.explanation}
                    </p>
                    <p style={{ margin: "0 0 8px 0", lineHeight: "1.6" }}>
                        <strong>Why it's dangerous:</strong> {char.danger}
                    </p>
                    <p style={{ margin: "0", lineHeight: "1.6" }}>
                        <strong>Prevention:</strong> {char.prevention}
                    </p>
                </div>
            )}

            <button
                onClick={handleShowHint}
                style={{
                    background: "#059669",
                    color: "white",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                    width: "100%",
                }}
            >
                <span>💡</span> Tactical Hint
            </button>

            {showHint && (
                <p style={{
                    marginTop: "12px",
                    fontSize: "14px",
                    color: "#cbd5e1",
                    background: "#0f172a",
                    padding: "12px",
                    borderRadius: "4px",
                    borderLeft: "3px solid #059669",
                }}>
                    {currentHint}
                </p>
            )}
        </div>
    );
};

const ChatMessage = ({ msg, char }) => {
    const isUser = msg.role === 'user';
    const isImage = typeof char.avatar === 'string' && (char.avatar.includes('.png') || char.avatar.includes('data:image'));

    return (
        <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
            {!isUser && (
                <div className="chat-avatar assistant-avatar">
                    {isImage ? (
                        <img src={char.avatar} alt={char.name} className="chat-avatar-img" />
                    ) : (
                        char.avatar
                    )}
                </div>
            )}
            <div className={`chat-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
                <p className="chat-author">{isUser ? 'You' : char.name}</p>
                <p className="chat-content">{msg.content}</p>
            </div>
            {isUser && (
                <div className="chat-avatar user-avatar">👤</div>
            )}
        </div>
    );
};

const PasswordGuesser = ({ passwordGuess, setPasswordGuess, handlePasswordGuess, levelComplete, guessMessage }) => {
    return (
        <div className="password-guesser">
            <p className="password-title">🔓 Password Guessing Area</p>
            <p className="password-subtitle">Extract the password through conversation, then enter it here</p>
            <div className="password-input-group">
                <input
                    type="text"
                    value={passwordGuess}
                    onChange={(e) => setPasswordGuess(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handlePasswordGuess()}
                    placeholder="Enter password..."
                    disabled={levelComplete}
                    className="password-input"
                />
                <button onClick={handlePasswordGuess} disabled={levelComplete} className="password-button">
                    Check
                </button>
            </div>
            {guessMessage && (
                <p className={`password-message ${guessMessage.includes('✅') ? 'success' : 'error'}`}>
                    {guessMessage}
                </p>
            )}
        </div>
    );
};

const CharacterCard = ({ char }) => {
    const isImage = typeof char.avatar === 'string' && (char.avatar.includes('.png') || char.avatar.includes('data:image'));
    return (
        <div className="character-card">
            <div className="character-avatar">
                {isImage ? (
                    <img src={char.avatar} alt={char.name} className="character-avatar-img" />
                ) : (
                    char.avatar
                )}
            </div>
            <h3 className="character-name">{char.name}</h3>
            <p className="character-role">{char.role}</p>
        </div>
    );
};

const LevelInfo = ({ char, attemptCount, levelComplete }) => {
    return (
        <div className="level-info">
            <h3 className="vulnerability-title">{char.vulnerability}</h3>
            <div className="level-details">
                <p>OWASP: {char.owasp}</p>
                <p>Difficulty: {char.difficulty}</p>
            </div>
            {attemptCount > 0 && !levelComplete && (
                <p className="attempt-count">Attempts: {attemptCount}</p>
            )}
        </div>
    );
};

const LevelComplete = ({ gameMode, currentLevel, nextLevel }) => {
    return (
        <div className="level-complete">
            <div className="complete-header">
                <span>🏆</span>
                <span>Password Cracked!</span>
            </div>
            <button onClick={nextLevel} className="next-level-button">
                {gameMode === 'story' && currentLevel < CHARACTERS.length - 1
                    ? 'Next Level →'
                    : gameMode === 'endless'
                        ? 'Next Boss →'
                        : '🎉 Complete!'}
            </button>
        </div>
    );
};

const ChatPanel = ({ char, chatHistory, isLoading, userInput, setUserInput, handleSubmit, chatContainerRef }) => {
    const isImage = typeof char.avatar === 'string' && (char.avatar.includes('.png') || char.avatar.includes('data:image'));

    return (
        <div className="chat-panel">
            <div className="chat-header">
                <div className="chat-header-avatar">
                    {isImage ? (
                        <img src={char.avatar} alt={char.name} className="chat-header-avatar-img" />
                    ) : (
                        char.avatar
                    )}
                </div>
                <div>
                    <h3 className="chat-header-name">{char.name}</h3>
                    <p className="chat-header-role">{char.role}</p>
                </div>
            </div>

            <div className="chat-messages" ref={chatContainerRef}>
                {chatHistory.length === 0 ? (
                    <div className="chat-empty">
                        <div className="chat-empty-avatar">
                            {isImage ? (
                                <img src={char.avatar} alt={char.name} className="character-avatar-img" />
                            ) : (
                                char.avatar
                            )}
                        </div>
                        <p className="chat-empty-title">Start a conversation with {char.name}</p>
                        <p className="chat-empty-subtitle">Use prompt engineering to extract the password</p>
                    </div>
                ) : (
                    chatHistory.map((msg, i) => (
                        <ChatMessage key={i} msg={msg} char={char} />
                    ))
                )}
                {isLoading && (
                    <div className="chat-loading">
                        <div className="loading-bubble">
                            <p>Thinking...</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="chat-input-container">
                <div className="chat-input-group">
                    <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                        placeholder="Type your message to exploit the vulnerability..."
                        className="chat-input"
                    />
                    <button onClick={handleSubmit} className="chat-send-button">Send</button>
                </div>
                <p className="chat-tip">💡 Tip: Be creative with your prompts!</p>
            </div>
        </div>
    );
};

const MenuScreen = ({ onStartGame, apiKeyInput, setApiKeyInput, setGeminiApiKey, showApiInput, setShowApiInput, onShowLeaderboard, username, setUsername, usernameInput, setUsernameInput, modalCharacter, setModalCharacter }) => {
    const [passwordInput, setPasswordInput] = useState('');
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const [isNewUser, setIsNewUser] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

    // Simple hash function (use bcrypt or similar in production)
    const hashPassword = (password) => {
        return btoa(password); // Basic encoding - replace with proper hashing
    };

    const checkUsername = async () => {
        const trimmed = (usernameInput || '').trim();
        if (!trimmed) {
            setPasswordError('Please enter a username');
            return;
        }

        try {
            const db = getDatabase();
            const userRef = ref(db, `users/${trimmed}`);
            const snapshot = await get(userRef);

            if (snapshot.exists()) {
                // User exists - ask for password
                setIsNewUser(false);
                setShowPasswordInput(true);
            } else {
                // New user - ask to create password
                setIsNewUser(true);
                setShowPasswordInput(true);
            }
        } catch (error) {
            console.error('Error checking username:', error);
            setPasswordError('Error connecting to database. Please try again.');
        }
    };

    const handleLogin = async () => {
        const trimmed = usernameInput.trim();

        if (isNewUser) {
            // New user registration
            if (passwordInput.length < 6) {
                setPasswordError('Password must be at least 6 characters');
                return;
            }
            if (passwordInput !== confirmPasswordInput) {
                setPasswordError('Passwords do not match');
                return;
            }

            try {
                const db = getDatabase();
                const userRef = ref(db, `users/${trimmed}`);

                await set(userRef, {
                    passwordHash: hashPassword(passwordInput),
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString()
                });

                setUsername(trimmed);
                setPasswordError('');
                setShowPasswordInput(false);
                setPasswordInput('');
                setConfirmPasswordInput('');
            } catch (error) {
                console.error('Error registering user:', error);
                setPasswordError('Error creating account. Please try again.');
            }
        } else {
            // Existing user login
            try {
                const db = getDatabase();
                const userRef = ref(db, `users/${trimmed}`);
                const snapshot = await get(userRef);

                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    if (userData.passwordHash === hashPassword(passwordInput)) {
                        // Update last login
                        await set(ref(db, `users/${trimmed}/lastLogin`), new Date().toISOString());

                        setUsername(trimmed);
                        setPasswordError('');
                        setShowPasswordInput(false);
                        setPasswordInput('');
                    } else {
                        setPasswordError('Incorrect password');
                    }
                } else {
                    setPasswordError('User not found');
                }
            } catch (error) {
                console.error('Error logging in:', error);
                setPasswordError('Error logging in. Please try again.');
            }
        }
    };

    const handleBackToUsername = () => {
        setShowPasswordInput(false);
        setPasswordInput('');
        setConfirmPasswordInput('');
        setPasswordError('');
    };

    return (
        <div className="menu-screen">
            <div className="menu-container">
                <div className="menu-header">
                    <div className="menu-title-group">
                        <img src={redteamLogo} alt="Red Team Logo" className="menu-icon" />
                        <h1 className="menu-title">AI Red Team CTF</h1>
                    </div>
                    <p className="menu-subtitle">OWASP Top 10 for LLMs 2025</p>
                    <p className="menu-description">USDA Cybersecurity Training</p>
                </div>

                {showApiInput ? (
                    <div className="api-key-box">
                        <h3>🔑 Enter Your Gemini API Key</h3>
                        <p>
                            Get your free API key from{' '}
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                                Google AI Studio
                            </a>
                        </p>
                        <div className="api-key-input-group">
                            <input
                                type="password"
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                placeholder="AIza..."
                                className="api-key-input"
                            />
                            <button
                                onClick={() => {
                                    setGeminiApiKey(apiKeyInput);
                                    setShowApiInput(false);
                                }}
                                className="api-key-button"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {!username && (
                            <div className="username-box">
                                {!showPasswordInput ? (
                                    <>
                                        <h3>Enter Your Username</h3>
                                        <div className="api-key-input-group">
                                            <input
                                                type="text"
                                                value={usernameInput}
                                                onChange={(e) => {
                                                    setUsernameInput(e.target.value);
                                                    setPasswordError('');
                                                }}
                                                onKeyPress={(e) => e.key === 'Enter' && checkUsername()}
                                                placeholder="Your name..."
                                                className="api-key-input"
                                            />
                                            <button
                                                onClick={checkUsername}
                                                className="api-key-button"
                                            >
                                                Continue
                                            </button>
                                        </div>
                                        {passwordError && !showPasswordInput && (
                                            <p style={{ color: '#ff3333', fontSize: '13px', marginTop: '8px' }}>
                                                {passwordError}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <h3>{isNewUser ? '🆕 Create New Account' : '🔐 Welcome Back!'}</h3>
                                        <p style={{ color: '#999999', fontSize: '13px', marginBottom: '12px' }}>
                                            {isNewUser
                                                ? `Create a password for ${usernameInput}`
                                                : `Enter your password for ${usernameInput}`
                                            }
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <input
                                                type="password"
                                                value={passwordInput}
                                                onChange={(e) => {
                                                    setPasswordInput(e.target.value);
                                                    setPasswordError('');
                                                }}
                                                onKeyPress={(e) => e.key === 'Enter' && !isNewUser && handleLogin()}
                                                placeholder="Password..."
                                                className="api-key-input"
                                            />
                                            {isNewUser && (
                                                <input
                                                    type="password"
                                                    value={confirmPasswordInput}
                                                    onChange={(e) => {
                                                        setConfirmPasswordInput(e.target.value);
                                                        setPasswordError('');
                                                    }}
                                                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                                                    placeholder="Confirm password..."
                                                    className="api-key-input"
                                                />
                                            )}
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={handleBackToUsername}
                                                    className="api-key-button"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #666, #444)',
                                                        flex: 1
                                                    }}
                                                >
                                                    Back
                                                </button>
                                                <button
                                                    onClick={handleLogin}
                                                    className="api-key-button"
                                                    style={{ flex: 2 }}
                                                >
                                                    {isNewUser ? 'Create Account' : 'Login'}
                                                </button>
                                            </div>
                                        </div>
                                        {passwordError && (
                                            <p style={{ color: '#ff3333', fontSize: '13px', marginTop: '8px' }}>
                                                {passwordError}
                                            </p>
                                        )}
                                        {isNewUser && (
                                            <p style={{ color: '#999999', fontSize: '12px', marginTop: '8px' }}>
                                                Password must be at least 6 characters
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                        {username && (
                            <div className="player-badge-fixed">Player: {username}</div>
                        )}

                        <div className="game-modes">
                            <button
                                className={`story-mode-button ${!username ? 'disabled' : ''}`}
                                onClick={() => username && onStartGame('story')}
                                disabled={!username}
                            >
                                <img src={storymodeLogo} alt="Story Mode" />
                            </button>

                            <button
                                className={`story-mode-button ${!username ? 'disabled' : ''}`}
                                onClick={() => username && onStartGame('endless')}
                                disabled={!username}
                            >
                                <img src={endlessmodeLogo} alt="Endless Mode" />
                            </button>

                            <button
                                className={`story-mode-button ${!username ? 'disabled' : ''}`}
                                onClick={() => username && onStartGame('pvp')}
                                disabled={!username}
                            >
                                <img src={pvpmodeLogo} alt="PvP Mode" />
                            </button>

                            <button
                                className={`story-mode-button ${!username ? 'disabled' : ''}`}
                                onClick={() => username && onStartGame('botbuilder')}
                                disabled={!username}
                            >
                                <img src={builder} alt="Bot Builder" />
                            </button>
                        </div>

                        <button
                            onClick={onShowLeaderboard}
                            className="leaderboard-menu-btn"
                            disabled={!username}
                        >
                            🏆 View Leaderboard
                        </button>

                        <div className="owasp-showcase">
                            <h3>
                                <a
                                    href="https://genai.owasp.org/llm-top-10/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="owasp-link"
                                >
                                    Learn more!
                                </a>
                            </h3>
                            <div className="owasp-grid">
                                {CHARACTERS.slice(0, 5).map(c => {
                                    const isImage = typeof c.avatar === 'string' && (c.avatar.includes('.png') || c.avatar.includes('data:image'));
                                    return (
                                        <div
                                            key={c.id}
                                            className="owasp-item"
                                            onClick={() => (c.id >= 1 && c.id <= 10) && setModalCharacter(c)}
                                            style={{ cursor: (c.id >= 1 && c.id <= 10) ? 'pointer' : 'default' }}
                                        >
                                            <div className="owasp-avatar">
                                                {isImage ? (
                                                    <img src={c.avatar} alt={c.owasp} className="owasp-avatar-img" />
                                                ) : (
                                                    c.avatar
                                                )}
                                            </div>
                                            <div className="owasp-code">{c.owasp}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="owasp-grid">
                                {CHARACTERS.slice(5, 10).map(c => {
                                    const isImage = typeof c.avatar === 'string' && (c.avatar.includes('.png') || c.avatar.includes('data:image'));
                                    return (
                                        <div
                                            key={c.id}
                                            className="owasp-item"
                                            onClick={() => (c.id >= 1 && c.id <= 10) && setModalCharacter(c)}
                                            style={{ cursor: (c.id >= 1 && c.id <= 10) ? 'pointer' : 'default' }}
                                        >
                                            <div className="owasp-avatar">
                                                {isImage ? (
                                                    <img src={c.avatar} alt={c.owasp} className="owasp-avatar-img" />
                                                ) : (
                                                    c.avatar
                                                )}
                                            </div>
                                            <div className="owasp-code">{c.owasp}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <VulnerabilityModal
                isOpen={modalCharacter !== null}
                onClose={() => setModalCharacter(null)}
                character={modalCharacter || CHARACTERS[0]}
            />
        </div>
    );
};

const GameScreen = ({ gameMode, handleGameModeChange, currentLevel, endlessBossLevel, endlessScore, username, char, chatHistory, isLoading, levelComplete, attemptCount, passwordGuess, setPasswordGuess, guessMessage, userInput, setUserInput, handleSubmit, handlePasswordGuess, nextLevel, resetConversation, chatContainerRef }) => {
    return (
        <div className="game-screen">
            {username && (
                <div className="player-badge-fixed">Player: {username}</div>
            )}
            <div className="game-container">
                <div className="game-header">
                    <h1>AI Red Team CTF</h1>
                    <p className="game-mode-label">
                        {gameMode === 'story' ? 'Story Mode' : `Endless Mode - Boss ${endlessBossLevel}`}
                    </p>
                    {gameMode === 'endless' && (
                        <p className="endless-score">Score: {endlessScore}</p>
                    )}
                    <button onClick={() => handleGameModeChange('menu')} className="back-button">
                        ← Back to Menu
                    </button>
                </div>

                <div className="game-grid">
                    <div className="left-panel">
                        <CharacterCard char={char} />
                        <div className="level-info-container">
                            <LevelInfo char={char} attemptCount={attemptCount} levelComplete={levelComplete} />
                            <PasswordGuesser
                                passwordGuess={passwordGuess}
                                setPasswordGuess={setPasswordGuess}
                                handlePasswordGuess={handlePasswordGuess}
                                levelComplete={levelComplete}
                                guessMessage={guessMessage}
                            />
                            {levelComplete && (
                                <LevelComplete gameMode={gameMode} currentLevel={currentLevel} nextLevel={nextLevel} />
                            )}
                        </div>
                        {char && <HintBox char={char} />}
                        <button onClick={resetConversation} className="reset-button">Reset Conversation</button>
                    </div>
                    <ChatPanel
                        char={char}
                        chatHistory={chatHistory}
                        isLoading={isLoading}
                        userInput={userInput}
                        setUserInput={setUserInput}
                        handleSubmit={handleSubmit}
                        chatContainerRef={chatContainerRef}
                    />
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN APP
// ============================================
export default function AIRedTeamCTF() {
    const [gameMode, setGameMode] = useState('menu');
    const [currentLevel, setCurrentLevel] = useState(0);
    const [chatHistory, setChatHistory] = useState([]);
    const [levelComplete, setLevelComplete] = useState(false);
    const [completedLevels, setCompletedLevels] = useState([]);
    const [attemptCount, setAttemptCount] = useState(0);
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [showApiInput, setShowApiInput] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [endlessScore, setEndlessScore] = useState(0);
    const [endlessBossLevel, setEndlessBossLevel] = useState(1);
    const [randomChar, setRandomChar] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [passwordGuess, setPasswordGuess] = useState('');
    const [guessMessage, setGuessMessage] = useState('');
    const [levelPasswords, setLevelPasswords] = useState({});
    const [showGameOverModal, setShowGameOverModal] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [previousGameMode, setPreviousGameMode] = useState(null);
    const [username, setUsername] = useState('');
    const [usernameInput, setUsernameInput] = useState('');
    const [modalCharacter, setModalCharacter] = useState(null);

    const chatContainerRef = useRef(null);

    const getCurrentCharacter = useCallback(() => {
        return gameMode === 'endless' ? (randomChar || CHARACTERS[0]) : CHARACTERS[currentLevel];
    }, [gameMode, randomChar, currentLevel]);

    const getCurrentPassword = useCallback(() => {
        const key = gameMode === 'endless' ? `endless_${endlessBossLevel}` : `story_${currentLevel}`;
        return levelPasswords[key] || '';
    }, [gameMode, endlessBossLevel, currentLevel, levelPasswords]);

    const handleSubmit = useCallback(async () => {
        if (!userInput || isLoading) return;

        const userMessage = { role: 'user', content: userInput };
        setChatHistory(prev => [...prev, userMessage]);
        setUserInput('');
        setIsLoading(true);

        const response = await GeminiService.callAPI(geminiApiKey, getCurrentCharacter(), getCurrentPassword(), chatHistory, userInput);

        setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
        setIsLoading(false);
        setAttemptCount(prev => prev + 1);
    }, [userInput, isLoading, geminiApiKey, chatHistory, getCurrentCharacter, getCurrentPassword]);

    const handlePasswordGuess = useCallback(() => {
        const password = getCurrentPassword();
        if (passwordGuess.trim().toUpperCase() === password.toUpperCase()) {
            setGuessMessage('✅ Correct! Password accepted!');
            setLevelComplete(true);

            if (gameMode === 'story' && !completedLevels.includes(currentLevel)) {
                setCompletedLevels(prev => [...prev, currentLevel]);
            } else if (gameMode === 'endless') {
                setEndlessScore(prev => prev + 1);
            }
            setPasswordGuess('');
        } else {
            setGuessMessage('❌ Incorrect password. Try again!');
            setTimeout(() => setGuessMessage(''), 3000);
        }
    }, [passwordGuess, getCurrentPassword, gameMode, currentLevel, completedLevels]);

    const nextLevel = useCallback(() => {
        if (gameMode === 'story' && currentLevel < CHARACTERS.length - 1) {
            const nextLevelIndex = currentLevel + 1;
            setCurrentLevel(nextLevelIndex);
            const key = `story_${nextLevelIndex}`;
            if (!levelPasswords[key]) {
                setLevelPasswords(prev => ({ ...prev, [key]: getRandomPassword() }));
            }
        } else if (gameMode === 'endless') {
            const nextBossLevel = endlessBossLevel + 1;
            setEndlessBossLevel(nextBossLevel);
            setRandomChar(CHARACTERS[Math.floor(Math.random() * 10)]);
            setLevelPasswords(prev => ({ ...prev, [`endless_${nextBossLevel}`]: getRandomPassword() }));
        }

        setChatHistory([]);
        setLevelComplete(false);
        setAttemptCount(0);
        setPasswordGuess('');
        setGuessMessage('');
    }, [gameMode, currentLevel, endlessBossLevel, levelPasswords]);

    const startGame = useCallback((mode) => {
        setShowGameOverModal(false);
        setGameMode(mode);
        setCurrentLevel(0);
        setChatHistory([]);
        setLevelComplete(false);
        setCompletedLevels([]);
        setAttemptCount(0);
        setEndlessScore(0);
        setEndlessBossLevel(1);
        setPasswordGuess('');
        setGuessMessage('');

        const passwords = mode === 'story' ? { 'story_0': getRandomPassword() } : { 'endless_1': getRandomPassword() };

        if (mode === 'endless') {
            setRandomChar(CHARACTERS[Math.floor(Math.random() * 10)]);
        }

        setLevelPasswords(passwords);
    }, []);

    const resetConversation = useCallback(() => {
        setChatHistory([]);
        setLevelComplete(false);
        setAttemptCount(0);
        setPasswordGuess('');
        setGuessMessage('');
    }, []);

    const handleGameModeChange = useCallback((newMode) => {
        if (previousGameMode === 'endless' && newMode === 'menu' && endlessScore > 0) {
            setShowGameOverModal(true);
        }
        setPreviousGameMode(newMode);
        setGameMode(newMode);
    }, [previousGameMode, endlessScore]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, isLoading]);

    useEffect(() => {
        if (gameMode !== 'menu') {
            setPreviousGameMode(gameMode);
        }
    }, [gameMode]);

    const character = getCurrentCharacter();

    if (gameMode === 'menu') {
        return (
            <>
                <MenuScreen
                    onStartGame={startGame}
                    apiKeyInput={apiKeyInput}
                    setApiKeyInput={setApiKeyInput}
                    setGeminiApiKey={setGeminiApiKey}
                    showApiInput={showApiInput}
                    setShowApiInput={setShowApiInput}
                    onShowLeaderboard={() => setShowLeaderboard(true)}
                    username={username}
                    setUsername={setUsername}
                    usernameInput={usernameInput}
                    setUsernameInput={setUsernameInput}
                    modalCharacter={modalCharacter}
                    setModalCharacter={setModalCharacter}
                />
                {showLeaderboard && (
                    <Leaderboard onClose={() => setShowLeaderboard(false)} />
                )}
                {showGameOverModal && (
                    <GameOverModal
                        score={endlessScore}
                        onClose={() => {
                            setShowGameOverModal(false);
                            setEndlessScore(0);
                        }}
                        onViewLeaderboard={() => {
                            setShowGameOverModal(false);
                            setShowLeaderboard(true);
                        }}
                    />
                )}
            </>
        );
    }

    if (gameMode === 'pvp') {
        return <PVPModeMultiplayer onBack={() => handleGameModeChange('menu')} geminiApiKey={geminiApiKey} username={username} />;
    }

    if (gameMode === 'botbuilder') {
        return <BotBuilder onBack={() => handleGameModeChange('menu')} geminiApiKey={geminiApiKey} username={username} />;
    }

    return (
        <GameScreen
            gameMode={gameMode}
            handleGameModeChange={handleGameModeChange}
            currentLevel={currentLevel}
            endlessBossLevel={endlessBossLevel}
            endlessScore={endlessScore}
            username={username}
            char={character}
            chatHistory={chatHistory}
            isLoading={isLoading}
            levelComplete={levelComplete}
            attemptCount={attemptCount}
            passwordGuess={passwordGuess}
            setPasswordGuess={setPasswordGuess}
            guessMessage={guessMessage}
            userInput={userInput}
            setUserInput={setUserInput}
            handleSubmit={handleSubmit}
            handlePasswordGuess={handlePasswordGuess}
            nextLevel={nextLevel}
            resetConversation={resetConversation}
            chatContainerRef={chatContainerRef}
        />
    );
}