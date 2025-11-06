import React, { useState, useEffect } from 'react';
import { getTopScores } from '../services/leaderboardService';
import './Leaderboard.css';

const Leaderboard = ({ onClose }) => {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const topScores = await getTopScores(10);
      setScores(topScores);
    } catch (err) {
      // Use the specific error message from the service
      const errorMessage = err.message || 'Failed to load leaderboard. Please check your Firebase connection.';
      setError(errorMessage);
      console.error('Leaderboard error details:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    // Handle Realtime Database timestamp (can be a number or object)
    let date;
    if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      // Firestore timestamp (fallback)
      date = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return 'N/A';
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRankIcon = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}.`;
  };

  return (
    <div className="leaderboard-overlay">
      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <h2>🏆 Endless Mode Leaderboard</h2>
          <button onClick={onClose} className="leaderboard-close-btn">✕</button>
        </div>

        {loading ? (
          <div className="leaderboard-loading">
            <p>Loading leaderboard...</p>
          </div>
        ) : error ? (
          <div className="leaderboard-error">
            <p>{error}</p>
            <button onClick={loadLeaderboard} className="retry-button">
              Retry
            </button>
          </div>
        ) : scores.length === 0 ? (
          <div className="leaderboard-empty">
            <p>No scores yet. Be the first to make it to the leaderboard!</p>
          </div>
        ) : (
          <>
            <div className="leaderboard-list">
              {scores.map((entry, index) => (
                <div key={entry.id} className={`leaderboard-entry ${index < 3 ? 'top-three' : ''}`}>
                  <div className="leaderboard-rank">{getRankIcon(index)}</div>
                  <div className="leaderboard-player">
                    <div className="leaderboard-name">{entry.playerName}</div>
                    <div className="leaderboard-date">{formatDate(entry.timestamp)}</div>
                  </div>
                  <div className="leaderboard-score">{entry.score}</div>
                </div>
              ))}
            </div>
            <button onClick={loadLeaderboard} className="refresh-button">
              🔄 Refresh
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
