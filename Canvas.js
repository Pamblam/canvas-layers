class Canvas{
	
	constructor(canvas){
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
	}	
	
	draw(){
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		for(let i=this.layers.length; i--;){
			let layer = this.layers[i];
			var radians = layer.rotation * (Math.PI/180);
			this.ctx.translate(layer.x, layer.y);
			this.ctx.rotate(radians);
			this.ctx.drawImage(layer.image, -(layer.width/2), -(layer.height/2), layer.width, layer.height);
			if(layer === this.activeLayer){
				this.ctx.strokeStyle = Canvas.strokeStyle;
				this.ctx.fillStyle = Canvas.fillStyle;
				this.ctx.lineWidth = Canvas.lineWidth;
				this.ctx.strokeRect(-(layer.width/2), -(layer.height/2), layer.width, layer.height);
				layer.getCorners(true).forEach(corner=>{
					this.drawCircle(corner.x, corner.y, Canvas.anchorRadius);
				});
				this.ctx.beginPath();
				this.ctx.moveTo(0, 0);
				this.ctx.lineTo((layer.width/2)+25, 0);
				this.ctx.stroke();
				this.drawCircle((layer.width/2)+25, 0, Canvas.anchorRadius);
			}
			this.ctx.rotate(-radians);
			this.ctx.translate(-layer.x, -layer.y);
		}
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
			var dx = x - this.activeLayer.x;
			var dy = y - this.activeLayer.y;
			var angle = Math.atan2(dy, dx);
			var degrees = angle * 180 / Math.PI;
			this.activeLayer.rotation = degrees;
			this.draw();
		}else if(this.draggingActiveLayer){
			this.activeLayer.x = this.activeLayerMouseOffset.x + x;
			this.activeLayer.y = this.activeLayerMouseOffset.y + y;
			this.draw();
		}else if(this.resizingActiveLayer){
			this.doUserLayerResize(x, y);
			this.draw();
		}
	}
	
	setCursor(x, y){
		if(this.rotatingActiveLayer){
			document.body.style.cursor = Canvas.cursors.rotating;
		}else if(this.draggingActiveLayer){
			document.body.style.cursor = Canvas.cursors.grabbing;
		}else if(this.resizingActiveLayer){
			document.body.style.cursor = Canvas.cursors.move;
		}else if(this.isNearActiveCorner(x, y)){
			document.body.style.cursor = Canvas.cursors.move;
		}else if(this.isNearActiveRotatePoint(x, y)){
			document.body.style.cursor = Canvas.cursors.rotate;
		}else if(this.isOverAnyLayer(x, y)){
			document.body.style.cursor = Canvas.cursors.grab;
		}else{
			document.body.style.cursor = Canvas.cursors.default;
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
	
	onmousedown(e){
		var {x, y} = this.canvasMousePos(e);
		this.setCursor(x, y);
		if(this.isNearActiveRotatePoint(x, y)){
			this.activeLayerRotateStartPos = {x, y};
			this.rotatingActiveLayer = true;
		}else if(this.isNearActiveCorner(x, y)){
			this.resizingActiveLayer = true;
		}else{
			this.activeLayer = this.getLayerAt(x, y);
			this.draggingActiveLayer = true;
			this.draw();
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
		if(!this.activeLayer) return false;
		var {x, y} = this.layerRelativePoint(x, y, this.activeLayer);
		var mx = (this.activeLayer.width/2)+25;
		var my = 0;
		var dist = Math.hypot(mx-x, my-y);
		if(dist <= Canvas.anchorRadius) return true;
		return false;
	}
	
	isNearActiveCorner(x, y){
		if(!this.activeLayer) return false;
		var {x, y} = this.layerRelativePoint(x, y, this.activeLayer);
		var isNear = false;
		this.activeLayer.getCorners(true).forEach(corner=>{			
			var dist = Math.hypot(corner.x-x, corner.y-y);
			if(dist <= Canvas.anchorRadius) isNear = true;
		});
		return isNear;
	}
	
	layerRelativePoint(absPointX, absPointY, layer){
		absPointX -= layer.x;
		absPointY -= layer.y;
		var radians = layer.rotation * (Math.PI / 180);
		var cos = Math.cos(radians);
		var sin = Math.sin(radians);
		var x = (absPointX * cos) + (absPointY * sin);
		var y = (-absPointX * sin) + (absPointY * cos);
		x = Math.floor(x * 100) / 100;
		y = Math.floor(y * 100) / 100;
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
			if(!this.isOverLayer(x, y, layer)) continue;
			this.activeLayerMouseOffset.x = layer.x - x;
			this.activeLayerMouseOffset.y = layer.y - y;
			this.layers.unshift(this.layers.splice(i, 1)[0]);
			return layer;
		}
		return null;
	}
	
	isOverAnyLayer(x, y){
		for(let i=this.layers.length; i--;){
			if(this.isOverLayer(x, y, this.layers[i])) return true;
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