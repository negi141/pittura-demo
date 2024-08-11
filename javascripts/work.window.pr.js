$(function() {

    var main = function(){
        setScene();
        render();
        drawClear();
//        selectMyDrawStyle("pen-u");
        playStart();
        // Canvasのタッチ・マウスイベント処理をバインド
//!        $("canvas").bind('click mousedown mouseup mousemove mouseleave mouseout touchstart touchmove touchend touchcancel', onEvent);
//!        $("dialog-title").text = "窓に〇〇を描いてみた";
        
//!        toast.show('窓に人差し指で描いてみよう');
    }

    var ti = 0;
    var myDrawStyle = "pen-u", playDrawStyle = "pen-u";

    var intervalID;
    var stepNo = 0;
    var INTERVAL = 50, interval = 25;

    var playlog = [];
    var playPainting = false;
    var playPreMouse = null;
    var painting = false;
    var preMouse = null;

    var SIZE = 330;
    var TSIZE = 256;
    
    var scene = new THREE.Scene();
    var w, h,     
        camera, group,ambLight,dirLight,
        segment,geometry,texture,imgCanvas,
        ctxAlpha,textureAlpha,material,
        mesh,arrayMapAlpha,writeMap, // 高さ(0-255)を保持する二次元配列
        texScale;
        
    // 1pixelの描画
    // zFix = -200[bottom] ～ 0[flat] ～ +55[top]
    // zFix < 0 = black
    var drawPoint = function(x, y, zFix, drawStyle) {
        // x,yがマップから出ていれば除外
        if (x < 0 || x >= TSIZE) return;
        if (y < 0 || y >= TSIZE) return;
        // 絶対値n以下は除外
        if (zFix > -3 && zFix < 3) return;
        
        var h; // 新しい高さ
        var org = arrayMapAlpha[x][y];
        var alpha;
        
        alpha = zFix / -350;
        
        h = org * (1 - alpha);

        h = Math.round( h );

        // 0-255に収める
        if (h < 0) h = 0;
        if (h > 255) h = 255;
        // 更新
        arrayMapAlpha[x][y] = h;
        // 描画
        ctxAlpha.fillStyle = "rgb("+h+", "+h+", "+h+")";
        ctxAlpha.fillRect(x, y, 1, 1);
    }

    // 1Circleの描画
    var drawCircle = function(x, y, drawStyle) {
        x = Math.round(x * texScale);
        y = Math.round(y * texScale);
        x = x - pen[drawStyle].half;
        y = y - pen[drawStyle].half;
        for (var i=0 ; i < pen[drawStyle].length ; i++) {
            drawPoint(x + pen[drawStyle].data[i].x, y + pen[drawStyle].data[i].y, pen[drawStyle].data[i].val, drawStyle);
        }
    }  

    // 再帰的に描画を補間
    function drawInterpolation(startPos, endPos, drawStyle){
        var abs = Math.abs(endPos.x - startPos.x) + Math.abs(endPos.y - startPos.y);
        var centerPos = {x: (endPos.x + startPos.x)/2, y: (endPos.y + startPos.y)/2};
        if (abs > pen[drawStyle].inter) {
            drawCircle(centerPos.x, centerPos.y, drawStyle);
            drawInterpolation(startPos, centerPos, drawStyle);
            drawInterpolation(centerPos, endPos, drawStyle);
        }
    }  
    var arrayMapClear = function(){
        // すべて200で初期化する
        arrayMapAlpha = [];
        for (var i = 0 ; i < TSIZE ; i++) {
            var m = [];
            for (var j = 0 ; j < TSIZE ; j++) {
                m.push(255);
            }
            arrayMapAlpha.push(m);
        }
    }

    // 表示中の砂をクリア
    var drawClear = function() {
        //drawAction.reset();
        // 200で塗りつぶし
        ctxAlpha.fillStyle = "rgb(255, 255, 255)";
        ctxAlpha.fillRect(0, 0, imgCanvas.width, imgCanvas.height);
        materialBlur.alphaMap.needsUpdate = true;
        //materialBlur.map.needsUpdate = true;

        arrayMapClear();
    }

    // アニメーションフレーム
    var render = function() {
        requestAnimationFrame(render);
        window.renderer.render(scene, camera);
    }

    var setDirLight = function (t) {
        dirLight.position.x = -0.3 + (t*0.05);
        dirLight.position.y = -0.1 + (t*0.05);
        dirLight.position.z = 0.3;
        dirLight.position.normalize();
    };

    var setScene = function() {
        w = SIZE;
        h = SIZE;

        camera = new THREE.OrthographicCamera( w / - 2, w / 2, h / 2, h / - 2, - 500, 1000 );
        camera.position.x = 0;
        camera.position.y = 0;
        camera.position.z = 500;

        window.renderer = new THREE.WebGLRenderer({preserveDrawingBuffer: true});
        window.renderer.setSize( w, h );
        $("#canvas-content").append( window.renderer.domElement );

        group = new THREE.Group();
        scene.add( group );

        // ライト
        ambLight = new THREE.AmbientLight( 0xffffff );
        ambLight.color.multiplyScalar(0.7);
        scene.add( ambLight );

        dirLight = new THREE.DirectionalLight( 0xffffff, 0.6 );
        setDirLight(9);
        scene.add( dirLight );

        // 平面の生成
        segment = 1;
        geometry = new THREE.PlaneGeometry( w, h, segment, segment );
        geometry_blur = new THREE.PlaneGeometry( w, h, segment, segment );

        // テクスチャをランダムで選ぶ
        texture = setTexture(workBgNo);
        textureBlur = setTextureBlur(workBgNo);

        imgCanvas = document.createElement('canvas');
        imgCanvas.width = TSIZE;
        imgCanvas.height = TSIZE;
        ctxAlpha = imgCanvas.getContext('2d');

        textureAlpha = new THREE.Texture(imgCanvas);
        textureAlpha.needsUpdate = true;

        //var material = new THREE.MeshPhongMaterial( { map:textureAlpha/*map: texture, bumpMap:textureAlpha, bumpScale: 3*/, overdraw: 0.5 } );
        material = new THREE.MeshPhongMaterial( { 
            specular: 0x000000, shininess: 0,
            map: texture, overdraw: 0.5 } );
        mesh = new THREE.Mesh( geometry, material );        
        group.add( mesh );
        
        // 透過させるマテリアル
        materialBlur = new THREE.MeshPhongMaterial( { 
            specular: 0x000000, shininess: 0, overdraw: 0.5,
            map: textureBlur,
            alphaMap: textureAlpha,
            transparent: true, depthTest: false, } );

        mesh_blur = new THREE.Mesh( geometry_blur, materialBlur );        
        group.add( mesh_blur );

        texScale = TSIZE / SIZE;
    };

    // イベント処理
/*!    var onEvent = function (e) {
        // スクロール位置も加えたCanvas要素の座標
        var canvasPos = getElementPosition(e.target)
        // ページ内のタッチ/マウス座標
        var pageMouse = { x: 0, y: 0 };  
        if (e.originalEvent && e.originalEvent.targetTouches && e.originalEvent.targetTouches.length != 0) {
            pageMouse.x = e.originalEvent.targetTouches[0].pageX;
            pageMouse.y = e.originalEvent.targetTouches[0].pageY;
        } else {
            pageMouse.x = e.pageX;
            pageMouse.y = e.pageY;
        }
        // Canvas内のタッチ/クリック座標
        var mouse = { x: 0, y: 0 };  
        mouse.x =  Math.round(pageMouse.x - canvasPos.left);
        mouse.y =  Math.round(pageMouse.y - canvasPos.top);
        switch (e.type) {
            case 'mousedown':
            case 'touchstart':
                drawCircle(mouse.x, mouse.y, myDrawStyle);
                preMouse = { x: mouse.x, y: mouse.y };
                painting = true;
                drawAction.addPos('st', mouse);
                break;
            case 'mouseup':
            case 'mouseout':
            case 'mouseleave':
            case 'touchend':
            case 'touchcancel':
                if (painting) {
                    drawAction.addPos('en', mouse);
                }
                painting = false;
                preMouse = null;
                break;
            case 'mousemove':
            case 'touchmove':
                if (painting) {
                    drawAction.addPos('m', mouse);
                }
                break;
            }
        // start or move
        if (painting) {
            drawCircle(mouse.x, mouse.y, myDrawStyle);

            drawInterpolation(preMouse, mouse, myDrawStyle);
            preMouse = { x: mouse.x, y: mouse.y };
                    
            materialBlur.alphaMap.needsUpdate = true;
            //materialBlur.map.needsUpdate = true;
        }
        e.preventDefault();
    };

    
    // 描画をしたか
    window.drawedValidate = function(){
        for (var i = 0 ; i < TSIZE ; i++) {
            for (var j = 0 ; j < TSIZE ; j++) {
                if (arrayMapAlpha[i][j] !== 255) return true;
            }
        }
        return false;
    };
*/
/*    var selectMyDrawStyle = function(style) {
        myDrawStyle = style;
    }*/
/*    
    $("#draw-clear-btn").click(function(){
        drawClear();
    });
    $(".set-theme-btn").click(function(){        
        toast.show($(this).text(), 8000);
        $('#comment').val($(this).text() + "を窓に描いてみた");
        $('#ThemeDialog').modal('hide');
    });*/
//!
    var setTexture = function(no){
        texture  = new THREE.ImageUtils.loadTexture(
            '/images/tex/window/window' + no + '.jpg');
        return texture;
    }
    var setTextureBlur = function(no){
        textureBlur  = new THREE.ImageUtils.loadTexture(
            '/images/tex/window/window' + no + '-blur.jpg');
        return textureBlur;
    }
/*    $(".change-tex-btn").click(function(){
        material.map = setTexture($(this));
        materialBlur.map = setTextureBlur($(this));
    });
*/

    var playStart = function(isReplay) {
        var motions = workMotion.d;
        if (isReplay == undefined){
            stepNo = 0;
            playDrawStyle = "pen-u";
        }
        var $txtProgressP = $('#txtProgressP');
        var $txtProgressY = $('#txtProgressY');

        var loop = function() {
            var e = motions[stepNo];
            switch (e.c) {
                case 'st':
                    drawCircle(e.x, e.y, playDrawStyle);
                    playPreMouse = { x: e.x, y: e.y };
                    playPainting = true;
                    break;
                case 'en':
                    playPainting = false;
                    playPreMouse = null;
                    break;
                case 'ds':
                    playPainting = false;
                    playPreMouse = null;
                    playDrawStyle = e.d;
                    break;
                case 'm':
                    break;
                }

            if (playPainting) {
                drawCircle(e.x, e.y, playDrawStyle);

                drawInterpolation(playPreMouse, e, playDrawStyle);
                playPreMouse = { x: e.x, y: e.y };
                        
                materialBlur.alphaMap.needsUpdate = true;
                //material.map.needsUpdate = true;
            }

            // intervalごとに繰り返し
            //intervalID = setTimeout(sandPlayLoop, interval);
            //page.intervalID = intervalID;
            stepNo++;
            drawProgress($txtProgressP, $txtProgressY, stepNo / motions.length);

            // 再生終了時
            if (motions.length == stepNo) {
                clearInterval(intervalID);
         //       endFunc();
            }
         //       $('#player-frame').text(stepNo + " / " + log.length);
        }

        intervalID = setInterval(loop, interval);
    }


    var pen = {
        'pen-u' : {name:'pen-u', half:8, length:256, inter:3,
            data:[
{x:0, y:0, val:0},{x:0, y:1, val:0},{x:0, y:2, val:0},{x:0, y:3, val:0},{x:0, y:4, val:0},{x:0, y:5, val:0},{x:0, y:6, val:0},{x:0, y:7, val:0},{x:0, y:8, val:0},{x:0, y:9, val:0},{x:0, y:10, val:0},{x:0, y:11, val:0},{x:0, y:12, val:0},{x:0, y:13, val:0},{x:0, y:14, val:0},{x:0, y:15, val:0},{x:1, y:0, val:0},{x:1, y:1, val:0},{x:1, y:2, val:0},{x:1, y:3, val:0},{x:1, y:4, val:0},{x:1, y:5, val:-9},{x:1, y:6, val:-38},{x:1, y:7, val:-38},{x:1, y:8, val:-38},{x:1, y:9, val:-9},{x:1, y:10, val:0},{x:1, y:11, val:0},{x:1, y:12, val:0},{x:1, y:13, val:0},{x:1, y:14, val:0},{x:1, y:15, val:0},{x:2, y:0, val:0},{x:2, y:1, val:0},{x:2, y:2, val:0},{x:2, y:3, val:0},{x:2, y:4, val:-44},{x:2, y:5, val:-83},{x:2, y:6, val:-114},{x:2, y:7, val:-119},{x:2, y:8, val:-114},{x:2, y:9, val:-83},{x:2, y:10, val:-44},{x:2, y:11, val:0},{x:2, y:12, val:0},{x:2, y:13, val:0},{x:2, y:14, val:0},{x:2, y:15, val:0},{x:3, y:0, val:0},{x:3, y:1, val:0},{x:3, y:2, val:0},{x:3, y:3, val:-56},{x:3, y:4, val:-119},{x:3, y:5, val:-154},{x:3, y:6, val:-192},{x:3, y:7, val:-193},{x:3, y:8, val:-192},{x:3, y:9, val:-154},{x:3, y:10, val:-119},{x:3, y:11, val:-56},{x:3, y:12, val:0},{x:3, y:13, val:0},{x:3, y:14, val:0},{x:3, y:15, val:0},{x:4, y:0, val:0},{x:4, y:1, val:0},{x:4, y:2, val:-44},{x:4, y:3, val:-119},{x:4, y:4, val:-175},{x:4, y:5, val:-214},{x:4, y:6, val:-234},{x:4, y:7, val:-237},{x:4, y:8, val:-234},{x:4, y:9, val:-214},{x:4, y:10, val:-175},{x:4, y:11, val:-119},{x:4, y:12, val:-44},{x:4, y:13, val:0},{x:4, y:14, val:0},{x:4, y:15, val:0},{x:5, y:0, val:0},{x:5, y:1, val:-9},{x:5, y:2, val:-83},{x:5, y:3, val:-154},{x:5, y:4, val:-214},{x:5, y:5, val:-243},{x:5, y:6, val:-252},{x:5, y:7, val:-254},{x:5, y:8, val:-252},{x:5, y:9, val:-243},{x:5, y:10, val:-214},{x:5, y:11, val:-154},{x:5, y:12, val:-83},{x:5, y:13, val:-9},{x:5, y:14, val:0},{x:5, y:15, val:0},{x:6, y:0, val:0},{x:6, y:1, val:-38},{x:6, y:2, val:-114},{x:6, y:3, val:-192},{x:6, y:4, val:-234},{x:6, y:5, val:-252},{x:6, y:6, val:-255},{x:6, y:7, val:-255},{x:6, y:8, val:-255},{x:6, y:9, val:-252},{x:6, y:10, val:-234},{x:6, y:11, val:-192},{x:6, y:12, val:-114},{x:6, y:13, val:-38},{x:6, y:14, val:0},{x:6, y:15, val:0},{x:7, y:0, val:0},{x:7, y:1, val:-38},{x:7, y:2, val:-119},{x:7, y:3, val:-193},{x:7, y:4, val:-237},{x:7, y:5, val:-254},{x:7, y:6, val:-255},{x:7, y:7, val:-255},{x:7, y:8, val:-255},{x:7, y:9, val:-254},{x:7, y:10, val:-237},{x:7, y:11, val:-193},{x:7, y:12, val:-119},{x:7, y:13, val:-38},{x:7, y:14, val:0},{x:7, y:15, val:0},{x:8, y:0, val:0},{x:8, y:1, val:-38},{x:8, y:2, val:-114},{x:8, y:3, val:-192},{x:8, y:4, val:-234},{x:8, y:5, val:-252},{x:8, y:6, val:-255},{x:8, y:7, val:-255},{x:8, y:8, val:-255},{x:8, y:9, val:-252},{x:8, y:10, val:-234},{x:8, y:11, val:-192},{x:8, y:12, val:-114},{x:8, y:13, val:-38},{x:8, y:14, val:0},{x:8, y:15, val:0},{x:9, y:0, val:0},{x:9, y:1, val:-9},{x:9, y:2, val:-83},{x:9, y:3, val:-154},{x:9, y:4, val:-214},{x:9, y:5, val:-243},{x:9, y:6, val:-252},{x:9, y:7, val:-254},{x:9, y:8, val:-252},{x:9, y:9, val:-243},{x:9, y:10, val:-214},{x:9, y:11, val:-154},{x:9, y:12, val:-83},{x:9, y:13, val:-9},{x:9, y:14, val:0},{x:9, y:15, val:0},{x:10, y:0, val:0},{x:10, y:1, val:0},{x:10, y:2, val:-44},{x:10, y:3, val:-119},{x:10, y:4, val:-175},{x:10, y:5, val:-214},{x:10, y:6, val:-234},{x:10, y:7, val:-237},{x:10, y:8, val:-234},{x:10, y:9, val:-214},{x:10, y:10, val:-175},{x:10, y:11, val:-119},{x:10, y:12, val:-44},{x:10, y:13, val:0},{x:10, y:14, val:0},{x:10, y:15, val:0},{x:11, y:0, val:0},{x:11, y:1, val:0},{x:11, y:2, val:0},{x:11, y:3, val:-56},{x:11, y:4, val:-119},{x:11, y:5, val:-154},{x:11, y:6, val:-192},{x:11, y:7, val:-193},{x:11, y:8, val:-192},{x:11, y:9, val:-154},{x:11, y:10, val:-119},{x:11, y:11, val:-56},{x:11, y:12, val:0},{x:11, y:13, val:0},{x:11, y:14, val:0},{x:11, y:15, val:0},{x:12, y:0, val:0},{x:12, y:1, val:0},{x:12, y:2, val:0},{x:12, y:3, val:0},{x:12, y:4, val:-44},{x:12, y:5, val:-83},{x:12, y:6, val:-114},{x:12, y:7, val:-119},{x:12, y:8, val:-114},{x:12, y:9, val:-83},{x:12, y:10, val:-44},{x:12, y:11, val:0},{x:12, y:12, val:0},{x:12, y:13, val:0},{x:12, y:14, val:0},{x:12, y:15, val:0},{x:13, y:0, val:0},{x:13, y:1, val:0},{x:13, y:2, val:0},{x:13, y:3, val:0},{x:13, y:4, val:0},{x:13, y:5, val:-9},{x:13, y:6, val:-38},{x:13, y:7, val:-38},{x:13, y:8, val:-38},{x:13, y:9, val:-9},{x:13, y:10, val:0},{x:13, y:11, val:0},{x:13, y:12, val:0},{x:13, y:13, val:0},{x:13, y:14, val:0},{x:13, y:15, val:0},{x:14, y:0, val:0},{x:14, y:1, val:0},{x:14, y:2, val:0},{x:14, y:3, val:0},{x:14, y:4, val:0},{x:14, y:5, val:0},{x:14, y:6, val:0},{x:14, y:7, val:0},{x:14, y:8, val:0},{x:14, y:9, val:0},{x:14, y:10, val:0},{x:14, y:11, val:0},{x:14, y:12, val:0},{x:14, y:13, val:0},{x:14, y:14, val:0},{x:14, y:15, val:0},{x:15, y:0, val:0},{x:15, y:1, val:0},{x:15, y:2, val:0},{x:15, y:3, val:0},{x:15, y:4, val:0},{x:15, y:5, val:0},{x:15, y:6, val:0},{x:15, y:7, val:0},{x:15, y:8, val:0},{x:15, y:9, val:0},{x:15, y:10, val:0},{x:15, y:11, val:0},{x:15, y:12, val:0},{x:15, y:13, val:0},{x:15, y:14, val:0},{x:15, y:15, val:0}


            ]
        },
   };

    // メイン関数実行
    main();
});