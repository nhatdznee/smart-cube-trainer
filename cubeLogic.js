// cubeLogic.js
export class Cube3D {
    constructor() {
        // Lấy thẻ twisty-player từ HTML
        this.player = document.querySelector('twisty-player') || document.getElementById('cube-3d');
    }

    applyMove(move) {
        if (this.player && typeof this.player.experimentalAddMove === 'function') {
            this.player.experimentalAddMove(move);
        }
    }

    resetToSolved() {
        if (this.player) {
            this.player.alg = '';
        }
    }
}
