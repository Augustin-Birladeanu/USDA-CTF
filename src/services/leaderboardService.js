import { 
  ref, 
  push, 
  query, 
  orderByChild, 
  limitToLast, 
  get,
  serverTimestamp 
} from 'firebase/database';
import { db } from '../firebase/config';

const LEADERBOARD_PATH = 'endlessLeaderboard';
const TOP_SCORES_LIMIT = 10;

/**
 * Submit a score to the leaderboard
 * @param {string} playerName - Name of the player
 * @param {number} score - Final score
 * @returns {Promise<string>} Key of the submitted score
 */
export async function submitScore(playerName, score) {
  try {
    if (!db) {
      throw new Error('Firebase not initialized. Please check your Firebase configuration.');
    }
    
    const leaderboardRef = ref(db, LEADERBOARD_PATH);
    const newScoreRef = push(leaderboardRef, {
      playerName: playerName.trim() || 'Anonymous',
      score: score,
      timestamp: serverTimestamp(),
      date: new Date().toISOString()
    });
    
    return newScoreRef.key;
  } catch (error) {
    console.error('Error submitting score:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to submit score. ';
    if (error.code === 'PERMISSION_DENIED') {
      errorMessage += 'Permission denied. Please check Realtime Database security rules.';
    } else if (error.code === 'UNAVAILABLE') {
      errorMessage += 'Database is unavailable. Please check your internet connection.';
    } else if (error.message.includes('Firebase not initialized')) {
      errorMessage = error.message;
    } else {
      errorMessage += error.message || 'Unknown error occurred.';
    }
    
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    throw enhancedError;
  }
}

/**
 * Get top scores from the leaderboard
 * @param {number} limitCount - Number of top scores to retrieve (default: 10)
 * @returns {Promise<Array>} Array of score objects sorted by score (descending)
 */
export async function getTopScores(limitCount = TOP_SCORES_LIMIT) {
  try {
    if (!db) {
      throw new Error('Firebase not initialized. Please check your Firebase configuration.');
    }
    
    const leaderboardRef = ref(db, LEADERBOARD_PATH);
    const q = query(
      leaderboardRef,
      orderByChild('score'),
      limitToLast(limitCount)
    );
    
    const snapshot = await get(q);
    const scores = [];
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      // Convert object to array and sort by score (descending)
      Object.keys(data).forEach((key) => {
        scores.push({
          id: key,
          ...data[key]
        });
      });
      
      // Sort by score descending (since we got ascending order, we reverse)
      scores.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    
    return scores;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to load leaderboard. ';
    if (error.code === 'PERMISSION_DENIED') {
      errorMessage += 'Permission denied. Please check Realtime Database security rules.';
    } else if (error.code === 'UNAVAILABLE') {
      errorMessage += 'Database is unavailable. Please check your internet connection.';
    } else if (error.code === 'PERMISSION_DENIED' && error.message.includes('index')) {
      errorMessage += 'Database index required. Please create an index for the "score" field in Firebase Console.';
    } else if (error.message.includes('Firebase not initialized')) {
      errorMessage = error.message;
    } else {
      errorMessage += error.message || 'Unknown error occurred.';
    }
    
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    throw enhancedError;
  }
}

/**
 * Check if a score qualifies for the leaderboard
 * @param {number} score - Score to check
 * @param {number} minScore - Minimum score to qualify (optional)
 * @returns {Promise<boolean>} True if score qualifies
 */
export async function qualifiesForLeaderboard(score, minScore = 0) {
  if (score < minScore) {
    return false;
  }
  
  try {
    const topScores = await getTopScores(TOP_SCORES_LIMIT);
    
    // If leaderboard has fewer than limit entries, always qualify
    if (topScores.length < TOP_SCORES_LIMIT) {
      return true;
    }
    
    // Check if score is higher than the lowest top score
    const lowestTopScore = topScores[topScores.length - 1].score;
    return score > lowestTopScore;
  } catch (error) {
    console.error('Error checking leaderboard qualification:', error);
    // On error, allow submission
    return true;
  }
}
