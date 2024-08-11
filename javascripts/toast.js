// トースト通知クラス
var Toast = (function(){
	"use strict";
	var timer;
	var speed;
    function Toast() {
		this.speed = 3000;
    }
    // メッセージを表示。表示時間(speed)はデフォルトで3秒
	Toast.prototype.show = function(message, speed) {
		if (speed === undefined) speed = this.speed;
		$('.toast').remove();
		clearTimeout(this.timer);
		$('body').append('<div class="toast">' + message + '</div>');
		var leftpos = $('body').width()/2 - $('.toast').width()/2;
		$('.toast').css('left', leftpos).hide().fadeIn('fast');
	
		this.timer = setTimeout(function(){
			$('.toast').fadeOut('slow',function(){
				$(this).remove();
			});
		}, speed);
	};
    return Toast;
})();
