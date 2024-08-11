$(function() {

    var main = function(){
        setScene();
        render();
        drawClear();
        selectMyDrawStyle("pen");
        // Canvasのタッチ・マウスイベント処理をバインド
        $("canvas").bind('click mousedown mouseup mousemove mouseleave mouseout touchstart touchmove touchend touchcancel', onEvent);
        setWave();
        waveMaterial.map = waveTexture[0];
        waveMaterial.color = new THREE.Color('rgb(255, 255, 255)');     
        toast.show('砂に人差し指で描いてみよう');   
    }

    var myDrawStyle = "pen";
    var intervalID;
    var painting = false;
    var preMouse = null;

    var SIZE = 330;
    var TSIZE = 256;
    
    var scene = new THREE.Scene();
    
    var w, h,     
        camera,group,ambLight,dirLight,
        segment,geometry,texture,imgCanvas,
        ctxBump,textureBump,material,
        mesh,arrayMapHeight,writeMap, // 高さ(0-255)を保持する二次元配列
        texScale;
    
    var waveTexture,waveGeometry,waveMaterial,waveMesh,waveStarting = false;
    
    // 1pixelの描画
    // zFix = -200[bottom] ～ 0[flat] ～ +55[top]
    // zFix < 0 = black
    var drawPoint = function(x, y, zFix, drawStyle) {
        // x,yがマップから出ていれば除外
        if (x < 0 || x >= TSIZE) return;
        if (y < 0 || y >= TSIZE) return;
        // 絶対値3以下は除外
        if (zFix > -5 && zFix < 5) return;
        
        var h; // 新しい高さ
        var org = arrayMapHeight[x][y];
        var alpha;
        
        if (zFix < 0) { // down
            alpha = zFix / -350;
        } else { // up
            alpha = zFix / 100;
        }
        
        if (drawStyle == "eraser") {
            if (zFix < 0) { // down = black = 0
                alpha*=0.8;
                h = org*(1-alpha) + 160*alpha;
            } else { // up white
                alpha*=1.2;
                h = org*(1-alpha) + 255*alpha;
            }
        } else {
            if (zFix < 0) { // down = black = 0
                h = org*(1-alpha);
            } else { // up white
                h = org*(1-alpha) + 255*alpha;
            }
        }
        // 現在の描画で描いた箇所は、
        if (writeMap[x][y] == true && (drawStyle !== "eraser" && drawStyle !== "pen-n")) {
            // 既に下がっており、それを微妙に上げるのはしない
            if (org < 200 && org < h) return;
        }
        // ランダム（ノイズ）処理
        if(drawStyle !== "eraser" && drawStyle !== "pen-n"){
            if (zFix < 0) {
                // 下げる高さを調整
                h = Math.round( h + (Math.random() * 14 - 7) );
            } else { 
                // 上げる高さを調整
                h = Math.round( h + (Math.random() * 6 - 3)); 
            }
        } else {
            h = Math.round( h + (Math.random() * 8 - 4) );
        }
        // 0-255に収める
        if (h < 0) h = 0;
        if (h > 255) h = 255;
        // 更新
        arrayMapHeight[x][y] = h;
        writeMap[x][y] = true;
        // 描画
        ctxBump.fillStyle = "rgb("+h+", "+h+", "+h+")";
        ctxBump.fillRect(x, y, 1, 1);
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
        arrayMapHeight = [];
        for (var i = 0 ; i < TSIZE ; i++) {
            var m = [];
            for (var j = 0 ; j < TSIZE ; j++) {
                m.push(200);
            }
            arrayMapHeight.push(m);
        }
    }
    var writeMapClear = function(){
        writeMap = [];
        for (var i = 0 ; i < TSIZE ; i++) {
            var m = [];
            for (var j = 0 ; j < TSIZE ; j++) {
                m.push(false);
            }
            writeMap.push(m);
        }
    }

    // 作画をクリア
    var drawClear = function() {
        // 200で塗りつぶし
        ctxBump.fillStyle = "rgb(200, 200, 200)";
        ctxBump.fillRect(0, 0, imgCanvas.width, imgCanvas.height);
        // 少しノイズを追加
        for (var i = 0 ; i < 20000 ; i++) {
            var c = Math.round(175 + Math.random() * 50);
            ctxBump.fillStyle = "rgb("+c+", "+c+", "+c+")";
            ctxBump.fillRect(Math.random() * TSIZE, Math.random() * TSIZE, 1, 1);
        }
        
        material.bumpMap.needsUpdate = true;

        arrayMapClear();
        writeMapClear();
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
        
        // テクスチャをランダムで選ぶ
        var texNo = Math.round(Math.random() * 4) + 1;
        texture  = setTexture($("#change-tex-btn" + texNo));

        imgCanvas = document.createElement('canvas');
        imgCanvas.width = TSIZE;
        imgCanvas.height = TSIZE;
        ctxBump = imgCanvas.getContext('2d');   

        textureBump = new THREE.Texture(imgCanvas);
        textureBump.needsUpdate = true;

        //var material = new THREE.MeshPhongMaterial( { map:textureBump/*map: texture, bumpMap:textureBump, bumpScale: 3*/, overdraw: 0.5 } );
        material = new THREE.MeshPhongMaterial( { 
            specular: 0x000000, shininess: 0,
            map: texture, bumpMap:textureBump, bumpScale: 6, overdraw: 0.5 } );
        mesh = new THREE.Mesh( geometry, material );
        
        group.add( mesh );

        texScale = TSIZE / SIZE;
    };

    var setWave = function() {
        // 波            
        waveTexture = [];
        for(var i=9 ; i<=73 ; i++){//70
            var a = new THREE.ImageUtils.loadTexture(parentPath + '/images/tex_wave/'+i+'.jpg');
            waveTexture.push(a);
        }
        waveGeometry = new THREE.PlaneGeometry( w, h, segment, segment );
        waveMaterial = new THREE.MeshBasicMaterial({color:'rgb(0, 0, 0)',
            //blending: THREE.SubtractiveBlending,
            transparent: true, depthTest: false, map: waveTexture[0] });

        waveMaterial.blending = THREE.CustomBlending;
        waveMaterial.blendEquation = THREE.AddEquation;
        waveMaterial.blendSrc = THREE.DstColorFactor;
        waveMaterial.blendDst = THREE.SrcColorFactor;

        waveMesh = new THREE.Mesh( waveGeometry, waveMaterial );
        waveStarting = false;

        group.add( waveMesh );
    }

    // 波を開始
    var waveStart = function(){
        if (waveStarting){               
            toast.show("既に開始しています");
            return;
        }

        var clearStep = 0;
        waveStarting = true;

        waveMaterial.color = new THREE.Color('rgb(255, 255, 255)');
        var waveAnim = function() {
            // intervalごとに繰り返し
            intervalID = setTimeout(waveAnim, 70);
            //console.log(clearStep);
            clearStep++;
            // マップを切り替える
            waveMaterial.map = waveTexture[clearStep];

            // バンプマップを徐々に200に戻す
            if (clearStep >= 25) {
                ctxBump.fillStyle = "rgba(200, 200, 200, 0.12)";
                ctxBump.fillRect(0, 0, imgCanvas.width, imgCanvas.height);
                material.bumpMap.needsUpdate = true;
            }

            if (clearStep == 64) {
                drawClear();
                clearTimeout(intervalID);
                waveStarting = false;
            }
        }
        waveAnim();
    }

    // イベント処理
    var onEvent = function (e) {
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
                break;
            case 'mouseup':
            case 'mouseout':
            case 'mouseleave':
            case 'touchend':
            case 'touchcancel':
                painting = false;
                preMouse = null;
                writeMapClear();
                break;
            case 'mousemove':
            case 'touchmove':
                break;
            }
        // start or move
        if (painting) {
            drawCircle(mouse.x, mouse.y, myDrawStyle);

            drawInterpolation(preMouse, mouse, myDrawStyle);
            preMouse = { x: mouse.x, y: mouse.y };
                    
            material.bumpMap.needsUpdate = true;
        }
        e.preventDefault();
    };

    
    // 描画をしたか
    window.drawedValidate = function(){
        for (var i = 0 ; i < TSIZE ; i++) {
            for (var j = 0 ; j < TSIZE ; j++) {
                if (arrayMapHeight[i][j] !== 200) return true;
            }
        }
        return false;
    };

    var selectMyDrawStyle = function(style) {
        myDrawStyle = style;
        $("#draw-pen-btn").removeClass("btn-selected");
        $("#draw-pen-n-btn").removeClass("btn-selected");
        $("#draw-eraser-btn").removeClass("btn-selected");

        $("#draw-"+style+"-btn").addClass("btn-selected");
    }
    
    $("#draw-pen-btn").click(function(){
        selectMyDrawStyle("pen");
        //drawAction.addPen('ds', "pen-");
    });
    $("#draw-pen-n-btn").click(function(){
        selectMyDrawStyle("pen-n");
        //drawAction.addPen('ds', "pen");
    });
    $("#draw-eraser-btn").click(function(){
        selectMyDrawStyle("eraser");
        //drawAction.addPen('ds', "eraser");
    });
    $("#draw-clear-btn").click(function(){
        $("#message-content").text("波で消します");
        waveStart();
    });
    var setTexture = function(btnElem){
        texture  = new THREE.ImageUtils.loadTexture(
            parentPath + '/images/tex/sand/sand' + btnElem.attr("val") + '.jpg');
        // 選択枠
        $(".change-tex-btn").removeClass('change-tex-btn-selected');
        btnElem.addClass('change-tex-btn-selected');
        return texture;
    }
    $(".change-tex-btn").click(function(){
        material.map = setTexture($(this));
    });


    var pen = {
        'pen-n' : {name:'pen-n', half:8, length:256, inter:3,data:[{x:0, y:0, val:0},{x:0, y:1, val:0},{x:0, y:2, val:0},{x:0, y:3, val:2},{x:0, y:4, val:5},{x:0, y:5, val:8},{x:0, y:6, val:11},{x:0, y:7, val:12},{x:0, y:8, val:11},{x:0, y:9, val:10},{x:0, y:10, val:6},{x:0, y:11, val:3},{x:0, y:12, val:0},{x:0, y:13, val:0},{x:0, y:14, val:0},{x:0, y:15, val:0},{x:1, y:0, val:0},{x:1, y:1, val:0},{x:1, y:2, val:4},{x:1, y:3, val:9},{x:1, y:4, val:15},{x:1, y:5, val:21},{x:1, y:6, val:24},{x:1, y:7, val:26},{x:1, y:8, val:25},{x:1, y:9, val:22},{x:1, y:10, val:18},{x:1, y:11, val:11},{x:1, y:12, val:6},{x:1, y:13, val:1},{x:1, y:14, val:0},{x:1, y:15, val:0},{x:2, y:0, val:0},{x:2, y:1, val:4},{x:2, y:2, val:11},{x:2, y:3, val:19},{x:2, y:4, val:27},{x:2, y:5, val:28},{x:2, y:6, val:26},{x:2, y:7, val:24},{x:2, y:8, val:26},{x:2, y:9, val:29},{x:2, y:10, val:29},{x:2, y:11, val:22},{x:2, y:12, val:14},{x:2, y:13, val:6},{x:2, y:14, val:1},{x:2, y:15, val:0},{x:3, y:0, val:2},{x:3, y:1, val:9},{x:3, y:2, val:19},{x:3, y:3, val:27},{x:3, y:4, val:23},{x:3, y:5, val:11},{x:3, y:6, val:0},{x:3, y:7, val:-5},{x:3, y:8, val:-1},{x:3, y:9, val:9},{x:3, y:10, val:22},{x:3, y:11, val:29},{x:3, y:12, val:23},{x:3, y:13, val:13},{x:3, y:14, val:4},{x:3, y:15, val:0},{x:4, y:0, val:5},{x:4, y:1, val:16},{x:4, y:2, val:26},{x:4, y:3, val:20},{x:4, y:4, val:0},{x:4, y:5, val:-25},{x:4, y:6, val:-46},{x:4, y:7, val:-55},{x:4, y:8, val:-49},{x:4, y:9, val:-29},{x:4, y:10, val:-4},{x:4, y:11, val:18},{x:4, y:12, val:28},{x:4, y:13, val:20},{x:4, y:14, val:9},{x:4, y:15, val:2},{x:5, y:0, val:9},{x:5, y:1, val:21},{x:5, y:2, val:24},{x:5, y:3, val:4},{x:5, y:4, val:-31},{x:5, y:5, val:-70},{x:5, y:6, val:-99},{x:5, y:7, val:-111},{x:5, y:8, val:-102},{x:5, y:9, val:-76},{x:5, y:10, val:-39},{x:5, y:11, val:-1},{x:5, y:12, val:23},{x:5, y:13, val:26},{x:5, y:14, val:13},{x:5, y:15, val:4},{x:6, y:0, val:11},{x:6, y:1, val:24},{x:6, y:2, val:16},{x:6, y:3, val:-14},{x:6, y:4, val:-61},{x:6, y:5, val:-108},{x:6, y:6, val:-145},{x:6, y:7, val:-162},{x:6, y:8, val:-151},{x:6, y:9, val:-117},{x:6, y:10, val:-70},{x:6, y:11, val:-22},{x:6, y:12, val:14},{x:6, y:13, val:27},{x:6, y:14, val:17},{x:6, y:15, val:6},{x:7, y:0, val:12},{x:7, y:1, val:24},{x:7, y:2, val:11},{x:7, y:3, val:-27},{x:7, y:4, val:-80},{x:7, y:5, val:-133},{x:7, y:6, val:-175},{x:7, y:7, val:-193},{x:7, y:8, val:-180},{x:7, y:9, val:-143},{x:7, y:10, val:-90},{x:7, y:11, val:-37},{x:7, y:12, val:7},{x:7, y:13, val:26},{x:7, y:14, val:19},{x:7, y:15, val:6},{x:8, y:0, val:12},{x:8, y:1, val:23},{x:8, y:2, val:11},{x:8, y:3, val:-28},{x:8, y:4, val:-81},{x:8, y:5, val:-135},{x:8, y:6, val:-177},{x:8, y:7, val:-196},{x:8, y:8, val:-183},{x:8, y:9, val:-145},{x:8, y:10, val:-92},{x:8, y:11, val:-38},{x:8, y:12, val:6},{x:8, y:13, val:25},{x:8, y:14, val:18},{x:8, y:15, val:6},{x:9, y:0, val:10},{x:9, y:1, val:22},{x:9, y:2, val:14},{x:9, y:3, val:-18},{x:9, y:4, val:-66},{x:9, y:5, val:-114},{x:9, y:6, val:-152},{x:9, y:7, val:-168},{x:9, y:8, val:-157},{x:9, y:9, val:-122},{x:9, y:10, val:-75},{x:9, y:11, val:-26},{x:9, y:12, val:11},{x:9, y:13, val:25},{x:9, y:14, val:15},{x:9, y:15, val:5},{x:10, y:0, val:7},{x:10, y:1, val:19},{x:10, y:2, val:19},{x:10, y:3, val:-1},{x:10, y:4, val:-38},{x:10, y:5, val:-77},{x:10, y:6, val:-107},{x:10, y:7, val:-120},{x:10, y:8, val:-111},{x:10, y:9, val:-84},{x:10, y:10, val:-46},{x:10, y:11, val:-7},{x:10, y:12, val:18},{x:10, y:13, val:23},{x:10, y:14, val:11},{x:10, y:15, val:3},{x:11, y:0, val:3},{x:11, y:1, val:12},{x:11, y:2, val:21},{x:11, y:3, val:13},{x:11, y:4, val:-8},{x:11, y:5, val:-34},{x:11, y:6, val:-56},{x:11, y:7, val:-66},{x:11, y:8, val:-59},{x:11, y:9, val:-38},{x:11, y:10, val:-12},{x:11, y:11, val:11},{x:11, y:12, val:24},{x:11, y:13, val:17},{x:11, y:14, val:6},{x:11, y:15, val:1},{x:12, y:0, val:0},{x:12, y:1, val:6},{x:12, y:2, val:15},{x:12, y:3, val:21},{x:12, y:4, val:14},{x:12, y:5, val:2},{x:12, y:6, val:-10},{x:12, y:7, val:-15},{x:12, y:8, val:-12},{x:12, y:9, val:0},{x:12, y:10, val:13},{x:12, y:11, val:22},{x:12, y:12, val:19},{x:12, y:13, val:9},{x:12, y:14, val:2},{x:12, y:15, val:0},{x:13, y:0, val:0},{x:13, y:1, val:1},{x:13, y:2, val:6},{x:13, y:3, val:14},{x:13, y:4, val:20},{x:13, y:5, val:19},{x:13, y:6, val:16},{x:13, y:7, val:15},{x:13, y:8, val:16},{x:13, y:9, val:20},{x:13, y:10, val:22},{x:13, y:11, val:17},{x:13, y:12, val:9},{x:13, y:13, val:3},{x:13, y:14, val:0},{x:13, y:15, val:0},{x:14, y:0, val:0},{x:14, y:1, val:0},{x:14, y:2, val:1},{x:14, y:3, val:5},{x:14, y:4, val:9},{x:14, y:5, val:14},{x:14, y:6, val:17},{x:14, y:7, val:19},{x:14, y:8, val:18},{x:14, y:9, val:16},{x:14, y:10, val:11},{x:14, y:11, val:6},{x:14, y:12, val:2},{x:14, y:13, val:0},{x:14, y:14, val:0},{x:14, y:15, val:0},{x:15, y:0, val:0},{x:15, y:1, val:0},{x:15, y:2, val:0},{x:15, y:3, val:0},{x:15, y:4, val:2},{x:15, y:5, val:4},{x:15, y:6, val:6},{x:15, y:7, val:7},{x:15, y:8, val:7},{x:15, y:9, val:5},{x:15, y:10, val:3},{x:15, y:11, val:1},{x:15, y:12, val:0},{x:15, y:13, val:0},{x:15, y:14, val:0},{x:15, y:15, val:0}]},
        'pen' : {name:'pen', half:8, length:256, inter:3,
            data:[{x:0, y:0, val:0},{x:0, y:1, val:0},{x:0, y:2, val:0},{x:0, y:3, val:2},{x:0, y:4, val:5},{x:0, y:5, val:8},{x:0, y:6, val:11},{x:0, y:7, val:12},{x:0, y:8, val:11},{x:0, y:9, val:10},{x:0, y:10, val:6},{x:0, y:11, val:3},{x:0, y:12, val:0},{x:0, y:13, val:0},{x:0, y:14, val:0},{x:0, y:15, val:0},{x:1, y:0, val:0},{x:1, y:1, val:0},{x:1, y:2, val:4},{x:1, y:3, val:9},{x:1, y:4, val:15},{x:1, y:5, val:21},{x:1, y:6, val:24},{x:1, y:7, val:26},{x:1, y:8, val:25},{x:1, y:9, val:22},{x:1, y:10, val:18},{x:1, y:11, val:11},{x:1, y:12, val:6},{x:1, y:13, val:1},{x:1, y:14, val:0},{x:1, y:15, val:0},{x:2, y:0, val:0},{x:2, y:1, val:4},{x:2, y:2, val:11},{x:2, y:3, val:19},{x:2, y:4, val:27},{x:2, y:5, val:28},{x:2, y:6, val:26},{x:2, y:7, val:24},{x:2, y:8, val:26},{x:2, y:9, val:29},{x:2, y:10, val:29},{x:2, y:11, val:22},{x:2, y:12, val:14},{x:2, y:13, val:6},{x:2, y:14, val:1},{x:2, y:15, val:0},{x:3, y:0, val:2},{x:3, y:1, val:9},{x:3, y:2, val:19},{x:3, y:3, val:27},{x:3, y:4, val:23},{x:3, y:5, val:11},{x:3, y:6, val:0},{x:3, y:7, val:-5},{x:3, y:8, val:-1},{x:3, y:9, val:9},{x:3, y:10, val:22},{x:3, y:11, val:29},{x:3, y:12, val:23},{x:3, y:13, val:13},{x:3, y:14, val:4},{x:3, y:15, val:0},{x:4, y:0, val:5},{x:4, y:1, val:16},{x:4, y:2, val:26},{x:4, y:3, val:20},{x:4, y:4, val:0},{x:4, y:5, val:-25},{x:4, y:6, val:-46},{x:4, y:7, val:-55},{x:4, y:8, val:-49},{x:4, y:9, val:-29},{x:4, y:10, val:-4},{x:4, y:11, val:18},{x:4, y:12, val:28},{x:4, y:13, val:20},{x:4, y:14, val:9},{x:4, y:15, val:2},{x:5, y:0, val:9},{x:5, y:1, val:21},{x:5, y:2, val:24},{x:5, y:3, val:4},{x:5, y:4, val:-31},{x:5, y:5, val:-70},{x:5, y:6, val:-99},{x:5, y:7, val:-111},{x:5, y:8, val:-102},{x:5, y:9, val:-76},{x:5, y:10, val:-39},{x:5, y:11, val:-1},{x:5, y:12, val:23},{x:5, y:13, val:26},{x:5, y:14, val:13},{x:5, y:15, val:4},{x:6, y:0, val:11},{x:6, y:1, val:24},{x:6, y:2, val:16},{x:6, y:3, val:-14},{x:6, y:4, val:-61},{x:6, y:5, val:-108},{x:6, y:6, val:-145},{x:6, y:7, val:-162},{x:6, y:8, val:-151},{x:6, y:9, val:-117},{x:6, y:10, val:-70},{x:6, y:11, val:-22},{x:6, y:12, val:14},{x:6, y:13, val:27},{x:6, y:14, val:17},{x:6, y:15, val:6},{x:7, y:0, val:12},{x:7, y:1, val:24},{x:7, y:2, val:11},{x:7, y:3, val:-27},{x:7, y:4, val:-80},{x:7, y:5, val:-133},{x:7, y:6, val:-175},{x:7, y:7, val:-193},{x:7, y:8, val:-180},{x:7, y:9, val:-143},{x:7, y:10, val:-90},{x:7, y:11, val:-37},{x:7, y:12, val:7},{x:7, y:13, val:26},{x:7, y:14, val:19},{x:7, y:15, val:6},{x:8, y:0, val:12},{x:8, y:1, val:23},{x:8, y:2, val:11},{x:8, y:3, val:-28},{x:8, y:4, val:-81},{x:8, y:5, val:-135},{x:8, y:6, val:-177},{x:8, y:7, val:-196},{x:8, y:8, val:-183},{x:8, y:9, val:-145},{x:8, y:10, val:-92},{x:8, y:11, val:-38},{x:8, y:12, val:6},{x:8, y:13, val:25},{x:8, y:14, val:18},{x:8, y:15, val:6},{x:9, y:0, val:10},{x:9, y:1, val:22},{x:9, y:2, val:14},{x:9, y:3, val:-18},{x:9, y:4, val:-66},{x:9, y:5, val:-114},{x:9, y:6, val:-152},{x:9, y:7, val:-168},{x:9, y:8, val:-157},{x:9, y:9, val:-122},{x:9, y:10, val:-75},{x:9, y:11, val:-26},{x:9, y:12, val:11},{x:9, y:13, val:25},{x:9, y:14, val:15},{x:9, y:15, val:5},{x:10, y:0, val:7},{x:10, y:1, val:19},{x:10, y:2, val:19},{x:10, y:3, val:-1},{x:10, y:4, val:-38},{x:10, y:5, val:-77},{x:10, y:6, val:-107},{x:10, y:7, val:-120},{x:10, y:8, val:-111},{x:10, y:9, val:-84},{x:10, y:10, val:-46},{x:10, y:11, val:-7},{x:10, y:12, val:18},{x:10, y:13, val:23},{x:10, y:14, val:11},{x:10, y:15, val:3},{x:11, y:0, val:3},{x:11, y:1, val:12},{x:11, y:2, val:21},{x:11, y:3, val:13},{x:11, y:4, val:-8},{x:11, y:5, val:-34},{x:11, y:6, val:-56},{x:11, y:7, val:-66},{x:11, y:8, val:-59},{x:11, y:9, val:-38},{x:11, y:10, val:-12},{x:11, y:11, val:11},{x:11, y:12, val:24},{x:11, y:13, val:17},{x:11, y:14, val:6},{x:11, y:15, val:1},{x:12, y:0, val:0},{x:12, y:1, val:6},{x:12, y:2, val:15},{x:12, y:3, val:21},{x:12, y:4, val:14},{x:12, y:5, val:2},{x:12, y:6, val:-10},{x:12, y:7, val:-15},{x:12, y:8, val:-12},{x:12, y:9, val:0},{x:12, y:10, val:13},{x:12, y:11, val:22},{x:12, y:12, val:19},{x:12, y:13, val:9},{x:12, y:14, val:2},{x:12, y:15, val:0},{x:13, y:0, val:0},{x:13, y:1, val:1},{x:13, y:2, val:6},{x:13, y:3, val:14},{x:13, y:4, val:20},{x:13, y:5, val:19},{x:13, y:6, val:16},{x:13, y:7, val:15},{x:13, y:8, val:16},{x:13, y:9, val:20},{x:13, y:10, val:22},{x:13, y:11, val:17},{x:13, y:12, val:9},{x:13, y:13, val:3},{x:13, y:14, val:0},{x:13, y:15, val:0},{x:14, y:0, val:0},{x:14, y:1, val:0},{x:14, y:2, val:1},{x:14, y:3, val:5},{x:14, y:4, val:9},{x:14, y:5, val:14},{x:14, y:6, val:17},{x:14, y:7, val:19},{x:14, y:8, val:18},{x:14, y:9, val:16},{x:14, y:10, val:11},{x:14, y:11, val:6},{x:14, y:12, val:2},{x:14, y:13, val:0},{x:14, y:14, val:0},{x:14, y:15, val:0},{x:15, y:0, val:0},{x:15, y:1, val:0},{x:15, y:2, val:0},{x:15, y:3, val:0},{x:15, y:4, val:2},{x:15, y:5, val:4},{x:15, y:6, val:6},{x:15, y:7, val:7},{x:15, y:8, val:7},{x:15, y:9, val:5},{x:15, y:10, val:3},{x:15, y:11, val:1},{x:15, y:12, val:0},{x:15, y:13, val:0},{x:15, y:14, val:0},{x:15, y:15, val:0}]
        },
        'eraser' : {name:'eraser', half:18, length:1296, inter:6,
            data:[{x:0, y:0, val:0},{x:0, y:1, val:-1},{x:0, y:2, val:0},{x:0, y:3, val:-1},{x:0, y:4, val:0},{x:0, y:5, val:0},{x:0, y:6, val:0},{x:0, y:7, val:0},{x:0, y:8, val:0},{x:0, y:9, val:2},{x:0, y:10, val:3},{x:0, y:11, val:3},{x:0, y:12, val:5},{x:0, y:13, val:5},{x:0, y:14, val:6},{x:0, y:15, val:6},{x:0, y:16, val:6},{x:0, y:17, val:6},{x:0, y:18, val:5},{x:0, y:19, val:5},{x:0, y:20, val:5},{x:0, y:21, val:4},{x:0, y:22, val:3},{x:0, y:23, val:2},{x:0, y:24, val:1},{x:0, y:25, val:0},{x:0, y:26, val:0},{x:0, y:27, val:0},{x:0, y:28, val:-1},{x:0, y:29, val:0},{x:0, y:30, val:0},{x:0, y:31, val:-1},{x:0, y:32, val:0},{x:0, y:33, val:-1},{x:0, y:34, val:0},{x:0, y:35, val:0},{x:1, y:0, val:-1},{x:1, y:1, val:-1},{x:1, y:2, val:-1},{x:1, y:3, val:-1},{x:1, y:4, val:0},{x:1, y:5, val:0},{x:1, y:6, val:0},{x:1, y:7, val:1},{x:1, y:8, val:2},{x:1, y:9, val:4},{x:1, y:10, val:5},{x:1, y:11, val:6},{x:1, y:12, val:7},{x:1, y:13, val:8},{x:1, y:14, val:9},{x:1, y:15, val:9},{x:1, y:16, val:9},{x:1, y:17, val:9},{x:1, y:18, val:8},{x:1, y:19, val:8},{x:1, y:20, val:7},{x:1, y:21, val:6},{x:1, y:22, val:5},{x:1, y:23, val:4},{x:1, y:24, val:2},{x:1, y:25, val:1},{x:1, y:26, val:0},{x:1, y:27, val:0},{x:1, y:28, val:0},{x:1, y:29, val:-1},{x:1, y:30, val:-1},{x:1, y:31, val:-1},{x:1, y:32, val:-1},{x:1, y:33, val:-1},{x:1, y:34, val:0},{x:1, y:35, val:0},{x:2, y:0, val:0},{x:2, y:1, val:-1},{x:2, y:2, val:0},{x:2, y:3, val:0},{x:2, y:4, val:0},{x:2, y:5, val:1},{x:2, y:6, val:2},{x:2, y:7, val:4},{x:2, y:8, val:4},{x:2, y:9, val:7},{x:2, y:10, val:8},{x:2, y:11, val:9},{x:2, y:12, val:10},{x:2, y:13, val:11},{x:2, y:14, val:12},{x:2, y:15, val:12},{x:2, y:16, val:12},{x:2, y:17, val:12},{x:2, y:18, val:12},{x:2, y:19, val:11},{x:2, y:20, val:10},{x:2, y:21, val:9},{x:2, y:22, val:9},{x:2, y:23, val:7},{x:2, y:24, val:5},{x:2, y:25, val:3},{x:2, y:26, val:2},{x:2, y:27, val:1},{x:2, y:28, val:0},{x:2, y:29, val:0},{x:2, y:30, val:-1},{x:2, y:31, val:-1},{x:2, y:32, val:-1},{x:2, y:33, val:-1},{x:2, y:34, val:0},{x:2, y:35, val:0},{x:3, y:0, val:-1},{x:3, y:1, val:-1},{x:3, y:2, val:0},{x:3, y:3, val:0},{x:3, y:4, val:1},{x:3, y:5, val:3},{x:3, y:6, val:5},{x:3, y:7, val:7},{x:3, y:8, val:8},{x:3, y:9, val:11},{x:3, y:10, val:12},{x:3, y:11, val:13},{x:3, y:12, val:14},{x:3, y:13, val:14},{x:3, y:14, val:14},{x:3, y:15, val:14},{x:3, y:16, val:14},{x:3, y:17, val:14},{x:3, y:18, val:14},{x:3, y:19, val:14},{x:3, y:20, val:14},{x:3, y:21, val:13},{x:3, y:22, val:13},{x:3, y:23, val:11},{x:3, y:24, val:9},{x:3, y:25, val:6},{x:3, y:26, val:5},{x:3, y:27, val:3},{x:3, y:28, val:2},{x:3, y:29, val:0},{x:3, y:30, val:0},{x:3, y:31, val:0},{x:3, y:32, val:-1},{x:3, y:33, val:-1},{x:3, y:34, val:-1},{x:3, y:35, val:-1},{x:4, y:0, val:0},{x:4, y:1, val:0},{x:4, y:2, val:0},{x:4, y:3, val:1},{x:4, y:4, val:3},{x:4, y:5, val:5},{x:4, y:6, val:7},{x:4, y:7, val:9},{x:4, y:8, val:11},{x:4, y:9, val:13},{x:4, y:10, val:14},{x:4, y:11, val:14},{x:4, y:12, val:15},{x:4, y:13, val:14},{x:4, y:14, val:14},{x:4, y:15, val:13},{x:4, y:16, val:13},{x:4, y:17, val:13},{x:4, y:18, val:14},{x:4, y:19, val:15},{x:4, y:20, val:15},{x:4, y:21, val:15},{x:4, y:22, val:14},{x:4, y:23, val:13},{x:4, y:24, val:11},{x:4, y:25, val:9},{x:4, y:26, val:7},{x:4, y:27, val:5},{x:4, y:28, val:3},{x:4, y:29, val:1},{x:4, y:30, val:0},{x:4, y:31, val:0},{x:4, y:32, val:-1},{x:4, y:33, val:-1},{x:4, y:34, val:-1},{x:4, y:35, val:-1},{x:5, y:0, val:0},{x:5, y:1, val:0},{x:5, y:2, val:1},{x:5, y:3, val:3},{x:5, y:4, val:5},{x:5, y:5, val:8},{x:5, y:6, val:10},{x:5, y:7, val:12},{x:5, y:8, val:13},{x:5, y:9, val:14},{x:5, y:10, val:14},{x:5, y:11, val:13},{x:5, y:12, val:12},{x:5, y:13, val:12},{x:5, y:14, val:11},{x:5, y:15, val:10},{x:5, y:16, val:10},{x:5, y:17, val:10},{x:5, y:18, val:12},{x:5, y:19, val:12},{x:5, y:20, val:13},{x:5, y:21, val:14},{x:5, y:22, val:14},{x:5, y:23, val:15},{x:5, y:24, val:13},{x:5, y:25, val:12},{x:5, y:26, val:10},{x:5, y:27, val:7},{x:5, y:28, val:5},{x:5, y:29, val:3},{x:5, y:30, val:1},{x:5, y:31, val:0},{x:5, y:32, val:0},{x:5, y:33, val:-1},{x:5, y:34, val:-1},{x:5, y:35, val:-1},{x:6, y:0, val:0},{x:6, y:1, val:0},{x:6, y:2, val:2},{x:6, y:3, val:5},{x:6, y:4, val:7},{x:6, y:5, val:10},{x:6, y:6, val:12},{x:6, y:7, val:14},{x:6, y:8, val:14},{x:6, y:9, val:13},{x:6, y:10, val:12},{x:6, y:11, val:11},{x:6, y:12, val:8},{x:6, y:13, val:7},{x:6, y:14, val:6},{x:6, y:15, val:5},{x:6, y:16, val:5},{x:6, y:17, val:5},{x:6, y:18, val:7},{x:6, y:19, val:8},{x:6, y:20, val:9},{x:6, y:21, val:13},{x:6, y:22, val:13},{x:6, y:23, val:14},{x:6, y:24, val:15},{x:6, y:25, val:14},{x:6, y:26, val:13},{x:6, y:27, val:9},{x:6, y:28, val:7},{x:6, y:29, val:5},{x:6, y:30, val:2},{x:6, y:31, val:1},{x:6, y:32, val:0},{x:6, y:33, val:0},{x:6, y:34, val:-1},{x:6, y:35, val:-1},{x:7, y:0, val:0},{x:7, y:1, val:2},{x:7, y:2, val:4},{x:7, y:3, val:7},{x:7, y:4, val:9},{x:7, y:5, val:11},{x:7, y:6, val:14},{x:7, y:7, val:14},{x:7, y:8, val:12},{x:7, y:9, val:9},{x:7, y:10, val:7},{x:7, y:11, val:4},{x:7, y:12, val:0},{x:7, y:13, val:-2},{x:7, y:14, val:-4},{x:7, y:15, val:-6},{x:7, y:16, val:-6},{x:7, y:17, val:-6},{x:7, y:18, val:-3},{x:7, y:19, val:-1},{x:7, y:20, val:2},{x:7, y:21, val:6},{x:7, y:22, val:9},{x:7, y:23, val:12},{x:7, y:24, val:14},{x:7, y:25, val:14},{x:7, y:26, val:14},{x:7, y:27, val:11},{x:7, y:28, val:10},{x:7, y:29, val:7},{x:7, y:30, val:4},{x:7, y:31, val:2},{x:7, y:32, val:0},{x:7, y:33, val:0},{x:7, y:34, val:0},{x:7, y:35, val:-1},{x:8, y:0, val:1},{x:8, y:1, val:3},{x:8, y:2, val:5},{x:8, y:3, val:9},{x:8, y:4, val:11},{x:8, y:5, val:13},{x:8, y:6, val:14},{x:8, y:7, val:12},{x:8, y:8, val:11},{x:8, y:9, val:6},{x:8, y:10, val:3},{x:8, y:11, val:0},{x:8, y:12, val:-6},{x:8, y:13, val:-9},{x:8, y:14, val:-12},{x:8, y:15, val:-13},{x:8, y:16, val:-13},{x:8, y:17, val:-13},{x:8, y:18, val:-9},{x:8, y:19, val:-8},{x:8, y:20, val:-4},{x:8, y:21, val:1},{x:8, y:22, val:5},{x:8, y:23, val:9},{x:8, y:24, val:12},{x:8, y:25, val:14},{x:8, y:26, val:14},{x:8, y:27, val:13},{x:8, y:28, val:12},{x:8, y:29, val:9},{x:8, y:30, val:5},{x:8, y:31, val:3},{x:8, y:32, val:1},{x:8, y:33, val:0},{x:8, y:34, val:0},{x:8, y:35, val:0},{x:9, y:0, val:2},{x:9, y:1, val:4},{x:9, y:2, val:7},{x:9, y:3, val:11},{x:9, y:4, val:13},{x:9, y:5, val:13},{x:9, y:6, val:12},{x:9, y:7, val:8},{x:9, y:8, val:5},{x:9, y:9, val:-2},{x:9, y:10, val:-8},{x:9, y:11, val:-12},{x:9, y:12, val:-19},{x:9, y:13, val:-21},{x:9, y:14, val:-25},{x:9, y:15, val:-27},{x:9, y:16, val:-27},{x:9, y:17, val:-27},{x:9, y:18, val:-23},{x:9, y:19, val:-20},{x:9, y:20, val:-16},{x:9, y:21, val:-9},{x:9, y:22, val:-5},{x:9, y:23, val:1},{x:9, y:24, val:7},{x:9, y:25, val:11},{x:9, y:26, val:13},{x:9, y:27, val:14},{x:9, y:28, val:14},{x:9, y:29, val:11},{x:9, y:30, val:7},{x:9, y:31, val:5},{x:9, y:32, val:2},{x:9, y:33, val:0},{x:9, y:34, val:0},{x:9, y:35, val:0},{x:10, y:0, val:3},{x:10, y:1, val:6},{x:10, y:2, val:8},{x:10, y:3, val:12},{x:10, y:4, val:13},{x:10, y:5, val:13},{x:10, y:6, val:10},{x:10, y:7, val:4},{x:10, y:8, val:0},{x:10, y:9, val:-8},{x:10, y:10, val:-14},{x:10, y:11, val:-20},{x:10, y:12, val:-28},{x:10, y:13, val:-30},{x:10, y:14, val:-35},{x:10, y:15, val:-37},{x:10, y:16, val:-36},{x:10, y:17, val:-36},{x:10, y:18, val:-33},{x:10, y:19, val:-29},{x:10, y:20, val:-24},{x:10, y:21, val:-17},{x:10, y:22, val:-12},{x:10, y:23, val:-4},{x:10, y:24, val:2},{x:10, y:25, val:8},{x:10, y:26, val:12},{x:10, y:27, val:14},{x:10, y:28, val:14},{x:10, y:29, val:12},{x:10, y:30, val:9},{x:10, y:31, val:6},{x:10, y:32, val:3},{x:10, y:33, val:1},{x:10, y:34, val:0},{x:10, y:35, val:0},{x:11, y:0, val:4},{x:11, y:1, val:6},{x:11, y:2, val:9},{x:11, y:3, val:13},{x:11, y:4, val:13},{x:11, y:5, val:11},{x:11, y:6, val:8},{x:11, y:7, val:1},{x:11, y:8, val:-5},{x:11, y:9, val:-15},{x:11, y:10, val:-22},{x:11, y:11, val:-28},{x:11, y:12, val:-36},{x:11, y:13, val:-39},{x:11, y:14, val:-44},{x:11, y:15, val:-45},{x:11, y:16, val:-45},{x:11, y:17, val:-45},{x:11, y:18, val:-40},{x:11, y:19, val:-37},{x:11, y:20, val:-32},{x:11, y:21, val:-25},{x:11, y:22, val:-19},{x:11, y:23, val:-10},{x:11, y:24, val:-3},{x:11, y:25, val:5},{x:11, y:26, val:9},{x:11, y:27, val:13},{x:11, y:28, val:14},{x:11, y:29, val:13},{x:11, y:30, val:10},{x:11, y:31, val:7},{x:11, y:32, val:4},{x:11, y:33, val:1},{x:11, y:34, val:0},{x:11, y:35, val:0},{x:12, y:0, val:5},{x:12, y:1, val:8},{x:12, y:2, val:11},{x:12, y:3, val:13},{x:12, y:4, val:11},{x:12, y:5, val:7},{x:12, y:6, val:3},{x:12, y:7, val:-5},{x:12, y:8, val:-12},{x:12, y:9, val:-24},{x:12, y:10, val:-32},{x:12, y:11, val:-39},{x:12, y:12, val:-48},{x:12, y:13, val:-51},{x:12, y:14, val:-56},{x:12, y:15, val:-59},{x:12, y:16, val:-58},{x:12, y:17, val:-57},{x:12, y:18, val:-53},{x:12, y:19, val:-49},{x:12, y:20, val:-43},{x:12, y:21, val:-35},{x:12, y:22, val:-28},{x:12, y:23, val:-18},{x:12, y:24, val:-10},{x:12, y:25, val:0},{x:12, y:26, val:6},{x:12, y:27, val:11},{x:12, y:28, val:14},{x:12, y:29, val:14},{x:12, y:30, val:12},{x:12, y:31, val:9},{x:12, y:32, val:5},{x:12, y:33, val:3},{x:12, y:34, val:1},{x:12, y:35, val:0},{x:13, y:0, val:5},{x:13, y:1, val:8},{x:13, y:2, val:11},{x:13, y:3, val:13},{x:13, y:4, val:11},{x:13, y:5, val:6},{x:13, y:6, val:1},{x:13, y:7, val:-9},{x:13, y:8, val:-16},{x:13, y:9, val:-28},{x:13, y:10, val:-36},{x:13, y:11, val:-43},{x:13, y:12, val:-53},{x:13, y:13, val:-57},{x:13, y:14, val:-62},{x:13, y:15, val:-65},{x:13, y:16, val:-65},{x:13, y:17, val:-64},{x:13, y:18, val:-59},{x:13, y:19, val:-55},{x:13, y:20, val:-48},{x:13, y:21, val:-39},{x:13, y:22, val:-32},{x:13, y:23, val:-21},{x:13, y:24, val:-14},{x:13, y:25, val:-3},{x:13, y:26, val:3},{x:13, y:27, val:10},{x:13, y:28, val:13},{x:13, y:29, val:14},{x:13, y:30, val:12},{x:13, y:31, val:9},{x:13, y:32, val:5},{x:13, y:33, val:3},{x:13, y:34, val:1},{x:13, y:35, val:1},{x:14, y:0, val:6},{x:14, y:1, val:9},{x:14, y:2, val:11},{x:14, y:3, val:13},{x:14, y:4, val:9},{x:14, y:5, val:3},{x:14, y:6, val:-3},{x:14, y:7, val:-14},{x:14, y:8, val:-20},{x:14, y:9, val:-34},{x:14, y:10, val:-43},{x:14, y:11, val:-50},{x:14, y:12, val:-61},{x:14, y:13, val:-64},{x:14, y:14, val:-71},{x:14, y:15, val:-73},{x:14, y:16, val:-73},{x:14, y:17, val:-73},{x:14, y:18, val:-67},{x:14, y:19, val:-63},{x:14, y:20, val:-56},{x:14, y:21, val:-46},{x:14, y:22, val:-39},{x:14, y:23, val:-27},{x:14, y:24, val:-18},{x:14, y:25, val:-9},{x:14, y:26, val:-1},{x:14, y:27, val:8},{x:14, y:28, val:13},{x:14, y:29, val:13},{x:14, y:30, val:13},{x:14, y:31, val:10},{x:14, y:32, val:7},{x:14, y:33, val:3},{x:14, y:34, val:2},{x:14, y:35, val:1},{x:15, y:0, val:6},{x:15, y:1, val:9},{x:15, y:2, val:12},{x:15, y:3, val:12},{x:15, y:4, val:8},{x:15, y:5, val:2},{x:15, y:6, val:-5},{x:15, y:7, val:-16},{x:15, y:8, val:-24},{x:15, y:9, val:-38},{x:15, y:10, val:-47},{x:15, y:11, val:-54},{x:15, y:12, val:-65},{x:15, y:13, val:-69},{x:15, y:14, val:-75},{x:15, y:15, val:-78},{x:15, y:16, val:-78},{x:15, y:17, val:-77},{x:15, y:18, val:-71},{x:15, y:19, val:-66},{x:15, y:20, val:-60},{x:15, y:21, val:-50},{x:15, y:22, val:-42},{x:15, y:23, val:-31},{x:15, y:24, val:-22},{x:15, y:25, val:-10},{x:15, y:26, val:-3},{x:15, y:27, val:6},{x:15, y:28, val:11},{x:15, y:29, val:13},{x:15, y:30, val:14},{x:15, y:31, val:11},{x:15, y:32, val:7},{x:15, y:33, val:3},{x:15, y:34, val:1},{x:15, y:35, val:1},{x:16, y:0, val:6},{x:16, y:1, val:9},{x:16, y:2, val:11},{x:16, y:3, val:11},{x:16, y:4, val:7},{x:16, y:5, val:1},{x:16, y:6, val:-6},{x:16, y:7, val:-18},{x:16, y:8, val:-26},{x:16, y:9, val:-40},{x:16, y:10, val:-50},{x:16, y:11, val:-57},{x:16, y:12, val:-69},{x:16, y:13, val:-73},{x:16, y:14, val:-79},{x:16, y:15, val:-81},{x:16, y:16, val:-81},{x:16, y:17, val:-80},{x:16, y:18, val:-75},{x:16, y:19, val:-71},{x:16, y:20, val:-63},{x:16, y:21, val:-53},{x:16, y:22, val:-45},{x:16, y:23, val:-33},{x:16, y:24, val:-24},{x:16, y:25, val:-12},{x:16, y:26, val:-4},{x:16, y:27, val:6},{x:16, y:28, val:11},{x:16, y:29, val:12},{x:16, y:30, val:14},{x:16, y:31, val:11},{x:16, y:32, val:7},{x:16, y:33, val:4},{x:16, y:34, val:2},{x:16, y:35, val:1},{x:17, y:0, val:6},{x:17, y:1, val:9},{x:17, y:2, val:11},{x:17, y:3, val:11},{x:17, y:4, val:8},{x:17, y:5, val:1},{x:17, y:6, val:-7},{x:17, y:7, val:-19},{x:17, y:8, val:-27},{x:17, y:9, val:-41},{x:17, y:10, val:-51},{x:17, y:11, val:-59},{x:17, y:12, val:-70},{x:17, y:13, val:-75},{x:17, y:14, val:-81},{x:17, y:15, val:-82},{x:17, y:16, val:-81},{x:17, y:17, val:-81},{x:17, y:18, val:-77},{x:17, y:19, val:-73},{x:17, y:20, val:-64},{x:17, y:21, val:-54},{x:17, y:22, val:-46},{x:17, y:23, val:-34},{x:17, y:24, val:-24},{x:17, y:25, val:-12},{x:17, y:26, val:-5},{x:17, y:27, val:6},{x:17, y:28, val:11},{x:17, y:29, val:12},{x:17, y:30, val:14},{x:17, y:31, val:11},{x:17, y:32, val:7},{x:17, y:33, val:4},{x:17, y:34, val:2},{x:17, y:35, val:1},{x:18, y:0, val:6},{x:18, y:1, val:9},{x:18, y:2, val:11},{x:18, y:3, val:11},{x:18, y:4, val:8},{x:18, y:5, val:2},{x:18, y:6, val:-6},{x:18, y:7, val:-18},{x:18, y:8, val:-26},{x:18, y:9, val:-39},{x:18, y:10, val:-49},{x:18, y:11, val:-57},{x:18, y:12, val:-68},{x:18, y:13, val:-73},{x:18, y:14, val:-79},{x:18, y:15, val:-81},{x:18, y:16, val:-81},{x:18, y:17, val:-81},{x:18, y:18, val:-74},{x:18, y:19, val:-70},{x:18, y:20, val:-63},{x:18, y:21, val:-53},{x:18, y:22, val:-45},{x:18, y:23, val:-33},{x:18, y:24, val:-24},{x:18, y:25, val:-11},{x:18, y:26, val:-3},{x:18, y:27, val:6},{x:18, y:28, val:11},{x:18, y:29, val:12},{x:18, y:30, val:13},{x:18, y:31, val:10},{x:18, y:32, val:6},{x:18, y:33, val:3},{x:18, y:34, val:1},{x:18, y:35, val:1},{x:19, y:0, val:6},{x:19, y:1, val:9},{x:19, y:2, val:11},{x:19, y:3, val:11},{x:19, y:4, val:7},{x:19, y:5, val:2},{x:19, y:6, val:-5},{x:19, y:7, val:-17},{x:19, y:8, val:-24},{x:19, y:9, val:-39},{x:19, y:10, val:-48},{x:19, y:11, val:-55},{x:19, y:12, val:-66},{x:19, y:13, val:-70},{x:19, y:14, val:-77},{x:19, y:15, val:-79},{x:19, y:16, val:-80},{x:19, y:17, val:-79},{x:19, y:18, val:-73},{x:19, y:19, val:-68},{x:19, y:20, val:-61},{x:19, y:21, val:-50},{x:19, y:22, val:-43},{x:19, y:23, val:-31},{x:19, y:24, val:-23},{x:19, y:25, val:-11},{x:19, y:26, val:-3},{x:19, y:27, val:6},{x:19, y:28, val:11},{x:19, y:29, val:12},{x:19, y:30, val:13},{x:19, y:31, val:10},{x:19, y:32, val:6},{x:19, y:33, val:3},{x:19, y:34, val:2},{x:19, y:35, val:1},{x:20, y:0, val:5},{x:20, y:1, val:8},{x:20, y:2, val:11},{x:20, y:3, val:11},{x:20, y:4, val:9},{x:20, y:5, val:4},{x:20, y:6, val:-3},{x:20, y:7, val:-14},{x:20, y:8, val:-22},{x:20, y:9, val:-35},{x:20, y:10, val:-44},{x:20, y:11, val:-50},{x:20, y:12, val:-62},{x:20, y:13, val:-66},{x:20, y:14, val:-71},{x:20, y:15, val:-74},{x:20, y:16, val:-74},{x:20, y:17, val:-74},{x:20, y:18, val:-67},{x:20, y:19, val:-63},{x:20, y:20, val:-56},{x:20, y:21, val:-47},{x:20, y:22, val:-39},{x:20, y:23, val:-28},{x:20, y:24, val:-19},{x:20, y:25, val:-8},{x:20, y:26, val:0},{x:20, y:27, val:7},{x:20, y:28, val:11},{x:20, y:29, val:13},{x:20, y:30, val:12},{x:20, y:31, val:9},{x:20, y:32, val:5},{x:20, y:33, val:3},{x:20, y:34, val:1},{x:20, y:35, val:0},{x:21, y:0, val:4},{x:21, y:1, val:7},{x:21, y:2, val:10},{x:21, y:3, val:11},{x:21, y:4, val:9},{x:21, y:5, val:6},{x:21, y:6, val:0},{x:21, y:7, val:-9},{x:21, y:8, val:-17},{x:21, y:9, val:-28},{x:21, y:10, val:-37},{x:21, y:11, val:-44},{x:21, y:12, val:-54},{x:21, y:13, val:-58},{x:21, y:14, val:-63},{x:21, y:15, val:-65},{x:21, y:16, val:-65},{x:21, y:17, val:-65},{x:21, y:18, val:-59},{x:21, y:19, val:-56},{x:21, y:20, val:-49},{x:21, y:21, val:-40},{x:21, y:22, val:-33},{x:21, y:23, val:-23},{x:21, y:24, val:-15},{x:21, y:25, val:-4},{x:21, y:26, val:2},{x:21, y:27, val:8},{x:21, y:28, val:12},{x:21, y:29, val:12},{x:21, y:30, val:11},{x:21, y:31, val:7},{x:21, y:32, val:4},{x:21, y:33, val:2},{x:21, y:34, val:0},{x:21, y:35, val:0},{x:22, y:0, val:4},{x:22, y:1, val:6},{x:22, y:2, val:9},{x:22, y:3, val:11},{x:22, y:4, val:10},{x:22, y:5, val:7},{x:22, y:6, val:2},{x:22, y:7, val:-6},{x:22, y:8, val:-13},{x:22, y:9, val:-23},{x:22, y:10, val:-31},{x:22, y:11, val:-38},{x:22, y:12, val:-47},{x:22, y:13, val:-50},{x:22, y:14, val:-55},{x:22, y:15, val:-58},{x:22, y:16, val:-58},{x:22, y:17, val:-58},{x:22, y:18, val:-53},{x:22, y:19, val:-49},{x:22, y:20, val:-43},{x:22, y:21, val:-35},{x:22, y:22, val:-28},{x:22, y:23, val:-18},{x:22, y:24, val:-11},{x:22, y:25, val:-1},{x:22, y:26, val:4},{x:22, y:27, val:9},{x:22, y:28, val:12},{x:22, y:29, val:12},{x:22, y:30, val:10},{x:22, y:31, val:7},{x:22, y:32, val:3},{x:22, y:33, val:1},{x:22, y:34, val:0},{x:22, y:35, val:0},{x:23, y:0, val:3},{x:23, y:1, val:4},{x:23, y:2, val:8},{x:23, y:3, val:10},{x:23, y:4, val:10},{x:23, y:5, val:9},{x:23, y:6, val:5},{x:23, y:7, val:-1},{x:23, y:8, val:-7},{x:23, y:9, val:-16},{x:23, y:10, val:-22},{x:23, y:11, val:-28},{x:23, y:12, val:-37},{x:23, y:13, val:-41},{x:23, y:14, val:-45},{x:23, y:15, val:-47},{x:23, y:16, val:-47},{x:23, y:17, val:-47},{x:23, y:18, val:-42},{x:23, y:19, val:-39},{x:23, y:20, val:-33},{x:23, y:21, val:-26},{x:23, y:22, val:-20},{x:23, y:23, val:-11},{x:23, y:24, val:-5},{x:23, y:25, val:3},{x:23, y:26, val:7},{x:23, y:27, val:11},{x:23, y:28, val:12},{x:23, y:29, val:11},{x:23, y:30, val:8},{x:23, y:31, val:6},{x:23, y:32, val:2},{x:23, y:33, val:0},{x:23, y:34, val:0},{x:23, y:35, val:0},{x:24, y:0, val:1},{x:24, y:1, val:3},{x:24, y:2, val:6},{x:24, y:3, val:9},{x:24, y:4, val:10},{x:24, y:5, val:10},{x:24, y:6, val:7},{x:24, y:7, val:3},{x:24, y:8, val:-2},{x:24, y:9, val:-10},{x:24, y:10, val:-16},{x:24, y:11, val:-21},{x:24, y:12, val:-29},{x:24, y:13, val:-32},{x:24, y:14, val:-36},{x:24, y:15, val:-39},{x:24, y:16, val:-39},{x:24, y:17, val:-38},{x:24, y:18, val:-34},{x:24, y:19, val:-30},{x:24, y:20, val:-25},{x:24, y:21, val:-19},{x:24, y:22, val:-14},{x:24, y:23, val:-6},{x:24, y:24, val:-1},{x:24, y:25, val:6},{x:24, y:26, val:9},{x:24, y:27, val:12},{x:24, y:28, val:12},{x:24, y:29, val:10},{x:24, y:30, val:7},{x:24, y:31, val:4},{x:24, y:32, val:1},{x:24, y:33, val:0},{x:24, y:34, val:0},{x:24, y:35, val:0},{x:25, y:0, val:0},{x:25, y:1, val:2},{x:25, y:2, val:4},{x:25, y:3, val:8},{x:25, y:4, val:9},{x:25, y:5, val:10},{x:25, y:6, val:9},{x:25, y:7, val:6},{x:25, y:8, val:4},{x:25, y:9, val:-3},{x:25, y:10, val:-7},{x:25, y:11, val:-11},{x:25, y:12, val:-18},{x:25, y:13, val:-20},{x:25, y:14, val:-24},{x:25, y:15, val:-26},{x:25, y:16, val:-26},{x:25, y:17, val:-26},{x:25, y:18, val:-22},{x:25, y:19, val:-19},{x:25, y:20, val:-15},{x:25, y:21, val:-9},{x:25, y:22, val:-5},{x:25, y:23, val:1},{x:25, y:24, val:4},{x:25, y:25, val:9},{x:25, y:26, val:11},{x:25, y:27, val:12},{x:25, y:28, val:11},{x:25, y:29, val:8},{x:25, y:30, val:4},{x:25, y:31, val:2},{x:25, y:32, val:0},{x:25, y:33, val:0},{x:25, y:34, val:0},{x:25, y:35, val:0},{x:26, y:0, val:0},{x:26, y:1, val:1},{x:26, y:2, val:3},{x:26, y:3, val:6},{x:26, y:4, val:8},{x:26, y:5, val:10},{x:26, y:6, val:10},{x:26, y:7, val:9},{x:26, y:8, val:7},{x:26, y:9, val:2},{x:26, y:10, val:-1},{x:26, y:11, val:-5},{x:26, y:12, val:-10},{x:26, y:13, val:-13},{x:26, y:14, val:-16},{x:26, y:15, val:-17},{x:26, y:16, val:-17},{x:26, y:17, val:-16},{x:26, y:18, val:-14},{x:26, y:19, val:-11},{x:26, y:20, val:-8},{x:26, y:21, val:-3},{x:26, y:22, val:1},{x:26, y:23, val:5},{x:26, y:24, val:8},{x:26, y:25, val:11},{x:26, y:26, val:12},{x:26, y:27, val:11},{x:26, y:28, val:9},{x:26, y:29, val:6},{x:26, y:30, val:3},{x:26, y:31, val:1},{x:26, y:32, val:0},{x:26, y:33, val:0},{x:26, y:34, val:0},{x:26, y:35, val:-1},{x:27, y:0, val:0},{x:27, y:1, val:0},{x:27, y:2, val:1},{x:27, y:3, val:4},{x:27, y:4, val:6},{x:27, y:5, val:8},{x:27, y:6, val:10},{x:27, y:7, val:10},{x:27, y:8, val:10},{x:27, y:9, val:7},{x:27, y:10, val:6},{x:27, y:11, val:3},{x:27, y:12, val:-1},{x:27, y:13, val:-3},{x:27, y:14, val:-5},{x:27, y:15, val:-6},{x:27, y:16, val:-6},{x:27, y:17, val:-6},{x:27, y:18, val:-4},{x:27, y:19, val:-2},{x:27, y:20, val:1},{x:27, y:21, val:4},{x:27, y:22, val:6},{x:27, y:23, val:9},{x:27, y:24, val:10},{x:27, y:25, val:11},{x:27, y:26, val:11},{x:27, y:27, val:8},{x:27, y:28, val:6},{x:27, y:29, val:4},{x:27, y:30, val:1},{x:27, y:31, val:0},{x:27, y:32, val:0},{x:27, y:33, val:0},{x:27, y:34, val:-1},{x:27, y:35, val:-1},{x:28, y:0, val:-1},{x:28, y:1, val:0},{x:28, y:2, val:0},{x:28, y:3, val:2},{x:28, y:4, val:3},{x:28, y:5, val:6},{x:28, y:6, val:8},{x:28, y:7, val:10},{x:28, y:8, val:10},{x:28, y:9, val:10},{x:28, y:10, val:9},{x:28, y:11, val:7},{x:28, y:12, val:6},{x:28, y:13, val:4},{x:28, y:14, val:3},{x:28, y:15, val:3},{x:28, y:16, val:3},{x:28, y:17, val:2},{x:28, y:18, val:4},{x:28, y:19, val:5},{x:28, y:20, val:6},{x:28, y:21, val:9},{x:28, y:22, val:10},{x:28, y:23, val:11},{x:28, y:24, val:11},{x:28, y:25, val:10},{x:28, y:26, val:9},{x:28, y:27, val:6},{x:28, y:28, val:4},{x:28, y:29, val:2},{x:28, y:30, val:0},{x:28, y:31, val:0},{x:28, y:32, val:-1},{x:28, y:33, val:-1},{x:28, y:34, val:-1},{x:28, y:35, val:-1},{x:29, y:0, val:0},{x:29, y:1, val:-1},{x:29, y:2, val:0},{x:29, y:3, val:0},{x:29, y:4, val:1},{x:29, y:5, val:3},{x:29, y:6, val:5},{x:29, y:7, val:8},{x:29, y:8, val:9},{x:29, y:9, val:10},{x:29, y:10, val:10},{x:29, y:11, val:9},{x:29, y:12, val:8},{x:29, y:13, val:7},{x:29, y:14, val:7},{x:29, y:15, val:6},{x:29, y:16, val:6},{x:29, y:17, val:6},{x:29, y:18, val:7},{x:29, y:19, val:8},{x:29, y:20, val:9},{x:29, y:21, val:10},{x:29, y:22, val:11},{x:29, y:23, val:10},{x:29, y:24, val:9},{x:29, y:25, val:8},{x:29, y:26, val:6},{x:29, y:27, val:4},{x:29, y:28, val:2},{x:29, y:29, val:1},{x:29, y:30, val:0},{x:29, y:31, val:0},{x:29, y:32, val:-1},{x:29, y:33, val:-1},{x:29, y:34, val:0},{x:29, y:35, val:0},{x:30, y:0, val:0},{x:30, y:1, val:-1},{x:30, y:2, val:-1},{x:30, y:3, val:0},{x:30, y:4, val:0},{x:30, y:5, val:1},{x:30, y:6, val:3},{x:30, y:7, val:5},{x:30, y:8, val:6},{x:30, y:9, val:8},{x:30, y:10, val:9},{x:30, y:11, val:10},{x:30, y:12, val:10},{x:30, y:13, val:10},{x:30, y:14, val:10},{x:30, y:15, val:10},{x:30, y:16, val:10},{x:30, y:17, val:10},{x:30, y:18, val:10},{x:30, y:19, val:11},{x:30, y:20, val:11},{x:30, y:21, val:11},{x:30, y:22, val:10},{x:30, y:23, val:9},{x:30, y:24, val:7},{x:30, y:25, val:4},{x:30, y:26, val:3},{x:30, y:27, val:1},{x:30, y:28, val:0},{x:30, y:29, val:0},{x:30, y:30, val:-1},{x:30, y:31, val:-1},{x:30, y:32, val:-1},{x:30, y:33, val:-1},{x:30, y:34, val:0},{x:30, y:35, val:0},{x:31, y:0, val:-1},{x:31, y:1, val:-1},{x:31, y:2, val:-1},{x:31, y:3, val:0},{x:31, y:4, val:0},{x:31, y:5, val:0},{x:31, y:6, val:1},{x:31, y:7, val:3},{x:31, y:8, val:4},{x:31, y:9, val:6},{x:31, y:10, val:7},{x:31, y:11, val:8},{x:31, y:12, val:8},{x:31, y:13, val:9},{x:31, y:14, val:9},{x:31, y:15, val:10},{x:31, y:16, val:10},{x:31, y:17, val:10},{x:31, y:18, val:9},{x:31, y:19, val:9},{x:31, y:20, val:9},{x:31, y:21, val:8},{x:31, y:22, val:7},{x:31, y:23, val:5},{x:31, y:24, val:4},{x:31, y:25, val:3},{x:31, y:26, val:1},{x:31, y:27, val:0},{x:31, y:28, val:0},{x:31, y:29, val:0},{x:31, y:30, val:-1},{x:31, y:31, val:-1},{x:31, y:32, val:-1},{x:31, y:33, val:-1},{x:31, y:34, val:0},{x:31, y:35, val:0},{x:32, y:0, val:0},{x:32, y:1, val:-1},{x:32, y:2, val:-1},{x:32, y:3, val:-1},{x:32, y:4, val:-1},{x:32, y:5, val:0},{x:32, y:6, val:0},{x:32, y:7, val:1},{x:32, y:8, val:1},{x:32, y:9, val:3},{x:32, y:10, val:3},{x:32, y:11, val:4},{x:32, y:12, val:6},{x:32, y:13, val:6},{x:32, y:14, val:7},{x:32, y:15, val:8},{x:32, y:16, val:8},{x:32, y:17, val:8},{x:32, y:18, val:7},{x:32, y:19, val:6},{x:32, y:20, val:6},{x:32, y:21, val:4},{x:32, y:22, val:3},{x:32, y:23, val:2},{x:32, y:24, val:1},{x:32, y:25, val:0},{x:32, y:26, val:0},{x:32, y:27, val:0},{x:32, y:28, val:-1},{x:32, y:29, val:-1},{x:32, y:30, val:-1},{x:32, y:31, val:-1},{x:32, y:32, val:0},{x:32, y:33, val:0},{x:32, y:34, val:0},{x:32, y:35, val:0},{x:33, y:0, val:-1},{x:33, y:1, val:-1},{x:33, y:2, val:-1},{x:33, y:3, val:-1},{x:33, y:4, val:-1},{x:33, y:5, val:0},{x:33, y:6, val:0},{x:33, y:7, val:0},{x:33, y:8, val:0},{x:33, y:9, val:0},{x:33, y:10, val:1},{x:33, y:11, val:2},{x:33, y:12, val:3},{x:33, y:13, val:3},{x:33, y:14, val:4},{x:33, y:15, val:4},{x:33, y:16, val:4},{x:33, y:17, val:5},{x:33, y:18, val:4},{x:33, y:19, val:4},{x:33, y:20, val:3},{x:33, y:21, val:2},{x:33, y:22, val:1},{x:33, y:23, val:0},{x:33, y:24, val:0},{x:33, y:25, val:0},{x:33, y:26, val:0},{x:33, y:27, val:0},{x:33, y:28, val:-1},{x:33, y:29, val:-1},{x:33, y:30, val:-1},{x:33, y:31, val:-1},{x:33, y:32, val:0},{x:33, y:33, val:0},{x:33, y:34, val:-1},{x:33, y:35, val:-1},{x:34, y:0, val:0},{x:34, y:1, val:0},{x:34, y:2, val:0},{x:34, y:3, val:-1},{x:34, y:4, val:-1},{x:34, y:5, val:-1},{x:34, y:6, val:-1},{x:34, y:7, val:0},{x:34, y:8, val:0},{x:34, y:9, val:0},{x:34, y:10, val:0},{x:34, y:11, val:0},{x:34, y:12, val:1},{x:34, y:13, val:1},{x:34, y:14, val:2},{x:34, y:15, val:2},{x:34, y:16, val:3},{x:34, y:17, val:2},{x:34, y:18, val:2},{x:34, y:19, val:2},{x:34, y:20, val:1},{x:34, y:21, val:0},{x:34, y:22, val:0},{x:34, y:23, val:0},{x:34, y:24, val:0},{x:34, y:25, val:0},{x:34, y:26, val:0},{x:34, y:27, val:-1},{x:34, y:28, val:-1},{x:34, y:29, val:0},{x:34, y:30, val:0},{x:34, y:31, val:0},{x:34, y:32, val:0},{x:34, y:33, val:-1},{x:34, y:34, val:0},{x:34, y:35, val:0},{x:35, y:0, val:0},{x:35, y:1, val:0},{x:35, y:2, val:0},{x:35, y:3, val:-1},{x:35, y:4, val:-1},{x:35, y:5, val:-1},{x:35, y:6, val:-1},{x:35, y:7, val:-1},{x:35, y:8, val:0},{x:35, y:9, val:0},{x:35, y:10, val:0},{x:35, y:11, val:0},{x:35, y:12, val:0},{x:35, y:13, val:1},{x:35, y:14, val:1},{x:35, y:15, val:2},{x:35, y:16, val:2},{x:35, y:17, val:2},{x:35, y:18, val:2},{x:35, y:19, val:1},{x:35, y:20, val:0},{x:35, y:21, val:0},{x:35, y:22, val:0},{x:35, y:23, val:0},{x:35, y:24, val:0},{x:35, y:25, val:0},{x:35, y:26, val:-1},{x:35, y:27, val:-1},{x:35, y:28, val:-1},{x:35, y:29, val:0},{x:35, y:30, val:0},{x:35, y:31, val:0},{x:35, y:32, val:0},{x:35, y:33, val:-1},{x:35, y:34, val:0},{x:35, y:35, val:0}]
        },
    };

    // メイン関数実行
    main();
});