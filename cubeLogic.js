// cubeLogic.js
export class CubeTracker {
    constructor() {
        this.isSolving = false;
        this.startTime = 0;
        this.endTime = 0;
        this.moves = 0;
        this.idleTime = 0;
        this.lastMoveTime = 0;
        this.phase = 'IDLE'; // IDLE -> CROSS -> F2L -> OLL -> PLL -> SOLVED
        this.splits = { cross: 0, f2l: 0, oll: 0, pll: 0 };
    }

    startTimer() {
        this.isSolving = true;
        this.startTime = performance.now();
        this.lastMoveTime = this.startTime;
        this.moves = 0;
        this.idleTime = 0;
        this.phase = 'CROSS';
    }

    stopTimer() {
        this.isSolving = false;
        this.endTime = performance.now();
        this.phase = 'SOLVED';
        return this.getFinalTime();
    }

    registerMove(wcaMove, cubeState) {
        if (!this.isSolving) this.startTimer();
        
        this.moves++;
        const now = performance.now();
        
        // Tính khoảng thời gian "chết" (Pauses) để đo Fluency
        const timeSinceLastMove = now - this.lastMoveTime;
        if (timeSinceLastMove > 500) { // Nếu ngừng xoay quá 0.5s bị tính là pause
            this.idleTime += timeSinceLastMove;
        }
        this.lastMoveTime = now;

        this.checkCFOPPhase(cubeState, now);
    }

    // Tư duy thám tử: Định vị trạng thái của khối dựa vào chuỗi Kociemba hoặc Kpuzzle state
    checkCFOPPhase(cubeState, now) {
        const timeElapsed = ((now - this.startTime) / 1000).toFixed(2);

        // Giả lập logic kiểm tra trạng thái CFOP (cần đối chiếu với Kpuzzle của cubing.js)
        if (this.phase === 'CROSS' && this.isCrossSolved(cubeState)) {
            this.splits.cross = timeElapsed;
            this.phase = 'F2L';
        } else if (this.phase === 'F2L' && this.isF2LSolved(cubeState)) {
            this.splits.f2l = timeElapsed - this.splits.cross;
            this.phase = 'OLL';
        } else if (this.phase === 'OLL' && this.isOLLSolved(cubeState)) {
            this.splits.oll = (timeElapsed - this.splits.cross - this.splits.f2l).toFixed(2);
            this.phase = 'PLL';
        } else if (this.phase === 'PLL' && this.isCubeSolved(cubeState)) {
            this.splits.pll = (timeElapsed - this.splits.cross - this.splits.f2l - this.splits.oll).toFixed(2);
            this.stopTimer();
        }
    }

    getStats() {
        const totalSeconds = (this.lastMoveTime - this.startTime) / 1000;
        const tps = totalSeconds > 0 ? (this.moves / totalSeconds).toFixed(2) : 0;
        // Fluency = (Tổng thời gian - Thời gian chết) / Tổng thời gian
        const totalMs = this.lastMoveTime - this.startTime;
        const fluency = totalMs > 0 ? (((totalMs - this.idleTime) / totalMs) * 100).toFixed(0) : 100;

        return { tps, turns: this.moves, fluency };
    }

    getFinalTime() {
        return ((this.endTime - this.startTime) / 1000).toFixed(3);
    }

    // Các hàm kiểm tra trạng thái (Placeholder cho logic thuật toán Kpuzzle)
    isCrossSolved(state) { /* Logic kiểm tra 4 cạnh đáy */ return false; }
    isF2LSolved(state) { /* Logic kiểm tra 2 layer đầu */ return false; }
    isOLLSolved(state) { /* Logic kiểm tra mặt vàng */ return false; }
    isCubeSolved(state) { /* Logic kiểm tra hoàn thành */ return false; }
}