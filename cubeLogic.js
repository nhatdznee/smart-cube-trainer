// cubeLogic.js
export class Cube3D {
    constructor() {
        // Lấy thẻ twisty-player hiển thị 3D trên Web
        this.player = document.querySelector('twisty-player') || document.getElementById('cube-3d');
    }

    // Thực hiện bước xoay Real-time từ Rubik thật
    applyMove(move) {
        if (this.player && typeof this.player.experimentalAddMove === 'function') {
            this.player.experimentalAddMove(move);
        }
    }

    // TÍNH NĂNG MỚI: Reset Rubik 3D về trạng thái hoàn chỉnh (Solved State)
    resetToSolved() {
        if (this.player) {
            this.player.alg = ''; // Xóa toàn bộ chuỗi xoay dở dang
            console.log('🧹 Đã Reset mô hình Rubik 3D về trạng thái ban đầu.');
        }
    }
}
