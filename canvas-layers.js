/**
 * canvas-layers - v1.0.11
 * Allow user to position and re-arrange images on a canvas.
 * @author Pamblam
 * @website 
 * @license MIT
 */

class Canvas{
	
	constructor(canvas, opts={}){
		this.canvas = canvas;
		this.width = canvas.width;
		this.height = canvas.height;
		this.ctx = canvas.getContext('2d');
		this.layers = [];
		this.activeLayer = null;
		this.draggingActiveLayer = false;
		this.resizingActiveLayer = false;
		this.rotatingActiveLayer = false;
		this.lastMouseDownOffset = {x:0, y:0};
		this.activeLayerMouseOffset = {x:0, y:0};
		this.activeLayerOriginalDimensions = {width:0, height:0};
		this.activeLayerRotateStartPos = {x:0, y:0};
		canvas.addEventListener('mousemove', this.onmousemove.bind(this));
		canvas.addEventListener('mousedown', this.onmousedown.bind(this));
		canvas.addEventListener('mouseout', this.onmousereset.bind(this));
		canvas.addEventListener('mouseup', this.onmousereset.bind(this));
		
		this.anchorRadius = opts.anchorRadius || Canvas.anchorRadius;
		this.strokeStyle = opts.strokeStyle || Canvas.strokeStyle;
		this.fillStyle = opts.fillStyle || Canvas.fillStyle;
		this.lineWidth = opts.lineWidth || Canvas.lineWidth;
		this.cursors = opts.cursors || {};
		this.cursors.default = this.cursors.default || Canvas.cursors.default;
		this.cursors.grab = this.cursors.grab || Canvas.cursors.grab;
		this.cursors.grabbing = this.cursors.grabbing || Canvas.cursors.grabbing;
		this.cursors.move = this.cursors.move || Canvas.cursors.move;
		this.cursors.rotate = this.cursors.rotate || Canvas.cursors.rotate;
		this.cursors.rotating = this.cursors.rotating || Canvas.cursors.rotating;
		
		this.last_draw_time = 0;
	}	
	
	getLayerByName(name){
		for(var i=this.layers.length; i--;){
			if(this.layers[i].name === name) return this.layers[i];
		}
		return null;
	}
	
	addLayer(url, opts={}){
		const name = opts.name || `Layer ${this.layers.length}`;
		const x = parseFloat(opts.x || this.width/2);
		const y = parseFloat(opts.y || this.height/2);
		const rotation = parseFloat(opts.rotation || 0);
		const draggable = opts.draggable === undefined ? true : opts.draggable;
		const rotateable = !!opts.rotateable === undefined ? true : opts.rotateable;
		const resizable = !!opts.resizable === undefined ? true : opts.resizable;
		const selectable = !!opts.selectable === undefined ? true : opts.selectable;
		const width = opts.width || null;
		const height = opts.height || null;
		var layer = new CanvasLayer(url, name, x, y, width, height, rotation, draggable, rotateable, resizable, selectable);
		this.layers.unshift(layer);
		this.draw();
		return layer;
	}
	
	cropToLayer(layer){
		return this.extractPortion(layer.x, layer.y, layer.width, layer.height, layer.rotation);
	}
	
	extractPortion(centerx, centery, width, height, rotation=0){
		var radians = rotation * Math.PI / 180;
		var {x, y} = this.absolutePoint(-(width/2), -(height/2), centerx, centery, rotation);
		
		var rectBB = this.getRotatedRectBB(x, y, width, height, radians);
		
		var canvas0 = document.createElement("canvas");
		var ctx0 = canvas0.getContext("2d");
		var canvas1 = document.createElement("canvas");
		var ctx1 = canvas1.getContext("2d");
		var canvas2 = document.createElement("canvas");
		var ctx2 = canvas2.getContext("2d");
		
		canvas1.width = canvas2.width = rectBB.width;
		canvas1.height = canvas2.height = rectBB.height;
		canvas0.width = this.width;
		canvas0.height = this.height;
		
		return new Promise(done=>{
			this.loadAll().then(()=>{
				for(let i=this.layers.length; i--;){
					let layer = this.layers[i];
					var radians = layer.rotation * (Math.PI/180);
					ctx0.translate(layer.x, layer.y);
					ctx0.rotate(radians);
					ctx0.drawImage(layer.image, -(layer.width/2), -(layer.height/2), layer.width, layer.height);
					ctx0.rotate(-radians);
					ctx0.translate(-layer.x, -layer.y);
				}

				ctx1.drawImage(canvas0, rectBB.cx - rectBB.width / 2, rectBB.cy - rectBB.height / 2, rectBB.width, rectBB.height, 0, 0, rectBB.width, rectBB.height);
				ctx2.translate(canvas1.width / 2, canvas1.height / 2);
				ctx2.rotate(-radians);
				ctx2.drawImage(canvas1, -canvas1.width / 2, -canvas1.height / 2);
				var ofstx = (canvas2.width - width) / 2;
				var ofsty = (canvas2.height - height) / 2;
				ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
				canvas1.width = width;
				canvas1.height = height;
				ctx1.drawImage(canvas2, -ofstx, -ofsty);
				done(canvas1.toDataURL());

			});
		});
	}
	
	draw(){
		var current_draw_time = new Date().getTime();
		this.last_draw_time = current_draw_time;
		
		this.loadAll().then(()=>{
			if(this.last_draw_time !== current_draw_time){
				return;
			}
			
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			for(let i=this.layers.length; i--;){
				let layer = this.layers[i];
				var radians = layer.rotation * (Math.PI/180);
				this.ctx.translate(layer.x, layer.y);
				this.ctx.rotate(radians);
				this.ctx.drawImage(layer.image, -(layer.width/2), -(layer.height/2), layer.width, layer.height);
				
				if(layer === this.activeLayer){
					this.ctx.strokeStyle = this.strokeStyle;
					this.ctx.fillStyle = this.fillStyle;
					this.ctx.lineWidth = this.getScale() * this.lineWidth;
					this.ctx.strokeRect(-(layer.width/2), -(layer.height/2), layer.width, layer.height);
					if(layer.resizable){
						layer.getCorners().forEach(corner=>{
							this.drawCircle(corner.x, corner.y, this.getScale() * this.anchorRadius);
						});
					}
					if(layer.rotateable){
						this.ctx.beginPath();
						this.ctx.moveTo(0, 0);
						this.ctx.lineTo((layer.width/2)+25, 0);
						this.ctx.stroke();
						this.drawCircle((layer.width/2)+25, 0, this.getScale() * this.anchorRadius);
					}
				}
				this.ctx.rotate(-radians);
				this.ctx.translate(-layer.x, -layer.y);
			}
		});
	}
	
	removeAllLayers(){
		this.deSelectLayer();
		this.layers = [];
		this.draw();
	}
	
	removeLayer(layer){
		if(layer === this.activeLayer) this.deSelectLayer();
		this.layers.splice(this.layers.indexOf(layer), 1);
		this.draw();
	}
	
	selectLayer(layer){
		this.layers.unshift(this.layers.splice(this.layers.indexOf(layer), 1)[0]);
		this.activeLayer = layer;
		this.draw();
	}
	
	deSelectLayer(){
		this.activeLayer = null;
		this.draggingActiveLayer = false;
		this.draw();
	}
	
	////////////////////////////////////////////////////////////////////////////
	// Undocumented utility functions //////////////////////////////////////////
	////////////////////////////////////////////////////////////////////////////
	
	loadAll(){
		var promises = this.layers.map(layer=>layer.load());
		return Promise.all(promises);
	}
	
	getRotatedRectBB(x, y, width, height, rAngle) {
		var absCos = Math.abs(Math.cos(rAngle));
		var absSin = Math.abs(Math.sin(rAngle));
		var cx = x + width / 2 * Math.cos(rAngle) - height / 2 * Math.sin(rAngle);
		var cy = y + width / 2 * Math.sin(rAngle) + height / 2 * Math.cos(rAngle);
		var w = width * absCos + height * absSin;
		var h = width * absSin + height * absCos;
		return ({
			cx: cx,
			cy: cy,
			width: w,
			height: h
		});
	}
	
	drawCircle(x, y, radius){
		this.ctx.beginPath();
		this.ctx.arc(x, y, radius, 0, Math.PI*2, true); 
		this.ctx.closePath();
		this.ctx.fill();
	}
	
	onmousemove(e){
		var {x, y} = this.canvasMousePos(e);
		this.setCursor(x, y);
		if(this.activeLayer === null) return;
		
		if(this.rotatingActiveLayer){
			if(this.fireEvent('layer-rotate')){
				var dx = x - this.activeLayer.x;
				var dy = y - this.activeLayer.y;
				var angle = Math.atan2(dy, dx);
				var degrees = angle * 180 / Math.PI;
				this.activeLayer.rotation = degrees;
				this.draw();
			}
		}else if(this.draggingActiveLayer){
			if(this.fireEvent('layer-drag')){
				this.activeLayer.x = this.activeLayerMouseOffset.x + x;
				this.activeLayer.y = this.activeLayerMouseOffset.y + y;
				this.draw();
			}
		}else if(this.resizingActiveLayer){
			if(this.fireEvent('layer-resize')){
				this.doUserLayerResize(x, y);
				this.draw();
			}
		}
	}
	
	setCursor(x, y){
		if(this.rotatingActiveLayer){
			document.body.style.cursor = this.cursors.rotating;
		}else if(this.draggingActiveLayer){
			document.body.style.cursor = this.cursors.grabbing;
		}else if(this.resizingActiveLayer){
			document.body.style.cursor = this.cursors.move;
		}else if(this.isNearActiveCorner(x, y)){
			document.body.style.cursor = this.cursors.move;
		}else if(this.isNearActiveRotatePoint(x, y)){
			document.body.style.cursor = this.cursors.rotate;
		}else if(this.isOverSelectableLayer(x, y)){
			document.body.style.cursor = this.cursors.grab;
		}else{
			document.body.style.cursor = this.cursors.default;
		}
	}
	
	doUserLayerResize(x, y){
		var o = this.lastMouseDownOffset;
		var n = this.layerRelativePoint(x, y, this.activeLayer);
		if(o.x > 0){
			this.activeLayer.width = Math.abs(this.activeLayerOriginalDimensions.width - (o.x-n.x)*2);
		}else{
			this.activeLayer.width = Math.abs(this.activeLayerOriginalDimensions.width - (n.x-o.x)*2);
		}
		if(o.y > 0){
			this.activeLayer.height = Math.abs(this.activeLayerOriginalDimensions.height - (o.y-n.y)*2);
		}else{
			this.activeLayer.height = Math.abs(this.activeLayerOriginalDimensions.height - (n.y-o.y)*2);
		}
	}
	
	fireEvent(type){
		var event = new CustomEvent(type, {detail: this, cancelable: true, bubbles: true});
		return this.canvas.dispatchEvent(event);
	}
	
	onmousedown(e){
		var {x, y} = this.canvasMousePos(e);
		this.setCursor(x, y);
		if(this.isNearActiveRotatePoint(x, y)){
			this.activeLayerRotateStartPos = {x, y};
			this.rotatingActiveLayer = true;
		}else if(this.isNearActiveCorner(x, y)){
			this.resizingActiveLayer = true;
		}else{
			var cancelled = false;
			var layer = this.getLayerAt(x, y);
			if(layer !== null && layer.selectable === false) layer = null;
			if(layer !== null && this.activeLayer !== null && layer !== this.activeLayer){
				cancelled = !this.fireEvent('layer-deselect');
				if(!cancelled) !this.deSelectLayer();
			}
			if(!cancelled && layer !== null){
				this.activeLayerMouseOffset.x = layer.x - x;
				this.activeLayerMouseOffset.y = layer.y - y;
				if(layer.draggable) this.draggingActiveLayer = true;
				if(layer !== this.activeLayer){
					if(this.fireEvent('layer-select')){
						this.selectLayer(layer);
					}
				}
			}
		}
		if(this.activeLayer){
			this.activeLayerOriginalDimensions = {
				width: this.activeLayer.width,
				height: this.activeLayer.height
			};
			this.lastMouseDownOffset = this.layerRelativePoint(x, y, this.activeLayer);
		}
	}
	
	isNearActiveRotatePoint(x, y){
		if(!this.activeLayer || !this.activeLayer.rotateable) return false;
		var {x, y} = this.layerRelativePoint(x, y, this.activeLayer);
		var mx = (this.activeLayer.width/2)+25;
		var my = 0;
		var dist = Math.hypot(mx-x, my-y);
		if(dist <= this.getScale() * this.anchorRadius) return true;
		return false;
	}
	
	isNearActiveCorner(x, y){
		if(!this.activeLayer || !this.activeLayer.resizable) return false;
		var {x, y} = this.layerRelativePoint(x, y, this.activeLayer);
		var isNear = false;
		this.activeLayer.getCorners().forEach(corner=>{			
			var dist = Math.hypot(corner.x-x, corner.y-y);
			if(dist <= this.getScale() * this.anchorRadius) isNear = true;
		});
		return isNear;
	}
	
	layerRelativePoint(absPointX, absPointY, layer){
		return this.relativePoint(absPointX, absPointY, layer.x, layer.y, layer.rotation);
	}
	
	relativePoint(absPointX, absPointY, centerX, centerY, rotation){
		absPointX -= centerX;
		absPointY -= centerY;
		var radians = rotation * (Math.PI / 180);
		var cos = Math.cos(radians);
		var sin = Math.sin(radians);
		var x = (absPointX * cos) + (absPointY * sin);
		var y = (-absPointX * sin) + (absPointY * cos);
		x = Math.floor(x * 100) / 100;
		y = Math.floor(y * 100) / 100;
		return {x, y};
	}
	
	absolutePoint(relPointX, relPointY, centerX, centerY, rotationDegrees) {
		var radians = rotationDegrees * (Math.PI / 180);
		var cos = Math.cos(radians);
		var sin = Math.sin(radians);
		var x = centerX + (relPointX * cos) - (relPointY * sin);
		var y = centerY + (relPointX * sin) + (relPointY * cos);
		return {x, y};
	}
	
	onmousereset(e){
		var {x, y} = this.canvasMousePos(e);
		this.draggingActiveLayer = false;
		this.resizingActiveLayer = false;
		this.rotatingActiveLayer = false;
		this.lastMouseDownOffset = {x:0, y:0};
		this.activeLayerMouseOffset = {x:0, y:0};
		this.activeLayerOriginalDimensions = {width:0, height:0};
		this.activeLayerRotateStartPos = {x:0, y:0};
		this.setCursor(x, y);
	}
	
	getScale(){
		var rect = this.canvas.getBoundingClientRect();
		return this.canvas.width / rect.width;
	}
	
	canvasMousePos(e) {
		var rect = this.canvas.getBoundingClientRect();
		var x = e.clientX - rect.left;
		var y = e.clientY - rect.top;
		var wfactor = this.canvas.width / rect.width;
		var hfactor = this.canvas.height / rect.height;
		x = x*wfactor;
		y = y*hfactor;
		return {x, y};
	}
	
	getLayerAt(x, y){
		for(let i=0; i<this.layers.length; i++){
			let layer = this.layers[i];
			if(this.isOverLayer(x, y, layer)) return layer;
		}
		return null;
	}
	
	isOverSelectableLayer(x, y){
		for(let i=this.layers.length; i--;){
			if(this.isOverLayer(x, y, this.layers[i])){
				if(this.layers[i].selectable && this.activeLayer !== this.layers[i]) return true;
			}
		}
		return false;
	}
	
	isOverLayer(x, y, layer){
		let r = this.layerRelativePoint(x, y, layer);
		if(r.x > (layer.width/2)) return false;
		if(r.x < -(layer.width/2)) return false;
		if(r.y > (layer.height/2)) return false;
		if(r.y < -(layer.height/2)) return false;
		return true;
	}
}

Canvas.version = '1.0.11';
Canvas.anchorRadius = 8;
Canvas.strokeStyle = '#ba0000';
Canvas.fillStyle = 'black';
Canvas.lineWidth = 5;
Canvas.cursors = {
	default: null,
	grab: "grab",
	grabbing: "grabbing",
	move: "crosshair",
	rotate: "grab",
	rotating: "grabbing"
};

class CanvasLayer{
	constructor(url, name, x, y, width=null, height=null,rotation=0, draggable=true, rotateable=true, resizable=true, selectable=true){
		this.name = name;
		this.url = url;
		this.ready = false;
		this.image = null;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.rotation = rotation;
		this.draggable = draggable;
		this.rotateable = rotateable;
		this.resizable = resizable;
		this.selectable = selectable;
		this.load_cb_stack = [];
	}
	
	onload(fn){
		if(this.ready){
			fn();
			return;
		}else{
			this.load_cb_stack.push(fn);
		}
	}
	
	getCorners(){
		return [
			{x:-(this.width/2), y:-(this.height/2)},
			{x:-(this.width/2)+this.width, y:-(this.height/2)},
			{x:-(this.width/2)+this.width, y:-(this.height/2)+this.height},
			{x:-(this.width/2), y:-(this.height/2)+this.height}
		];
	}
	
	load(){
		return new Promise(done=>{
			if(this.ready) return done();
			const img = new Image();
			img.onload = ()=>{
				this.image = img;
				if(this.width===null) this.width = img.width;
				if(this.height===null) this.height = img.height;
				this.load_cb_stack.forEach(fn=>fn());
				this.load_cb_stack = [];
				this.ready = true;
				done();
			};
			img.src = this.url;
		});
	}
	
}