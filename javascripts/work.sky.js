$(function() {

    var main = function(){
        setScene();
        render();
        drawClear();
        selectMyDrawStyle("pen-1");
        // Canvasのタッチ・マウスイベント処理をバインド
        $("canvas").bind('click mousedown mouseup mousemove mouseleave mouseout touchstart touchmove touchend touchcancel', onEvent);
        
        toast.show('空に指で雲を描いてみよう');
    }

    var myDrawStyle = "pen-1";
    var painting = false;
    var preMouse = null;

    var SIZE = 330;
    var TSIZE = 256;
    
    var scene = new THREE.Scene();
    var w, h,     
        camera, group,ambLight,dirLight,
        segment,geometry,texture,
        textureCloud,
        ctxAlpha,textureAlpha,heightMap,imgCanvasAlpha,
        material,
        mesh, // 高さ(0-255)を保持する二次元配列
        texScale,
        ctxBump,textureBump,arrayMapBump,imgCanvasBump;
        
    // 1pixelの描画
    // zFix = -200[bottom] ～ 0[flat] ～ +55[top]
    // zFix < 0 = black
    var drawPoint = function(x, y, zFix, drawStyle) {
        // x,yがマップから出ていれば除外
        if (x < 0 || x >= TSIZE) return;
        if (y < 0 || y >= TSIZE) return;
        // 絶対値n以下は除外
        if (zFix < 3) return;
        
        var org = heightMap[x][y];
        //既に描かれた箇所の場合
        //0～255を0～1に正規化する。それを反転させる
        var keisu = 1 - org*0.00392156862; 
        var h = org + zFix*0.15*keisu;
        h = Math.round( h );

        // 0-255に収める
        if (h < 0) h = 0;
        if (h > 255) h = 255;
        // 更新
        heightMap[x][y] = h;
        // 描画
        ctxAlpha.fillStyle = "rgb("+h+", "+h+", "+h+")";
        ctxAlpha.fillRect(x, y, 1, 1);

        // BumpMap用データ
/*        var org = arrayMapBump[x][y];
        //既に描かれた箇所の場合
        //0～255を0～1に正規化する。それを反転させる
//        var keisu = 1 - org*0.00392156862; 
        var h = org + zFix*0.0001;//*keisu;
        h = Math.round( h );

        // 0-255に収める
        if (h < 0) h = 0;
        if (h > 255) h = 255;
        // 更新
        arrayMapBump[x][y] = h;
        ctxBump.fillStyle = "rgb("+h+", "+h+", "+h+")";
        ctxBump.fillRect(x, y, 1, 1);*/
    }

    // 1Circleの描画
    var drawCircle = function(x, y, drawStyle) {
        drawStyle = "pen-" + (Math.round(Math.random() * 4) + 1);
        x = Math.round(x * texScale)+(Math.round(Math.random() * 6) - 3);
        y = Math.round(y * texScale)+(Math.round(Math.random() * 6) - 3);
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
        // すべて0で初期化する
        heightMap = [];
        arrayMapBump = [];
        for (var i = 0 ; i < TSIZE ; i++) {
            var m = [];
            for (var j = 0 ; j < TSIZE ; j++) {
                m.push(0);
            }
            heightMap.push(m);
            arrayMapBump.push(m);
        }
    }

    // 作画をクリア
    var drawClear = function() {
        // 0で塗りつぶし
        ctxAlpha.fillStyle = "rgb(0, 0, 0)";
        ctxAlpha.fillRect(0, 0, imgCanvasAlpha.width, imgCanvasAlpha.height);
        
        material_blur.alphaMap.needsUpdate = true;

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
    $("#x-plus-btn").click(function(){
        dirLight.position.x += 0.1;
        console.log("x",dirLight.position.x);
    });
    $("#x-minus-btn").click(function(){
        dirLight.position.x -= 0.1;
        console.log("x",dirLight.position.x);
    });
    $("#y-plus-btn").click(function(){
        dirLight.position.y += 0.1;
        console.log("y",dirLight.position.y);
    });
    $("#y-minus-btn").click(function(){
        dirLight.position.y -= 0.1;
        console.log("y",dirLight.position.y);
    });

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
        var texNo = 1;//Math.round(Math.random() * 4) + 1;
        texture = setTexture($("#change-tex-btn" + texNo));
        textureCloud = setTextureCloud($("#change-tex-btn" + texNo));

        imgCanvasAlpha = document.createElement('canvas');
        imgCanvasAlpha.width = TSIZE;
        imgCanvasAlpha.height = TSIZE;
        ctxAlpha = imgCanvasAlpha.getContext('2d');
        textureAlpha = new THREE.Texture(imgCanvasAlpha);
        textureAlpha.needsUpdate = true;
/*
        imgCanvasBump = document.createElement('canvas');
        imgCanvasBump.width = TSIZE;
        imgCanvasBump.height = TSIZE;
        ctxBump = imgCanvasBump.getContext('2d');
        textureBump = new THREE.Texture(imgCanvasBump);
        textureBump.needsUpdate = true;
*/
        //var material = new THREE.MeshPhongMaterial( { map:textureBump/*map: texture, bumpMap:textureBump, bumpScale: 3*/, overdraw: 0.5 } );
        material = new THREE.MeshPhongMaterial( { 
            specular: 0x000000, shininess: 0,
            map: texture, overdraw: 0.5 } );
        mesh = new THREE.Mesh( geometry, material );        
        group.add( mesh );
        
        // 透過させるマテリアル
        material_blur = new THREE.MeshPhongMaterial( { 
            specular: 0x000000, shininess: 0, overdraw: 0.5,
            map: textureCloud,
//            color:'rgb(255, 255, 255)',
            alphaMap: textureAlpha,
            bumpMap: textureAlpha, bumpScale: 2,
            transparent: true, depthTest: false, } );

        mesh_blur = new THREE.Mesh( geometry_blur, material_blur );        
        group.add( mesh_blur );

        texScale = TSIZE / SIZE;
    };

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
                    
            material_blur.alphaMap.needsUpdate = true;  
        }
        e.preventDefault();
    };

    
    // 描画をしたか
    window.drawedValidate = function(){
        for (var i = 0 ; i < TSIZE ; i++) {
            for (var j = 0 ; j < TSIZE ; j++) {
                if (heightMap[i][j] !== 0) return true;
            }
        }
        return false;
    };

    var selectMyDrawStyle = function(style) {
        myDrawStyle = style;
    }
    
    $("#draw-clear-btn").click(function(){
        drawClear();
    });
    var setTexture = function(btnElem){
        texture  = new THREE.ImageUtils.loadTexture(
            '/pittura-demo/images/tex/sky/sky' + btnElem.attr("val") + '.jpg');
        // 選択枠
        $(".change-tex-btn").removeClass('change-tex-btn-selected');
        btnElem.addClass('change-tex-btn-selected');
        return texture;
    }
    var setTextureCloud = function(btnElem){
        textureCloud  = new THREE.ImageUtils.loadTexture(
            '/pittura-demo/images/tex/sky/cloud' + btnElem.attr("val") + '.jpg');
        return textureCloud;
    }
    $(".change-tex-btn").click(function(){
        material.map = setTexture($(this));
        material_blur.map = setTextureCloud($(this));
    });


    var pen = {
        'pen-1' : {name:'pen-1', half:9, length:324, inter:3,
            data:[
{x:0, y:0, val:0},{x:0, y:1, val:0},{x:0, y:2, val:1},{x:0, y:3, val:4},{x:0, y:4, val:14},{x:0, y:5, val:25},{x:0, y:6, val:32},{x:0, y:7, val:35},{x:0, y:8, val:34},{x:0, y:9, val:22},{x:0, y:10, val:12},{x:0, y:11, val:3},{x:0, y:12, val:0},{x:0, y:13, val:0},{x:0, y:14, val:0},{x:0, y:15, val:0},{x:0, y:16, val:0},{x:0, y:17, val:0},{x:1, y:0, val:0},{x:1, y:1, val:2},{x:1, y:2, val:11},{x:1, y:3, val:25},{x:1, y:4, val:40},{x:1, y:5, val:47},{x:1, y:6, val:50},{x:1, y:7, val:56},{x:1, y:8, val:59},{x:1, y:9, val:46},{x:1, y:10, val:31},{x:1, y:11, val:12},{x:1, y:12, val:2},{x:1, y:13, val:1},{x:1, y:14, val:0},{x:1, y:15, val:0},{x:1, y:16, val:0},{x:1, y:17, val:0},{x:2, y:0, val:2},{x:2, y:1, val:14},{x:2, y:2, val:41},{x:2, y:3, val:72},{x:2, y:4, val:90},{x:2, y:5, val:82},{x:2, y:6, val:71},{x:2, y:7, val:83},{x:2, y:8, val:93},{x:2, y:9, val:81},{x:2, y:10, val:57},{x:2, y:11, val:30},{x:2, y:12, val:13},{x:2, y:13, val:8},{x:2, y:14, val:3},{x:2, y:15, val:1},{x:2, y:16, val:0},{x:2, y:17, val:0},{x:3, y:0, val:5},{x:3, y:1, val:28},{x:3, y:2, val:70},{x:3, y:3, val:119},{x:3, y:4, val:142},{x:3, y:5, val:127},{x:3, y:6, val:111},{x:3, y:7, val:119},{x:3, y:8, val:121},{x:3, y:9, val:105},{x:3, y:10, val:79},{x:3, y:11, val:57},{x:3, y:12, val:39},{x:3, y:13, val:22},{x:3, y:14, val:11},{x:3, y:15, val:5},{x:3, y:16, val:1},{x:3, y:17, val:0},{x:4, y:0, val:8},{x:4, y:1, val:31},{x:4, y:2, val:72},{x:4, y:3, val:128},{x:4, y:4, val:158},{x:4, y:5, val:152},{x:4, y:6, val:146},{x:4, y:7, val:148},{x:4, y:8, val:147},{x:4, y:9, val:119},{x:4, y:10, val:109},{x:4, y:11, val:107},{x:4, y:12, val:89},{x:4, y:13, val:52},{x:4, y:14, val:24},{x:4, y:15, val:12},{x:4, y:16, val:2},{x:4, y:17, val:0},{x:5, y:0, val:11},{x:5, y:1, val:36},{x:5, y:2, val:70},{x:5, y:3, val:109},{x:5, y:4, val:134},{x:5, y:5, val:142},{x:5, y:6, val:153},{x:5, y:7, val:161},{x:5, y:8, val:159},{x:5, y:9, val:142},{x:5, y:10, val:150},{x:5, y:11, val:163},{x:5, y:12, val:142},{x:5, y:13, val:94},{x:5, y:14, val:52},{x:5, y:15, val:26},{x:5, y:16, val:7},{x:5, y:17, val:4},{x:6, y:0, val:18},{x:6, y:1, val:54},{x:6, y:2, val:82},{x:6, y:3, val:99},{x:6, y:4, val:110},{x:6, y:5, val:122},{x:6, y:6, val:145},{x:6, y:7, val:161},{x:6, y:8, val:159},{x:6, y:9, val:160},{x:6, y:10, val:179},{x:6, y:11, val:190},{x:6, y:12, val:169},{x:6, y:13, val:123},{x:6, y:14, val:75},{x:6, y:15, val:43},{x:6, y:16, val:19},{x:6, y:17, val:15},{x:7, y:0, val:28},{x:7, y:1, val:65},{x:7, y:2, val:93},{x:7, y:3, val:104},{x:7, y:4, val:105},{x:7, y:5, val:111},{x:7, y:6, val:128},{x:7, y:7, val:147},{x:7, y:8, val:149},{x:7, y:9, val:166},{x:7, y:10, val:187},{x:7, y:11, val:189},{x:7, y:12, val:171},{x:7, y:13, val:135},{x:7, y:14, val:99},{x:7, y:15, val:72},{x:7, y:16, val:46},{x:7, y:17, val:41},{x:8, y:0, val:37},{x:8, y:1, val:69},{x:8, y:2, val:101},{x:8, y:3, val:120},{x:8, y:4, val:119},{x:8, y:5, val:106},{x:8, y:6, val:104},{x:8, y:7, val:124},{x:8, y:8, val:146},{x:8, y:9, val:175},{x:8, y:10, val:188},{x:8, y:11, val:178},{x:8, y:12, val:158},{x:8, y:13, val:141},{x:8, y:14, val:136},{x:8, y:15, val:121},{x:8, y:16, val:81},{x:8, y:17, val:72},{x:9, y:0, val:56},{x:9, y:1, val:86},{x:9, y:2, val:118},{x:9, y:3, val:140},{x:9, y:4, val:137},{x:9, y:5, val:103},{x:9, y:6, val:83},{x:9, y:7, val:99},{x:9, y:8, val:129},{x:9, y:9, val:150},{x:9, y:10, val:162},{x:9, y:11, val:153},{x:9, y:12, val:129},{x:9, y:13, val:117},{x:9, y:14, val:122},{x:9, y:15, val:117},{x:9, y:16, val:80},{x:9, y:17, val:72},{x:10, y:0, val:63},{x:10, y:1, val:91},{x:10, y:2, val:123},{x:10, y:3, val:148},{x:10, y:4, val:147},{x:10, y:5, val:113},{x:10, y:6, val:88},{x:10, y:7, val:96},{x:10, y:8, val:115},{x:10, y:9, val:125},{x:10, y:10, val:135},{x:10, y:11, val:130},{x:10, y:12, val:109},{x:10, y:13, val:99},{x:10, y:14, val:103},{x:10, y:15, val:96},{x:10, y:16, val:67},{x:10, y:17, val:61},{x:11, y:0, val:54},{x:11, y:1, val:86},{x:11, y:2, val:118},{x:11, y:3, val:145},{x:11, y:4, val:151},{x:11, y:5, val:123},{x:11, y:6, val:97},{x:11, y:7, val:98},{x:11, y:8, val:114},{x:11, y:9, val:129},{x:11, y:10, val:135},{x:11, y:11, val:132},{x:11, y:12, val:114},{x:11, y:13, val:107},{x:11, y:14, val:111},{x:11, y:15, val:98},{x:11, y:16, val:66},{x:11, y:17, val:59},{x:12, y:0, val:28},{x:12, y:1, val:66},{x:12, y:2, val:101},{x:12, y:3, val:128},{x:12, y:4, val:138},{x:12, y:5, val:118},{x:12, y:6, val:95},{x:12, y:7, val:92},{x:12, y:8, val:117},{x:12, y:9, val:153},{x:12, y:10, val:154},{x:12, y:11, val:146},{x:12, y:12, val:130},{x:12, y:13, val:123},{x:12, y:14, val:120},{x:12, y:15, val:99},{x:12, y:16, val:58},{x:12, y:17, val:49},{x:13, y:0, val:7},{x:13, y:1, val:37},{x:13, y:2, val:76},{x:13, y:3, val:96},{x:13, y:4, val:101},{x:13, y:5, val:98},{x:13, y:6, val:94},{x:13, y:7, val:94},{x:13, y:8, val:121},{x:13, y:9, val:160},{x:13, y:10, val:158},{x:13, y:11, val:145},{x:13, y:12, val:121},{x:13, y:13, val:106},{x:13, y:14, val:101},{x:13, y:15, val:77},{x:13, y:16, val:34},{x:13, y:17, val:25},{x:14, y:0, val:1},{x:14, y:1, val:16},{x:14, y:2, val:44},{x:14, y:3, val:56},{x:14, y:4, val:56},{x:14, y:5, val:67},{x:14, y:6, val:91},{x:14, y:7, val:108},{x:14, y:8, val:127},{x:14, y:9, val:144},{x:14, y:10, val:139},{x:14, y:11, val:119},{x:14, y:12, val:88},{x:14, y:13, val:70},{x:14, y:14, val:66},{x:14, y:15, val:46},{x:14, y:16, val:13},{x:14, y:17, val:7},{x:15, y:0, val:0},{x:15, y:1, val:5},{x:15, y:2, val:23},{x:15, y:3, val:36},{x:15, y:4, val:40},{x:15, y:5, val:55},{x:15, y:6, val:79},{x:15, y:7, val:100},{x:15, y:8, val:111},{x:15, y:9, val:112},{x:15, y:10, val:107},{x:15, y:11, val:94},{x:15, y:12, val:71},{x:15, y:13, val:54},{x:15, y:14, val:45},{x:15, y:15, val:25},{x:15, y:16, val:5},{x:15, y:17, val:2},{x:16, y:0, val:0},{x:16, y:1, val:1},{x:16, y:2, val:9},{x:16, y:3, val:26},{x:16, y:4, val:43},{x:16, y:5, val:55},{x:16, y:6, val:64},{x:16, y:7, val:70},{x:16, y:8, val:73},{x:16, y:9, val:68},{x:16, y:10, val:66},{x:16, y:11, val:65},{x:16, y:12, val:52},{x:16, y:13, val:37},{x:16, y:14, val:22},{x:16, y:15, val:8},{x:16, y:16, val:1},{x:16, y:17, val:0},{x:17, y:0, val:0},{x:17, y:1, val:1},{x:17, y:2, val:7},{x:17, y:3, val:24},{x:17, y:4, val:44},{x:17, y:5, val:56},{x:17, y:6, val:61},{x:17, y:7, val:64},{x:17, y:8, val:66},{x:17, y:9, val:59},{x:17, y:10, val:58},{x:17, y:11, val:59},{x:17, y:12, val:48},{x:17, y:13, val:34},{x:17, y:14, val:18},{x:17, y:15, val:5},{x:17, y:16, val:0},{x:17, y:17, val:0}

                
            ]
        },
        'pen-2' : {name:'pen-2', half:9, length:324, inter:3,
            data:[

{x:0, y:0, val:0},{x:0, y:1, val:2},{x:0, y:2, val:13},{x:0, y:3, val:33},{x:0, y:4, val:44},{x:0, y:5, val:42},{x:0, y:6, val:35},{x:0, y:7, val:32},{x:0, y:8, val:34},{x:0, y:9, val:29},{x:0, y:10, val:16},{x:0, y:11, val:7},{x:0, y:12, val:3},{x:0, y:13, val:1},{x:0, y:14, val:0},{x:0, y:15, val:0},{x:0, y:16, val:0},{x:0, y:17, val:0},{x:1, y:0, val:1},{x:1, y:1, val:8},{x:1, y:2, val:34},{x:1, y:3, val:65},{x:1, y:4, val:83},{x:1, y:5, val:79},{x:1, y:6, val:68},{x:1, y:7, val:64},{x:1, y:8, val:70},{x:1, y:9, val:67},{x:1, y:10, val:55},{x:1, y:11, val:45},{x:1, y:12, val:32},{x:1, y:13, val:19},{x:1, y:14, val:9},{x:1, y:15, val:4},{x:1, y:16, val:1},{x:1, y:17, val:0},{x:2, y:0, val:8},{x:2, y:1, val:29},{x:2, y:2, val:67},{x:2, y:3, val:108},{x:2, y:4, val:133},{x:2, y:5, val:131},{x:2, y:6, val:116},{x:2, y:7, val:105},{x:2, y:8, val:100},{x:2, y:9, val:96},{x:2, y:10, val:97},{x:2, y:11, val:105},{x:2, y:12, val:97},{x:2, y:13, val:73},{x:2, y:14, val:47},{x:2, y:15, val:26},{x:2, y:16, val:8},{x:2, y:17, val:5},{x:3, y:0, val:24},{x:3, y:1, val:56},{x:3, y:2, val:98},{x:3, y:3, val:142},{x:3, y:4, val:172},{x:3, y:5, val:177},{x:3, y:6, val:166},{x:3, y:7, val:145},{x:3, y:8, val:118},{x:3, y:9, val:108},{x:3, y:10, val:125},{x:3, y:11, val:148},{x:3, y:12, val:146},{x:3, y:13, val:119},{x:3, y:14, val:87},{x:3, y:15, val:57},{x:3, y:16, val:23},{x:3, y:17, val:16},{x:4, y:0, val:32},{x:4, y:1, val:70},{x:4, y:2, val:113},{x:4, y:3, val:152},{x:4, y:4, val:183},{x:4, y:5, val:201},{x:4, y:6, val:197},{x:4, y:7, val:170},{x:4, y:8, val:138},{x:4, y:9, val:125},{x:4, y:10, val:142},{x:4, y:11, val:165},{x:4, y:12, val:161},{x:4, y:13, val:131},{x:4, y:14, val:103},{x:4, y:15, val:75},{x:4, y:16, val:34},{x:4, y:17, val:26},{x:5, y:0, val:33},{x:5, y:1, val:70},{x:5, y:2, val:107},{x:5, y:3, val:138},{x:5, y:4, val:165},{x:5, y:5, val:197},{x:5, y:6, val:204},{x:5, y:7, val:178},{x:5, y:8, val:160},{x:5, y:9, val:158},{x:5, y:10, val:161},{x:5, y:11, val:167},{x:5, y:12, val:152},{x:5, y:13, val:124},{x:5, y:14, val:103},{x:5, y:15, val:79},{x:5, y:16, val:37},{x:5, y:17, val:29},{x:6, y:0, val:36},{x:6, y:1, val:72},{x:6, y:2, val:106},{x:6, y:3, val:130},{x:6, y:4, val:147},{x:6, y:5, val:184},{x:6, y:6, val:206},{x:6, y:7, val:194},{x:6, y:8, val:186},{x:6, y:9, val:187},{x:6, y:10, val:170},{x:6, y:11, val:152},{x:6, y:12, val:125},{x:6, y:13, val:106},{x:6, y:14, val:98},{x:6, y:15, val:84},{x:6, y:16, val:49},{x:6, y:17, val:41},{x:7, y:0, val:44},{x:7, y:1, val:93},{x:7, y:2, val:135},{x:7, y:3, val:159},{x:7, y:4, val:170},{x:7, y:5, val:192},{x:7, y:6, val:210},{x:7, y:7, val:204},{x:7, y:8, val:195},{x:7, y:9, val:191},{x:7, y:10, val:166},{x:7, y:11, val:129},{x:7, y:12, val:97},{x:7, y:13, val:91},{x:7, y:14, val:84},{x:7, y:15, val:70},{x:7, y:16, val:50},{x:7, y:17, val:46},{x:8, y:0, val:50},{x:8, y:1, val:110},{x:8, y:2, val:158},{x:8, y:3, val:191},{x:8, y:4, val:206},{x:8, y:5, val:209},{x:8, y:6, val:209},{x:8, y:7, val:197},{x:8, y:8, val:176},{x:8, y:9, val:162},{x:8, y:10, val:148},{x:8, y:11, val:110},{x:8, y:12, val:88},{x:8, y:13, val:99},{x:8, y:14, val:84},{x:8, y:15, val:52},{x:8, y:16, val:32},{x:8, y:17, val:29},{x:9, y:0, val:46},{x:9, y:1, val:93},{x:9, y:2, val:145},{x:9, y:3, val:184},{x:9, y:4, val:196},{x:9, y:5, val:178},{x:9, y:6, val:162},{x:9, y:7, val:156},{x:9, y:8, val:139},{x:9, y:9, val:112},{x:9, y:10, val:105},{x:9, y:11, val:86},{x:9, y:12, val:76},{x:9, y:13, val:86},{x:9, y:14, val:75},{x:9, y:15, val:48},{x:9, y:16, val:23},{x:9, y:17, val:19},{x:10, y:0, val:37},{x:10, y:1, val:76},{x:10, y:2, val:118},{x:10, y:3, val:153},{x:10, y:4, val:161},{x:10, y:5, val:134},{x:10, y:6, val:108},{x:10, y:7, val:108},{x:10, y:8, val:115},{x:10, y:9, val:114},{x:10, y:10, val:112},{x:10, y:11, val:101},{x:10, y:12, val:86},{x:10, y:13, val:79},{x:10, y:14, val:59},{x:10, y:15, val:31},{x:10, y:16, val:10},{x:10, y:17, val:7},{x:11, y:0, val:31},{x:11, y:1, val:73},{x:11, y:2, val:106},{x:11, y:3, val:130},{x:11, y:4, val:139},{x:11, y:5, val:115},{x:11, y:6, val:87},{x:11, y:7, val:89},{x:11, y:8, val:117},{x:11, y:9, val:148},{x:11, y:10, val:152},{x:11, y:11, val:138},{x:11, y:12, val:109},{x:11, y:13, val:79},{x:11, y:14, val:46},{x:11, y:15, val:21},{x:11, y:16, val:7},{x:11, y:17, val:5},{x:12, y:0, val:30},{x:12, y:1, val:79},{x:12, y:2, val:107},{x:12, y:3, val:119},{x:12, y:4, val:134},{x:12, y:5, val:127},{x:12, y:6, val:104},{x:12, y:7, val:104},{x:12, y:8, val:134},{x:12, y:9, val:170},{x:12, y:10, val:181},{x:12, y:11, val:167},{x:12, y:12, val:126},{x:12, y:13, val:76},{x:12, y:14, val:35},{x:12, y:15, val:21},{x:12, y:16, val:9},{x:12, y:17, val:7},{x:13, y:0, val:22},{x:13, y:1, val:64},{x:13, y:2, val:97},{x:13, y:3, val:109},{x:13, y:4, val:129},{x:13, y:5, val:142},{x:13, y:6, val:139},{x:13, y:7, val:139},{x:13, y:8, val:145},{x:13, y:9, val:153},{x:13, y:10, val:169},{x:13, y:11, val:156},{x:13, y:12, val:111},{x:13, y:13, val:58},{x:13, y:14, val:22},{x:13, y:15, val:11},{x:13, y:16, val:4},{x:13, y:17, val:2},{x:14, y:0, val:8},{x:14, y:1, val:33},{x:14, y:2, val:72},{x:14, y:3, val:92},{x:14, y:4, val:111},{x:14, y:5, val:131},{x:14, y:6, val:142},{x:14, y:7, val:146},{x:14, y:8, val:137},{x:14, y:9, val:128},{x:14, y:10, val:136},{x:14, y:11, val:117},{x:14, y:12, val:72},{x:14, y:13, val:32},{x:14, y:14, val:11},{x:14, y:15, val:3},{x:14, y:16, val:0},{x:14, y:17, val:0},{x:15, y:0, val:1},{x:15, y:1, val:10},{x:15, y:2, val:36},{x:15, y:3, val:60},{x:15, y:4, val:77},{x:15, y:5, val:94},{x:15, y:6, val:109},{x:15, y:7, val:112},{x:15, y:8, val:108},{x:15, y:9, val:101},{x:15, y:10, val:96},{x:15, y:11, val:71},{x:15, y:12, val:39},{x:15, y:13, val:18},{x:15, y:14, val:7},{x:15, y:15, val:2},{x:15, y:16, val:0},{x:15, y:17, val:0},{x:16, y:0, val:0},{x:16, y:1, val:2},{x:16, y:2, val:12},{x:16, y:3, val:30},{x:16, y:4, val:47},{x:16, y:5, val:61},{x:16, y:6, val:72},{x:16, y:7, val:73},{x:16, y:8, val:71},{x:16, y:9, val:65},{x:16, y:10, val:57},{x:16, y:11, val:36},{x:16, y:12, val:17},{x:16, y:13, val:7},{x:16, y:14, val:3},{x:16, y:15, val:1},{x:16, y:16, val:0},{x:16, y:17, val:0},{x:17, y:0, val:0},{x:17, y:1, val:1},{x:17, y:2, val:9},{x:17, y:3, val:25},{x:17, y:4, val:42},{x:17, y:5, val:56},{x:17, y:6, val:66},{x:17, y:7, val:66},{x:17, y:8, val:64},{x:17, y:9, val:58},{x:17, y:10, val:50},{x:17, y:11, val:30},{x:17, y:12, val:13},{x:17, y:13, val:5},{x:17, y:14, val:2},{x:17, y:15, val:0},{x:17, y:16, val:0},{x:17, y:17, val:0}

                
            ]
        },

        'pen-3' : {name:'pen-3', half:9, length:324, inter:3,
            data:[

{x:0, y:0, val:0},{x:0, y:1, val:0},{x:0, y:2, val:2},{x:0, y:3, val:8},{x:0, y:4, val:14},{x:0, y:5, val:21},{x:0, y:6, val:24},{x:0, y:7, val:21},{x:0, y:8, val:26},{x:0, y:9, val:37},{x:0, y:10, val:42},{x:0, y:11, val:43},{x:0, y:12, val:41},{x:0, y:13, val:31},{x:0, y:14, val:15},{x:0, y:15, val:3},{x:0, y:16, val:0},{x:0, y:17, val:0},{x:1, y:0, val:0},{x:1, y:1, val:3},{x:1, y:2, val:16},{x:1, y:3, val:33},{x:1, y:4, val:36},{x:1, y:5, val:44},{x:1, y:6, val:54},{x:1, y:7, val:54},{x:1, y:8, val:64},{x:1, y:9, val:70},{x:1, y:10, val:70},{x:1, y:11, val:73},{x:1, y:12, val:72},{x:1, y:13, val:62},{x:1, y:14, val:36},{x:1, y:15, val:15},{x:1, y:16, val:4},{x:1, y:17, val:3},{x:2, y:0, val:3},{x:2, y:1, val:17},{x:2, y:2, val:46},{x:2, y:3, val:62},{x:2, y:4, val:57},{x:2, y:5, val:70},{x:2, y:6, val:95},{x:2, y:7, val:99},{x:2, y:8, val:100},{x:2, y:9, val:101},{x:2, y:10, val:105},{x:2, y:11, val:106},{x:2, y:12, val:104},{x:2, y:13, val:94},{x:2, y:14, val:67},{x:2, y:15, val:42},{x:2, y:16, val:20},{x:2, y:17, val:16},{x:3, y:0, val:11},{x:3, y:1, val:36},{x:3, y:2, val:69},{x:3, y:3, val:86},{x:3, y:4, val:89},{x:3, y:5, val:110},{x:3, y:6, val:140},{x:3, y:7, val:143},{x:3, y:8, val:124},{x:3, y:9, val:124},{x:3, y:10, val:137},{x:3, y:11, val:138},{x:3, y:12, val:130},{x:3, y:13, val:111},{x:3, y:14, val:81},{x:3, y:15, val:63},{x:3, y:16, val:39},{x:3, y:17, val:33},{x:4, y:0, val:14},{x:4, y:1, val:41},{x:4, y:2, val:75},{x:4, y:3, val:104},{x:4, y:4, val:125},{x:4, y:5, val:146},{x:4, y:6, val:162},{x:4, y:7, val:159},{x:4, y:8, val:132},{x:4, y:9, val:130},{x:4, y:10, val:157},{x:4, y:11, val:160},{x:4, y:12, val:149},{x:4, y:13, val:122},{x:4, y:14, val:86},{x:4, y:15, val:72},{x:4, y:16, val:50},{x:4, y:17, val:45},{x:5, y:0, val:13},{x:5, y:1, val:41},{x:5, y:2, val:81},{x:5, y:3, val:119},{x:5, y:4, val:148},{x:5, y:5, val:167},{x:5, y:6, val:175},{x:5, y:7, val:170},{x:5, y:8, val:154},{x:5, y:9, val:155},{x:5, y:10, val:172},{x:5, y:11, val:169},{x:5, y:12, val:156},{x:5, y:13, val:133},{x:5, y:14, val:103},{x:5, y:15, val:86},{x:5, y:16, val:60},{x:5, y:17, val:55},{x:6, y:0, val:8},{x:6, y:1, val:38},{x:6, y:2, val:89},{x:6, y:3, val:136},{x:6, y:4, val:167},{x:6, y:5, val:184},{x:6, y:6, val:186},{x:6, y:7, val:179},{x:6, y:8, val:179},{x:6, y:9, val:188},{x:6, y:10, val:184},{x:6, y:11, val:164},{x:6, y:12, val:145},{x:6, y:13, val:135},{x:6, y:14, val:123},{x:6, y:15, val:106},{x:6, y:16, val:73},{x:6, y:17, val:66},{x:7, y:0, val:4},{x:7, y:1, val:32},{x:7, y:2, val:83},{x:7, y:3, val:133},{x:7, y:4, val:169},{x:7, y:5, val:188},{x:7, y:6, val:179},{x:7, y:7, val:157},{x:7, y:8, val:159},{x:7, y:9, val:172},{x:7, y:10, val:168},{x:7, y:11, val:152},{x:7, y:12, val:134},{x:7, y:13, val:127},{x:7, y:14, val:119},{x:7, y:15, val:109},{x:7, y:16, val:75},{x:7, y:17, val:67},{x:8, y:0, val:2},{x:8, y:1, val:22},{x:8, y:2, val:61},{x:8, y:3, val:106},{x:8, y:4, val:152},{x:8, y:5, val:176},{x:8, y:6, val:150},{x:8, y:7, val:111},{x:8, y:8, val:107},{x:8, y:9, val:121},{x:8, y:10, val:129},{x:8, y:11, val:131},{x:8, y:12, val:128},{x:8, y:13, val:113},{x:8, y:14, val:91},{x:8, y:15, val:75},{x:8, y:16, val:49},{x:8, y:17, val:44},{x:9, y:0, val:2},{x:9, y:1, val:19},{x:9, y:2, val:55},{x:9, y:3, val:97},{x:9, y:4, val:132},{x:9, y:5, val:146},{x:9, y:6, val:115},{x:9, y:7, val:74},{x:9, y:8, val:62},{x:9, y:9, val:71},{x:9, y:10, val:86},{x:9, y:11, val:100},{x:9, y:12, val:102},{x:9, y:13, val:87},{x:9, y:14, val:63},{x:9, y:15, val:38},{x:9, y:16, val:21},{x:9, y:17, val:18},{x:10, y:0, val:3},{x:10, y:1, val:23},{x:10, y:2, val:69},{x:10, y:3, val:112},{x:10, y:4, val:136},{x:10, y:5, val:142},{x:10, y:6, val:118},{x:10, y:7, val:80},{x:10, y:8, val:57},{x:10, y:9, val:61},{x:10, y:10, val:75},{x:10, y:11, val:88},{x:10, y:12, val:85},{x:10, y:13, val:70},{x:10, y:14, val:46},{x:10, y:15, val:22},{x:10, y:16, val:10},{x:10, y:17, val:8},{x:11, y:0, val:7},{x:11, y:1, val:31},{x:11, y:2, val:77},{x:11, y:3, val:123},{x:11, y:4, val:144},{x:11, y:5, val:144},{x:11, y:6, val:130},{x:11, y:7, val:98},{x:11, y:8, val:68},{x:11, y:9, val:64},{x:11, y:10, val:75},{x:11, y:11, val:87},{x:11, y:12, val:77},{x:11, y:13, val:53},{x:11, y:14, val:32},{x:11, y:15, val:17},{x:11, y:16, val:6},{x:11, y:17, val:4},{x:12, y:0, val:14},{x:12, y:1, val:37},{x:12, y:2, val:75},{x:12, y:3, val:116},{x:12, y:4, val:133},{x:12, y:5, val:133},{x:12, y:6, val:124},{x:12, y:7, val:101},{x:12, y:8, val:77},{x:12, y:9, val:68},{x:12, y:10, val:75},{x:12, y:11, val:84},{x:12, y:12, val:74},{x:12, y:13, val:45},{x:12, y:14, val:25},{x:12, y:15, val:16},{x:12, y:16, val:5},{x:12, y:17, val:3},{x:13, y:0, val:21},{x:13, y:1, val:39},{x:13, y:2, val:65},{x:13, y:3, val:92},{x:13, y:4, val:105},{x:13, y:5, val:106},{x:13, y:6, val:99},{x:13, y:7, val:93},{x:13, y:8, val:87},{x:13, y:9, val:75},{x:13, y:10, val:74},{x:13, y:11, val:76},{x:13, y:12, val:70},{x:13, y:13, val:55},{x:13, y:14, val:31},{x:13, y:15, val:11},{x:13, y:16, val:2},{x:13, y:17, val:1},{x:14, y:0, val:17},{x:14, y:1, val:32},{x:14, y:2, val:48},{x:14, y:3, val:62},{x:14, y:4, val:69},{x:14, y:5, val:69},{x:14, y:6, val:67},{x:14, y:7, val:77},{x:14, y:8, val:92},{x:14, y:9, val:82},{x:14, y:10, val:79},{x:14, y:11, val:82},{x:14, y:12, val:74},{x:14, y:13, val:60},{x:14, y:14, val:35},{x:14, y:15, val:9},{x:14, y:16, val:1},{x:14, y:17, val:0},{x:15, y:0, val:6},{x:15, y:1, val:17},{x:15, y:2, val:29},{x:15, y:3, val:37},{x:15, y:4, val:40},{x:15, y:5, val:38},{x:15, y:6, val:37},{x:15, y:7, val:48},{x:15, y:8, val:63},{x:15, y:9, val:65},{x:15, y:10, val:79},{x:15, y:11, val:90},{x:15, y:12, val:73},{x:15, y:13, val:48},{x:15, y:14, val:25},{x:15, y:15, val:7},{x:15, y:16, val:1},{x:15, y:17, val:0},{x:16, y:0, val:1},{x:16, y:1, val:4},{x:16, y:2, val:12},{x:16, y:3, val:19},{x:16, y:4, val:21},{x:16, y:5, val:19},{x:16, y:6, val:15},{x:16, y:7, val:22},{x:16, y:8, val:31},{x:16, y:9, val:43},{x:16, y:10, val:63},{x:16, y:11, val:74},{x:16, y:12, val:57},{x:16, y:13, val:33},{x:16, y:14, val:15},{x:16, y:15, val:5},{x:16, y:16, val:0},{x:16, y:17, val:0},{x:17, y:0, val:0},{x:17, y:1, val:2},{x:17, y:2, val:8},{x:17, y:3, val:16},{x:17, y:4, val:19},{x:17, y:5, val:16},{x:17, y:6, val:12},{x:17, y:7, val:18},{x:17, y:8, val:26},{x:17, y:9, val:40},{x:17, y:10, val:59},{x:17, y:11, val:69},{x:17, y:12, val:54},{x:17, y:13, val:30},{x:17, y:14, val:14},{x:17, y:15, val:4},{x:17, y:16, val:0},{x:17, y:17, val:0}
                
            ]
        },
        'pen-4' : {name:'pen-4', half:9, length:324, inter:3,
            data:[

{x:0, y:0, val:0},{x:0, y:1, val:0},{x:0, y:2, val:2},{x:0, y:3, val:8},{x:0, y:4, val:12},{x:0, y:5, val:15},{x:0, y:6, val:15},{x:0, y:7, val:12},{x:0, y:8, val:21},{x:0, y:9, val:37},{x:0, y:10, val:38},{x:0, y:11, val:36},{x:0, y:12, val:29},{x:0, y:13, val:19},{x:0, y:14, val:8},{x:0, y:15, val:2},{x:0, y:16, val:0},{x:0, y:17, val:0},{x:1, y:0, val:0},{x:1, y:1, val:2},{x:1, y:2, val:12},{x:1, y:3, val:30},{x:1, y:4, val:34},{x:1, y:5, val:28},{x:1, y:6, val:23},{x:1, y:7, val:25},{x:1, y:8, val:46},{x:1, y:9, val:65},{x:1, y:10, val:66},{x:1, y:11, val:65},{x:1, y:12, val:57},{x:1, y:13, val:44},{x:1, y:14, val:23},{x:1, y:15, val:8},{x:1, y:16, val:2},{x:1, y:17, val:1},{x:2, y:0, val:2},{x:2, y:1, val:11},{x:2, y:2, val:29},{x:2, y:3, val:48},{x:2, y:4, val:53},{x:2, y:5, val:44},{x:2, y:6, val:39},{x:2, y:7, val:47},{x:2, y:8, val:71},{x:2, y:9, val:92},{x:2, y:10, val:101},{x:2, y:11, val:104},{x:2, y:12, val:99},{x:2, y:13, val:87},{x:2, y:14, val:58},{x:2, y:15, val:31},{x:2, y:16, val:14},{x:2, y:17, val:12},{x:3, y:0, val:8},{x:3, y:1, val:26},{x:3, y:2, val:42},{x:3, y:3, val:56},{x:3, y:4, val:69},{x:3, y:5, val:70},{x:3, y:6, val:71},{x:3, y:7, val:84},{x:3, y:8, val:99},{x:3, y:9, val:106},{x:3, y:10, val:118},{x:3, y:11, val:131},{x:3, y:12, val:139},{x:3, y:13, val:134},{x:3, y:14, val:98},{x:3, y:15, val:62},{x:3, y:16, val:34},{x:3, y:17, val:29},{x:4, y:0, val:15},{x:4, y:1, val:42},{x:4, y:2, val:60},{x:4, y:3, val:69},{x:4, y:4, val:86},{x:4, y:5, val:99},{x:4, y:6, val:100},{x:4, y:7, val:105},{x:4, y:8, val:111},{x:4, y:9, val:99},{x:4, y:10, val:97},{x:4, y:11, val:116},{x:4, y:12, val:150},{x:4, y:13, val:158},{x:4, y:14, val:126},{x:4, y:15, val:90},{x:4, y:16, val:55},{x:4, y:17, val:48},{x:5, y:0, val:16},{x:5, y:1, val:54},{x:5, y:2, val:83},{x:5, y:3, val:96},{x:5, y:4, val:116},{x:5, y:5, val:131},{x:5, y:6, val:121},{x:5, y:7, val:104},{x:5, y:8, val:102},{x:5, y:9, val:91},{x:5, y:10, val:77},{x:5, y:11, val:97},{x:5, y:12, val:145},{x:5, y:13, val:168},{x:5, y:14, val:151},{x:5, y:15, val:123},{x:5, y:16, val:80},{x:5, y:17, val:71},{x:6, y:0, val:14},{x:6, y:1, val:52},{x:6, y:2, val:90},{x:6, y:3, val:122},{x:6, y:4, val:157},{x:6, y:5, val:168},{x:6, y:6, val:145},{x:6, y:7, val:116},{x:6, y:8, val:110},{x:6, y:9, val:103},{x:6, y:10, val:87},{x:6, y:11, val:108},{x:6, y:12, val:152},{x:6, y:13, val:173},{x:6, y:14, val:172},{x:6, y:15, val:160},{x:6, y:16, val:109},{x:6, y:17, val:98},{x:7, y:0, val:29},{x:7, y:1, val:63},{x:7, y:2, val:89},{x:7, y:3, val:121},{x:7, y:4, val:169},{x:7, y:5, val:182},{x:7, y:6, val:160},{x:7, y:7, val:143},{x:7, y:8, val:142},{x:7, y:9, val:137},{x:7, y:10, val:118},{x:7, y:11, val:128},{x:7, y:12, val:148},{x:7, y:13, val:143},{x:7, y:14, val:149},{x:7, y:15, val:158},{x:7, y:16, val:111},{x:7, y:17, val:99},{x:8, y:0, val:61},{x:8, y:1, val:96},{x:8, y:2, val:101},{x:8, y:3, val:106},{x:8, y:4, val:154},{x:8, y:5, val:186},{x:8, y:6, val:178},{x:8, y:7, val:166},{x:8, y:8, val:165},{x:8, y:9, val:154},{x:8, y:10, val:120},{x:8, y:11, val:109},{x:8, y:12, val:112},{x:8, y:13, val:92},{x:8, y:14, val:93},{x:8, y:15, val:100},{x:8, y:16, val:67},{x:8, y:17, val:58},{x:9, y:0, val:76},{x:9, y:1, val:112},{x:9, y:2, val:116},{x:9, y:3, val:117},{x:9, y:4, val:143},{x:9, y:5, val:173},{x:9, y:6, val:168},{x:9, y:7, val:141},{x:9, y:8, val:120},{x:9, y:9, val:95},{x:9, y:10, val:70},{x:9, y:11, val:69},{x:9, y:12, val:83},{x:9, y:13, val:85},{x:9, y:14, val:77},{x:9, y:15, val:54},{x:9, y:16, val:25},{x:9, y:17, val:20},{x:10, y:0, val:48},{x:10, y:1, val:84},{x:10, y:2, val:116},{x:10, y:3, val:138},{x:10, y:4, val:149},{x:10, y:5, val:151},{x:10, y:6, val:134},{x:10, y:7, val:100},{x:10, y:8, val:70},{x:10, y:9, val:61},{x:10, y:10, val:65},{x:10, y:11, val:76},{x:10, y:12, val:87},{x:10, y:13, val:99},{x:10, y:14, val:99},{x:10, y:15, val:64},{x:10, y:16, val:23},{x:10, y:17, val:16},{x:11, y:0, val:18},{x:11, y:1, val:53},{x:11, y:2, val:102},{x:11, y:3, val:145},{x:11, y:4, val:159},{x:11, y:5, val:141},{x:11, y:6, val:112},{x:11, y:7, val:77},{x:11, y:8, val:50},{x:11, y:9, val:62},{x:11, y:10, val:98},{x:11, y:11, val:120},{x:11, y:12, val:108},{x:11, y:13, val:96},{x:11, y:14, val:96},{x:11, y:15, val:66},{x:11, y:16, val:22},{x:11, y:17, val:14},{x:12, y:0, val:16},{x:12, y:1, val:44},{x:12, y:2, val:84},{x:12, y:3, val:124},{x:12, y:4, val:140},{x:12, y:5, val:119},{x:12, y:6, val:86},{x:12, y:7, val:58},{x:12, y:8, val:42},{x:12, y:9, val:66},{x:12, y:10, val:118},{x:12, y:11, val:149},{x:12, y:12, val:121},{x:12, y:13, val:79},{x:12, y:14, val:70},{x:12, y:15, val:57},{x:12, y:16, val:25},{x:12, y:17, val:19},{x:13, y:0, val:23},{x:13, y:1, val:45},{x:13, y:2, val:66},{x:13, y:3, val:83},{x:13, y:4, val:88},{x:13, y:5, val:76},{x:13, y:6, val:55},{x:13, y:7, val:40},{x:13, y:8, val:36},{x:13, y:9, val:54},{x:13, y:10, val:97},{x:13, y:11, val:125},{x:13, y:12, val:104},{x:13, y:13, val:81},{x:13, y:14, val:76},{x:13, y:15, val:63},{x:13, y:16, val:34},{x:13, y:17, val:29},{x:14, y:0, val:21},{x:14, y:1, val:40},{x:14, y:2, val:52},{x:14, y:3, val:52},{x:14, y:4, val:47},{x:14, y:5, val:41},{x:14, y:6, val:34},{x:14, y:7, val:31},{x:14, y:8, val:35},{x:14, y:9, val:45},{x:14, y:10, val:67},{x:14, y:11, val:88},{x:14, y:12, val:95},{x:14, y:13, val:105},{x:14, y:14, val:100},{x:14, y:15, val:72},{x:14, y:16, val:35},{x:14, y:17, val:28},{x:15, y:0, val:8},{x:15, y:1, val:26},{x:15, y:2, val:40},{x:15, y:3, val:40},{x:15, y:4, val:32},{x:15, y:5, val:25},{x:15, y:6, val:26},{x:15, y:7, val:38},{x:15, y:8, val:41},{x:15, y:9, val:40},{x:15, y:10, val:60},{x:15, y:11, val:82},{x:15, y:12, val:98},{x:15, y:13, val:111},{x:15, y:14, val:100},{x:15, y:15, val:62},{x:15, y:16, val:23},{x:15, y:17, val:16},{x:16, y:0, val:1},{x:16, y:1, val:7},{x:16, y:2, val:20},{x:16, y:3, val:30},{x:16, y:4, val:27},{x:16, y:5, val:19},{x:16, y:6, val:21},{x:16, y:7, val:47},{x:16, y:8, val:48},{x:16, y:9, val:35},{x:16, y:10, val:59},{x:16, y:11, val:84},{x:16, y:12, val:90},{x:16, y:13, val:93},{x:16, y:14, val:77},{x:16, y:15, val:41},{x:16, y:16, val:10},{x:16, y:17, val:6},{x:17, y:0, val:0},{x:17, y:1, val:4},{x:17, y:2, val:17},{x:17, y:3, val:28},{x:17, y:4, val:26},{x:17, y:5, val:18},{x:17, y:6, val:21},{x:17, y:7, val:48},{x:17, y:8, val:49},{x:17, y:9, val:34},{x:17, y:10, val:59},{x:17, y:11, val:84},{x:17, y:12, val:88},{x:17, y:13, val:89},{x:17, y:14, val:72},{x:17, y:15, val:37},{x:17, y:16, val:8},{x:17, y:17, val:4}


            ]
        },

        'pen-5' : {name:'pen-5', half:9, length:324, inter:3,
            data:[

{x:0, y:0, val:0},{x:0, y:1, val:0},{x:0, y:2, val:2},{x:0, y:3, val:7},{x:0, y:4, val:15},{x:0, y:5, val:29},{x:0, y:6, val:30},{x:0, y:7, val:23},{x:0, y:8, val:28},{x:0, y:9, val:38},{x:0, y:10, val:46},{x:0, y:11, val:46},{x:0, y:12, val:38},{x:0, y:13, val:25},{x:0, y:14, val:10},{x:0, y:15, val:2},{x:0, y:16, val:0},{x:0, y:17, val:0},{x:1, y:0, val:0},{x:1, y:1, val:2},{x:1, y:2, val:14},{x:1, y:3, val:33},{x:1, y:4, val:58},{x:1, y:5, val:88},{x:1, y:6, val:80},{x:1, y:7, val:67},{x:1, y:8, val:77},{x:1, y:9, val:72},{x:1, y:10, val:81},{x:1, y:11, val:88},{x:1, y:12, val:75},{x:1, y:13, val:53},{x:1, y:14, val:25},{x:1, y:15, val:10},{x:1, y:16, val:2},{x:1, y:17, val:1},{x:2, y:0, val:2},{x:2, y:1, val:14},{x:2, y:2, val:44},{x:2, y:3, val:76},{x:2, y:4, val:113},{x:2, y:5, val:147},{x:2, y:6, val:131},{x:2, y:7, val:118},{x:2, y:8, val:130},{x:2, y:9, val:106},{x:2, y:10, val:118},{x:2, y:11, val:128},{x:2, y:12, val:112},{x:2, y:13, val:87},{x:2, y:14, val:55},{x:2, y:15, val:34},{x:2, y:16, val:15},{x:2, y:17, val:12},{x:3, y:0, val:9},{x:3, y:1, val:35},{x:3, y:2, val:72},{x:3, y:3, val:112},{x:3, y:4, val:150},{x:3, y:5, val:171},{x:3, y:6, val:161},{x:3, y:7, val:158},{x:3, y:8, val:164},{x:3, y:9, val:145},{x:3, y:10, val:158},{x:3, y:11, val:159},{x:3, y:12, val:137},{x:3, y:13, val:109},{x:3, y:14, val:83},{x:3, y:15, val:61},{x:3, y:16, val:31},{x:3, y:17, val:26},{x:4, y:0, val:17},{x:4, y:1, val:53},{x:4, y:2, val:85},{x:4, y:3, val:116},{x:4, y:4, val:147},{x:4, y:5, val:159},{x:4, y:6, val:157},{x:4, y:7, val:161},{x:4, y:8, val:164},{x:4, y:9, val:152},{x:4, y:10, val:160},{x:4, y:11, val:161},{x:4, y:12, val:143},{x:4, y:13, val:114},{x:4, y:14, val:92},{x:4, y:15, val:72},{x:4, y:16, val:41},{x:4, y:17, val:36},{x:5, y:0, val:15},{x:5, y:1, val:50},{x:5, y:2, val:77},{x:5, y:3, val:96},{x:5, y:4, val:112},{x:5, y:5, val:121},{x:5, y:6, val:123},{x:5, y:7, val:125},{x:5, y:8, val:125},{x:5, y:9, val:108},{x:5, y:10, val:111},{x:5, y:11, val:122},{x:5, y:12, val:114},{x:5, y:13, val:92},{x:5, y:14, val:78},{x:5, y:15, val:68},{x:5, y:16, val:47},{x:5, y:17, val:43},{x:6, y:0, val:7},{x:6, y:1, val:33},{x:6, y:2, val:67},{x:6, y:3, val:93},{x:6, y:4, val:102},{x:6, y:5, val:109},{x:6, y:6, val:108},{x:6, y:7, val:98},{x:6, y:8, val:87},{x:6, y:9, val:66},{x:6, y:10, val:64},{x:6, y:11, val:80},{x:6, y:12, val:78},{x:6, y:13, val:65},{x:6, y:14, val:59},{x:6, y:15, val:62},{x:6, y:16, val:53},{x:6, y:17, val:51},{x:7, y:0, val:4},{x:7, y:1, val:29},{x:7, y:2, val:72},{x:7, y:3, val:110},{x:7, y:4, val:131},{x:7, y:5, val:143},{x:7, y:6, val:131},{x:7, y:7, val:100},{x:7, y:8, val:82},{x:7, y:9, val:63},{x:7, y:10, val:60},{x:7, y:11, val:78},{x:7, y:12, val:78},{x:7, y:13, val:65},{x:7, y:14, val:51},{x:7, y:15, val:55},{x:7, y:16, val:52},{x:7, y:17, val:51},{x:8, y:0, val:7},{x:8, y:1, val:40},{x:8, y:2, val:84},{x:8, y:3, val:120},{x:8, y:4, val:150},{x:8, y:5, val:159},{x:8, y:6, val:134},{x:8, y:7, val:100},{x:8, y:8, val:94},{x:8, y:9, val:87},{x:8, y:10, val:84},{x:8, y:11, val:98},{x:8, y:12, val:105},{x:8, y:13, val:88},{x:8, y:14, val:61},{x:8, y:15, val:50},{x:8, y:16, val:38},{x:8, y:17, val:36},{x:9, y:0, val:11},{x:9, y:1, val:52},{x:9, y:2, val:99},{x:9, y:3, val:125},{x:9, y:4, val:132},{x:9, y:5, val:119},{x:9, y:6, val:93},{x:9, y:7, val:87},{x:9, y:8, val:100},{x:9, y:9, val:102},{x:9, y:10, val:92},{x:9, y:11, val:94},{x:9, y:12, val:102},{x:9, y:13, val:106},{x:9, y:14, val:90},{x:9, y:15, val:64},{x:9, y:16, val:33},{x:9, y:17, val:27},{x:10, y:0, val:7},{x:10, y:1, val:41},{x:10, y:2, val:89},{x:10, y:3, val:117},{x:10, y:4, val:108},{x:10, y:5, val:78},{x:10, y:6, val:61},{x:10, y:7, val:76},{x:10, y:8, val:93},{x:10, y:9, val:88},{x:10, y:10, val:80},{x:10, y:11, val:88},{x:10, y:12, val:92},{x:10, y:13, val:107},{x:10, y:14, val:112},{x:10, y:15, val:80},{x:10, y:16, val:33},{x:10, y:17, val:24},{x:11, y:0, val:6},{x:11, y:1, val:30},{x:11, y:2, val:67},{x:11, y:3, val:92},{x:11, y:4, val:79},{x:11, y:5, val:43},{x:11, y:6, val:35},{x:11, y:7, val:61},{x:11, y:8, val:72},{x:11, y:9, val:54},{x:11, y:10, val:55},{x:11, y:11, val:67},{x:11, y:12, val:67},{x:11, y:13, val:77},{x:11, y:14, val:90},{x:11, y:15, val:70},{x:11, y:16, val:26},{x:11, y:17, val:17},{x:12, y:0, val:13},{x:12, y:1, val:31},{x:12, y:2, val:55},{x:12, y:3, val:75},{x:12, y:4, val:63},{x:12, y:5, val:34},{x:12, y:6, val:26},{x:12, y:7, val:41},{x:12, y:8, val:46},{x:12, y:9, val:40},{x:12, y:10, val:49},{x:12, y:11, val:53},{x:12, y:12, val:46},{x:12, y:13, val:49},{x:12, y:14, val:62},{x:12, y:15, val:57},{x:12, y:16, val:26},{x:12, y:17, val:19},{x:13, y:0, val:22},{x:13, y:1, val:43},{x:13, y:2, val:69},{x:13, y:3, val:85},{x:13, y:4, val:74},{x:13, y:5, val:53},{x:13, y:6, val:45},{x:13, y:7, val:53},{x:13, y:8, val:59},{x:13, y:9, val:73},{x:13, y:10, val:92},{x:13, y:11, val:82},{x:13, y:12, val:66},{x:13, y:13, val:69},{x:13, y:14, val:74},{x:13, y:15, val:60},{x:13, y:16, val:30},{x:13, y:17, val:25},{x:14, y:0, val:21},{x:14, y:1, val:53},{x:14, y:2, val:92},{x:14, y:3, val:107},{x:14, y:4, val:94},{x:14, y:5, val:78},{x:14, y:6, val:76},{x:14, y:7, val:87},{x:14, y:8, val:95},{x:14, y:9, val:101},{x:14, y:10, val:116},{x:14, y:11, val:112},{x:14, y:12, val:106},{x:14, y:13, val:108},{x:14, y:14, val:94},{x:14, y:15, val:62},{x:14, y:16, val:27},{x:14, y:17, val:21},{x:15, y:0, val:10},{x:15, y:1, val:43},{x:15, y:2, val:91},{x:15, y:3, val:111},{x:15, y:4, val:98},{x:15, y:5, val:80},{x:15, y:6, val:84},{x:15, y:7, val:95},{x:15, y:8, val:96},{x:15, y:9, val:97},{x:15, y:10, val:105},{x:15, y:11, val:116},{x:15, y:12, val:125},{x:15, y:13, val:116},{x:15, y:14, val:86},{x:15, y:15, val:49},{x:15, y:16, val:17},{x:15, y:17, val:11},{x:16, y:0, val:2},{x:16, y:1, val:19},{x:16, y:2, val:56},{x:16, y:3, val:80},{x:16, y:4, val:71},{x:16, y:5, val:58},{x:16, y:6, val:67},{x:16, y:7, val:76},{x:16, y:8, val:72},{x:16, y:9, val:74},{x:16, y:10, val:82},{x:16, y:11, val:96},{x:16, y:12, val:105},{x:16, y:13, val:90},{x:16, y:14, val:55},{x:16, y:15, val:24},{x:16, y:16, val:5},{x:16, y:17, val:2},{x:17, y:0, val:1},{x:17, y:1, val:14},{x:17, y:2, val:49},{x:17, y:3, val:73},{x:17, y:4, val:65},{x:17, y:5, val:53},{x:17, y:6, val:64},{x:17, y:7, val:72},{x:17, y:8, val:67},{x:17, y:9, val:70},{x:17, y:10, val:77},{x:17, y:11, val:92},{x:17, y:12, val:100},{x:17, y:13, val:83},{x:17, y:14, val:48},{x:17, y:15, val:19},{x:17, y:16, val:3},{x:17, y:17, val:1}

                
            ]
        },
   };

    // メイン関数実行
    main();
});