// スクロール位置も考慮したcanvas要素の座標
var getElementPosition = function (elem){
    var position = elem.getBoundingClientRect();
    return {
        left: window.scrollX + position.left,
        top: window.scrollY + position.top
    }
}

var toast = new Toast();

var drawProgress = function($p, $y, per){
    var max = 30;
    var pNum = Math.round(per * max);
    var p = Array(pNum+1).join("■");
    var y = Array(max-pNum+1).join("■");
    $p.text(p);
    $y.text(y);
}