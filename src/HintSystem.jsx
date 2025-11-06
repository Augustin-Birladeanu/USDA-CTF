// HintSystem.jsx
export class HintSystem {
    constructor(levels) {
        this.levels = levels; // stores all characters/levels
        this.progress = {}; // tracks how many hints have been used per level
    }

    getNextHint(levelId) {
        const level = this.levels.find(l => l.id === levelId);
        if (!level || !Array.isArray(level.hint)) {
            return "No hints available for this challenge.";
        }

        if (!this.progress[levelId]) {
            this.progress[levelId] = 0;
        }

        const index = this.progress[levelId];
        if (index < level.hint.length) {
            const hint = level.hint[index];
            this.progress[levelId]++;
            return hint;
        } else {
            return "You've already seen all the hints for this level!";
        }
    }

    resetHints(levelId) {
        this.progress[levelId] = 0;
    }

    resetAllHints() {
        this.progress = {};
    }
}