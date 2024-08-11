$(function() {
    if ( !Detector.webgl ) {
        // メッセージを表示
        Detector.addGetWebGLMessage();
        // コンテンツを非表示にする
        alert("お使いのブラウザ/OSはWebGLに非対応です");
        return;
    }
    
});