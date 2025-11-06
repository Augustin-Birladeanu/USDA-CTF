import React, { useState } from 'react';
import { submitScore, qualifiesForLeaderboard } from '../services/leaderboardService';
import './GameOverModal.css';

const GameOverModal = ({ score, onClose, onViewLeaderboard }) => {
  const [playerName, setPlayerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [qualifies, setQualifies] = useState(null);

  React.useEffect(() => {
    // Check if score qualifies for leaderboard
    checkQualification();
  }, [score]);

  const checkQualification = async () => {
    try {
      const qualified = await qualifiesForLeaderboard(score);
      setQualifies(qualified);
    } catch (err) {
      console.error('Error checking qualification:', err);
      setQualifies(true); // Default to allowing submission on error
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!playerName.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await submitScore(playerName.trim() || 'Anonymous', score);
      setSubmitted(true);
    } catch (err) {
      // Use the specific error message from the service
      const errorMessage = err.message || 'Failed to submit score. Please try again.';
      setError(errorMessage);
      console.error('Submit error details:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="game-over-overlay">
      <div className="game-over-container">
        <div className="game-over-header">
          <h2>🎮 Game Over!</h2>
        </div>

        <div className="game-over-score">
          <div className="score-label">Final Score</div>
          <div className="score-value">{score}</div>
        </div>

        {qualifies === false ? (
          <div className="game-over-message">
            <p>Your score doesn't qualify for the leaderboard.</p>
            <p>Keep practicing to beat the top scores!</p>
          </div>
        ) : submitted ? (
          <div className="game-over-success">
            <p>✅ Score submitted successfully!</p>
            <button onClick={onViewLeaderboard} className="view-leaderboard-btn">
              View Leaderboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="score-submit-form">
            <label htmlFor="playerName">Enter your name:</label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name"
              maxLength={20}
              className="player-name-input"
              autoFocus
            />
            {error && <div className="error-message">{error}</div>}
            <div className="game-over-actions">
              <button
                type="submit"
                disabled={submitting || !playerName.trim()}
                className="submit-score-btn"
              >
                {submitting ? 'Submitting...' : 'Submit Score'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="skip-btn"
              >
                Skip
              </button>
            </div>
          </form>
        )}

        <div className="game-over-footer">
          <button onClick={onClose} className="close-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverModal;
