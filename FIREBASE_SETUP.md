# Firebase Realtime Database Leaderboard Setup Guide

## Step 1: Enable Realtime Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **ai-pvp-game**
3. Click on **"Build"** → **"Realtime Database"** in the left sidebar
4. If you see **"Create Database"**, click it
5. Choose a location for your database (choose the closest to your users)
6. Choose **"Start in test mode"** (for development) or **"Start in locked mode"** (for production)
7. Click **"Enable"**

## Step 2: Set Up Realtime Database Security Rules

1. In Firebase Console, go to **"Build"** → **"Realtime Database"** → **"Rules"** tab
2. Replace the rules with the following:

```json
{
  "rules": {
    "endlessLeaderboard": {
      ".read": true,
      ".write": true,
      ".indexOn": ["score"]
    }
  }
}
```

3. Click **"Publish"**

**What these rules do:**
- `.read: true` - Allows anyone to read the leaderboard
- `.write: true` - Allows anyone to write scores
- `.indexOn: ["score"]` - Creates an index on the score field for faster queries

**Note:** These rules allow anyone to read and write. For production, you might want to add authentication or rate limiting.

## Step 3: Test the Connection

1. Open your browser's Developer Console (F12)
2. Try to load the leaderboard
3. Check the console for any error messages

## Common Issues

### Issue: "Permission denied"
**Solution:** 
- Check that your Realtime Database security rules allow read/write access (see Step 2)
- Make sure the rules are published (click "Publish" button)

### Issue: "Database is unavailable"
**Solution:** 
- Check your internet connection
- Verify Realtime Database is enabled in your Firebase project
- Check if Realtime Database is available in your region

### Issue: Still shows "Loading..."
**Solution:**
- Open browser console (F12) and check for errors
- Verify Realtime Database is created (Step 1)
- Verify security rules are published (Step 2)
- Check that the database path matches: `endlessLeaderboard`

### Issue: Scores not sorting correctly
**Solution:**
- Make sure the `.indexOn: ["score"]` is in your security rules (see Step 2)

## Database Structure

The leaderboard data will be stored in Realtime Database like this:

```
endlessLeaderboard
  ├── -Nxxxxxxxxxxxxx1
  │   ├── playerName: "Player1"
  │   ├── score: 10
  │   ├── timestamp: 1234567890
  │   └── date: "2024-01-01T12:00:00.000Z"
  ├── -Nxxxxxxxxxxxxx2
  │   ├── playerName: "Player2"
  │   ├── score: 5
  │   ├── timestamp: 1234567891
  │   └── date: "2024-01-01T12:01:00.000Z"
  └── ...
```

## Testing

After setup, you can test by:
1. Playing endless mode and getting a score
2. Clicking "Back to Menu" when you have a score > 0
3. Submitting your name and score
4. Viewing the leaderboard from the menu
5. Check Firebase Console → Realtime Database to see the data

## Production Considerations

For production, consider:
- Adding authentication to control who can submit scores
- Adding rate limiting to prevent spam
- Adding validation rules to ensure data integrity
- Consider using Firestore instead for more complex queries (though Realtime Database works great for leaderboards!)