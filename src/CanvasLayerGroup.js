class CanvasLayerGroup extends CanvasLayer{
	
	constructor(name, draggable=true, rotateable=true, resizable=true, selectable=true, forceBoundary=false){
		var url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/1+yHgAHtAKYD9BncgAAAABJRU5ErkJggg==';
		super(url, name, 0, 0, 1, 1, 0, draggable, rotateable, resizable, selectable, forceBoundary);
		this.layers = [];
	}
	
	getLayerOrSubLayerAt(canvas, x, y){
		for(let i=0; i<canvas.layers.length; i++){
			
			let layer = canvas.layers[i];
			
			if(layer === this){
				for(let i=this.layers.length; i--;){
					let layer = this.layers[i];
					if(Canvas.isOverLayer(x, y, layer)) return layer;
				}
			}
			
			if(Canvas.isOverLayer(x, y, layer)) return layer;
		}
		return null;
	}
	
	async removeLayer(layer){
		delete layer.xoffset;
		delete layer.yoffset;
		this.layers.splice(this.layers.indexOf(layer), 1);
		return await this.regenerate();
	}
	
	async addLayer(layer){
		if(layer === this) return;
		if(layer instanceof CanvasLayerGroup){
			this.layers.push(...layer.layers);
		}else{			
			this.layers.push(layer);
		}
		return await this.regenerate();
	}
	
	async regenerate(){
		var params = await this.getParams();
		
		this.width = this.owidth = params.width;
		this.height = this.oheight = params.height;
		
		this.x = params.x;
		this.y = params.y;
		this.rotation = 0;
		
		this.forceBoundary = params.forceBoundary;
		this.draggable =  params.draggable;
		this.rotateable =  params.rotateable;
		this.resizable =  params.resizable;
		this.selectable = params.selectable;
		
		this.url = params.uri;
		this.ready = false;
		return await this.load();
	}
	
	updateLayers(){
		var ratiox = this.width/this.owidth;
		var ratioy = this.height/this.oheight;
		this.layers.forEach(layer=>{
			layer.width = layer.owidth * ratiox;
			layer.height = layer.oheight * ratioy;			
			layer.rotation = layer.roffset + this.rotation;
			var pos = Canvas.absolutePoint(layer.xoffset*ratiox, layer.yoffset*ratioy, this.x, this.y, this.rotation);
			layer.x = pos.x;
			layer.y = pos.y;
			
		});
	}
	
	async getParams(){
		const allCorners = this.layers.map(layer => {
			return layer.getCorners().map(corner=>{
				return Canvas.absolutePoint(corner.x, corner.y, layer.x, layer.y, layer.rotation);
			});
		});
		
		const allBounds = [];
		allCorners.forEach(corners=>{
			allBounds.push(...corners);
		});

		var pos = {
			left: allBounds.reduce((acc, cur)=>Math.min(acc, cur.x), Infinity),
			top: allBounds.reduce((acc, cur)=>Math.min(acc, cur.y), Infinity),
			right: allBounds.reduce((acc, cur)=>Math.max(acc, cur.x),0),
			bottom: allBounds.reduce((acc, cur)=>Math.max(acc, cur.y),0)
		};
		pos.width = pos.right - pos.left;
		pos.height = pos.bottom - pos.top;
		pos.x = pos.left+(pos.width/2);
		pos.y = pos.top+(pos.height/2);

		var ele = document.createElement('canvas');
		ele.width = pos.right+2;
		ele.height = pos.bottom+2;
		var canvas = new Canvas(ele);
		this.layers.forEach(layer=>canvas.addLayer(layer));
		
		pos.uri = await canvas.extractPortion(pos.x, pos.y, pos.width, pos.height, 0, false);
		
		pos.forceBoundary = this.layers.reduce((acc, itm)=>itm.forceBoundary||acc,false);
		pos.draggable = this.layers.reduce((acc, itm)=>acc===false?false:itm.draggable,true);
		pos.rotateable = this.layers.reduce((acc, itm)=>acc===false?false:itm.draggable,true);
		pos.resizable = this.layers.reduce((acc, itm)=>acc===false?false:itm.draggable,true);
		pos.selectable = this.layers.reduce((acc, itm)=>acc===false?false:itm.draggable,true);
		
		this.layers.forEach(l=>{
			l.xoffset = l.x - pos.x;
			l.yoffset = l.y - pos.y;
			l.roffset = l.rotation;
			l.owidth = l.width;
			l.oheight = l.height;
		});
		
		return pos;
	}

}