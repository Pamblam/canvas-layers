
/**
 * CavnasLayer that controls multiple layers
 */
class CanvasLayerGroup extends CanvasLayer{
	
	/**
	 * Create a new Layer.
	 * @param {String} name - The name of the layer.
	 * @param {Boolean} [draggable=true] - Is the layer draggable?
	 * @param {Boolean} [rotateable=true] - Is the layer rotateable?
	 * @param {Boolean} [resizable=true] - Is the layer resizable?
	 * @param {Boolean} [selectable=true] - Is the layer selectable?
	 * @param {Boolean} [forceBoundary=false] - Force the layer to stay in bounds?
	 * @returns {CanvasLayerGroup}
	 */
	constructor(name, draggable=true, rotateable=true, resizable=true, selectable=true, forceBoundary=false){
		var url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/1+yHgAHtAKYD9BncgAAAABJRU5ErkJggg==';
		super(url, name, 0, 0, 1, 1, 0, draggable, rotateable, resizable, selectable, forceBoundary);
		this.layers = [];
	}
	
	/**
	 * Get the layer on the given canvas at the given position. If this group 
	 * is selected it will return the layer in this group at the given 
	 * position, if applicatble.
	 * @param {Canvas} canvas - The Canvas element that owns the layers.
	 * @param {Number} x - The x position of the mouseclick relative to the canvas.
	 * @param {Number} y - The y position of the mouseclick relative to the canvas.
	 * @returns {layer|null}
	 */
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
	
	/**
	 * Remove the provided layer from the group.
	 * @param {CanvasLayer} layer - The layer to remove.
	 * @returns {Promise}
	 */
	async removeLayer(layer){
		delete layer.xoffset;
		delete layer.yoffset;
		this.layers.splice(this.layers.indexOf(layer), 1);
		return await this.regenerate();
	}
	
	/**
	 * Add a layer to the group
	 * @param {CanvasLayer} layer - The layer to add.
	 * @returns {Promise}
	 */
	async addLayer(layer){
		if(layer === this) return;
		if(layer instanceof CanvasLayerGroup){
			this.layers.push(...layer.layers);
		}else{			
			this.layers.push(layer);
		}
		return await this.regenerate();
	}
	
	/**
	 * Regenerate images and dimensions.
	 * @ignore
	 */
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
	
	/**
	 * Update the sublayers of this group.
	 * @ignore
	 */
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
	
	/**
	 * Regenerate images and dimensions.
	 * @ignore
	 */
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